import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit then blocks", async () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const result = await rateLimit(key, 5, 60_000);
      expect(result.allowed).toBe(true);
    }
    const blocked = await rateLimit(key, 5, 60_000);
    expect(blocked.allowed).toBe(false);
  });

  it("tracks keys independently", async () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect((await rateLimit(a, 1, 60_000)).allowed).toBe(true);
    expect((await rateLimit(a, 1, 60_000)).allowed).toBe(false);
    expect((await rateLimit(b, 1, 60_000)).allowed).toBe(true);
  });

  it("reports remaining budget", async () => {
    const key = `r-${Math.random()}`;
    expect((await rateLimit(key, 3, 60_000)).remaining).toBe(2);
    expect((await rateLimit(key, 3, 60_000)).remaining).toBe(1);
  });
});
