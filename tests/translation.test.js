import { describe, expect, it } from "vitest";
import { resolveTranslationUrl } from "../public/lib/translation.js";

describe("resolveTranslationUrl", () => {
  it("httpsのtranslationUrlを返す", () => {
    const url = resolveTranslationUrl({
      translationUrl: "https://translate.google.com/translate?sl=auto&tl=ja&u=https://example.com"
    });

    expect(url).toContain("https://translate.google.com/translate");
  });

  it("translationUrlがない場合はnull", () => {
    expect(resolveTranslationUrl({})).toBeNull();
  });

  it("httpは拒否してnull", () => {
    const url = resolveTranslationUrl({
      translationUrl: "http://translate.google.com/translate?sl=auto&tl=ja&u=https://example.com"
    });
    expect(url).toBeNull();
  });

  it("不正URLはnull", () => {
    expect(resolveTranslationUrl({ translationUrl: "not-a-url" })).toBeNull();
  });
});
