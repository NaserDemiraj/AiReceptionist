import { describe, expect, it } from "vitest";
import { detectLanguage, detectSentiment } from "./language";

describe("detectLanguage", () => {
  it("detects Albanian with diacritics", () => {
    expect(detectLanguage("Përshëndetje! A keni divan gri?")).toBe("sq");
  });
  it("detects Albanian without diacritics", () => {
    expect(detectLanguage("me sugjero dicka")).toBe("sq");
    expect(detectLanguage("sa kushton milano?")).toBe("sq");
    expect(detectLanguage("dua te blej nje dollap")).toBe("sq");
  });
  it("detects German", () => {
    expect(detectLanguage("Hallo, kann ich in Raten zahlen?")).toBe("de");
    expect(detectLanguage("Wie viel kostet das Bett?")).toBe("de");
  });
  it("defaults to English", () => {
    expect(detectLanguage("Do you have a grey corner sofa under 900?")).toBe("en");
    expect(detectLanguage("hello")).toBe("en");
  });
  it("does not misread English 'me' as Albanian", () => {
    expect(detectLanguage("can you help me find a table")).toBe("en");
  });
});

describe("detectSentiment", () => {
  it("flags negative language in all three languages", () => {
    expect(detectSentiment("This is unacceptable, my delivery is late!")).toBe("NEGATIVE");
    expect(detectSentiment("Produkti erdhi i dëmtuar")).toBe("NEGATIVE");
    expect(detectSentiment("Meine Lieferung ist verspätet")).toBe("NEGATIVE");
  });
  it("flags positive language", () => {
    expect(detectSentiment("Thank you, that's perfect!")).toBe("POSITIVE");
    expect(detectSentiment("Faleminderit shumë!")).toBe("POSITIVE");
  });
  it("defaults to neutral", () => {
    expect(detectSentiment("What are your opening hours?")).toBe("NEUTRAL");
  });
});
