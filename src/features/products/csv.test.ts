import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });
  it("handles quoted fields with commas", () => {
    expect(parseCsv('name,desc\n"Sofa, XL",nice')).toEqual([
      ["name", "desc"],
      ["Sofa, XL", "nice"],
    ]);
  });
  it("handles escaped quotes", () => {
    expect(parseCsv('a\n"say ""hi"" now"')).toEqual([["a"], ['say "hi" now']]);
  });
  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("skips fully empty lines", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("handles newlines inside quoted fields", () => {
    const rows = parseCsv('a,b\n"line1\nline2",x');
    expect(rows).toEqual([
      ["a", "b"],
      ["line1\nline2", "x"],
    ]);
  });
});
