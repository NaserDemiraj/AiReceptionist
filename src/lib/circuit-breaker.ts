import { logger } from "./logger";

/**
 * Minimal circuit breaker for best-effort external services (OpenAI, Google).
 *
 * After `threshold` consecutive failures the circuit opens: calls are skipped
 * instantly for `cooldownMs` instead of each one waiting out a timeout. After
 * the cooldown one trial call is let through (half-open); success closes the
 * circuit, failure re-opens it.
 *
 * State is per-process (module memory). On serverless that means per warm
 * instance — good enough, since the goal is latency protection, not accounting.
 */

interface BreakerState {
  consecutiveFailures: number;
  openedAt: number | null;
}

export interface BreakerOptions {
  threshold?: number; // consecutive failures before opening (default 5)
  cooldownMs?: number; // how long the circuit stays open (default 60s)
}

const states = new Map<string, BreakerState>();

function getState(name: string): BreakerState {
  let s = states.get(name);
  if (!s) {
    s = { consecutiveFailures: 0, openedAt: null };
    states.set(name, s);
  }
  return s;
}

/** True when calls to this service should be skipped right now. */
export function isCircuitOpen(name: string, opts?: BreakerOptions): boolean {
  const s = getState(name);
  if (s.openedAt === null) return false;
  if (Date.now() - s.openedAt >= (opts?.cooldownMs ?? 60_000)) {
    // Half-open: let the next call through as a trial
    s.openedAt = null;
    return false;
  }
  return true;
}

export function recordSuccess(name: string): void {
  const s = getState(name);
  s.consecutiveFailures = 0;
  s.openedAt = null;
}

export function recordFailure(name: string, opts?: BreakerOptions): void {
  const s = getState(name);
  s.consecutiveFailures += 1;
  if (s.consecutiveFailures >= (opts?.threshold ?? 5) && s.openedAt === null) {
    s.openedAt = Date.now();
    logger.warn(
      { service: name, failures: s.consecutiveFailures },
      "circuit breaker opened — skipping calls during cooldown",
    );
  }
}

/**
 * fetch with a hard timeout — external calls must never hang a user request.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 10_000, ...rest } = init;
  return fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
}
