import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { buildGoogleTranslateUrl, detectArticleLanguage } from "../src/lib/language.js";

describe("detectArticleLanguage", () => {
  it("html langがjaならjaを返す", () => {
    const { document } = parseHTML('<html lang="ja-JP"><head></head><body></body></html>');
    const language = detectArticleLanguage({ document, textContent: "Hello world" });
    expect(language).toBe("ja");
  });

  it("og:localeから言語を判定できる", () => {
    const { document } = parseHTML(
      '<html><head><meta property="og:locale" content="en_US"></head><body></body></html>'
    );
    const language = detectArticleLanguage({ document, textContent: "日本語の本文です。" });
    expect(language).toBe("en");
  });

  it("本文の文字種から日本語を推定できる", () => {
    const { document } = parseHTML("<html><head></head><body></body></html>");
    const textContent =
      "これは日本語のテキストです。十分な長さを持たせるために追加の文章をここに書いています。";
    const language = detectArticleLanguage({ document, textContent });
    expect(language).toBe("ja");
  });

  it("本文の文字種から英語を推定できる", () => {
    const { document } = parseHTML("<html><head></head><body></body></html>");
    const textContent =
      "This is an English paragraph with enough words to pass the threshold and detect language reliably.";
    const language = detectArticleLanguage({ document, textContent });
    expect(language).toBe("en");
  });

  it("判定情報が不足している場合はunknown", () => {
    const { document } = parseHTML("<html><head></head><body></body></html>");
    const language = detectArticleLanguage({ document, textContent: "12345 ???" });
    expect(language).toBe("unknown");
  });
});

describe("buildGoogleTranslateUrl", () => {
  it("Google翻訳URLを組み立てる", () => {
    const url = buildGoogleTranslateUrl("https://example.com/article");
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://translate.google.com");
    expect(parsed.pathname).toBe("/translate");
    expect(parsed.searchParams.get("sl")).toBe("auto");
    expect(parsed.searchParams.get("tl")).toBe("ja");
    expect(parsed.searchParams.get("u")).toBe("https://example.com/article");
  });
});
