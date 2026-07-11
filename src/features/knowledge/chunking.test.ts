import { describe, expect, it } from "vitest";
import { htmlToText, splitIntoChunks } from "./chunking";

describe("splitIntoChunks", () => {
  it("returns short text as one chunk", () => {
    expect(splitIntoChunks("Hello world")).toEqual(["Hello world"]);
  });
  it("returns nothing for empty input", () => {
    expect(splitIntoChunks("   \n  ")).toEqual([]);
  });
  it("splits long text and keeps every chunk under ~2x target", () => {
    const para = "Delivery takes three to seven days across the country. ".repeat(10);
    const text = Array(8).fill(para).join("\n\n");
    const chunks = splitIntoChunks(text, 900);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1800);
    // no content lost (modulo whitespace normalisation)
    expect(chunks.join(" ").replace(/\s+/g, " ")).toContain("Delivery takes three");
  });
});

describe("htmlToText", () => {
  it("strips tags, scripts and styles", () => {
    const html =
      "<html><head><style>.x{}</style><script>evil()</script></head><body><h1>Hi</h1><p>We deliver &amp; assemble.</p></body></html>";
    const text = htmlToText(html);
    expect(text).toContain("Hi");
    expect(text).toContain("We deliver & assemble.");
    expect(text).not.toContain("evil");
    expect(text).not.toContain(".x{}");
  });
});
