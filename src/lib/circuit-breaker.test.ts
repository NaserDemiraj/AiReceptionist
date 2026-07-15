import { describe, expect, it } from "vitest";
import { isCircuitOpen, recordFailure, recordSuccess } from "./circuit-breaker";

describe("circuit breaker", () => {
  it("stays closed below the failure threshold", () => {
    const name = `svc-${Math.random()}`;
    for (let i = 0; i < 4; i++) recordFailure(name);
    expect(isCircuitOpen(name)).toBe(false);
  });

  it("opens after the threshold of consecutive failures", () => {
    const name = `svc-${Math.random()}`;
    for (let i = 0; i < 5; i++) recordFailure(name);
    expect(isCircuitOpen(name)).toBe(true);
  });

  it("a success resets the failure count", () => {
    const name = `svc-${Math.random()}`;
    for (let i = 0; i < 4; i++) recordFailure(name);
    recordSuccess(name);
    for (let i = 0; i < 4; i++) recordFailure(name);
    expect(isCircuitOpen(name)).toBe(false);
  });

  it("half-opens after the cooldown", () => {
    const name = `svc-${Math.random()}`;
    for (let i = 0; i < 5; i++) recordFailure(name, { cooldownMs: 0 });
    // cooldown of 0 → first check after opening lets a trial call through
    expect(isCircuitOpen(name, { cooldownMs: 0 })).toBe(false);
  });

  it("closes again after a successful trial call", () => {
    const name = `svc-${Math.random()}`;
    for (let i = 0; i < 5; i++) recordFailure(name, { cooldownMs: 0 });
    isCircuitOpen(name, { cooldownMs: 0 }); // half-open
    recordSuccess(name);
    expect(isCircuitOpen(name)).toBe(false);
  });
});
