import { describe, expect, it } from "vitest";
import { DEFAULT_GROQ_MODEL, reasoningParams, resolveModel } from "./models";

describe("resolveModel", () => {
  it("upgrades a retired stored model to the default", () => {
    expect(resolveModel("llama-3.3-70b-versatile", "GROQ", {})).toBe(DEFAULT_GROQ_MODEL);
  });

  it("keeps a stored model that is still served", () => {
    expect(resolveModel("qwen/qwen3.8-27b", "GROQ", {})).toBe("qwen/qwen3.8-27b");
  });

  it("falls back to the default when nothing is stored", () => {
    expect(resolveModel(null, "GROQ", {})).toBe(DEFAULT_GROQ_MODEL);
    expect(resolveModel("  ", "GROQ", {})).toBe(DEFAULT_GROQ_MODEL);
  });

  it("lets GROQ_MODEL override every tenant", () => {
    expect(resolveModel("qwen/qwen3.8-27b", "GROQ", { GROQ_MODEL: "openai/gpt-oss-20b" })).toBe(
      "openai/gpt-oss-20b",
    );
  });

  it("ignores the Groq override and retired list for other providers", () => {
    expect(resolveModel("gpt-4.1-mini", "OPENAI", { GROQ_MODEL: "openai/gpt-oss-20b" })).toBe("gpt-4.1-mini");
  });
});

describe("reasoningParams", () => {
  it("asks gpt-oss models for low reasoning effort", () => {
    expect(reasoningParams("openai/gpt-oss-120b")).toEqual({ reasoning_effort: "low" });
  });

  it("adds nothing for other models", () => {
    expect(reasoningParams("qwen/qwen3.8-27b")).toEqual({});
  });
});
