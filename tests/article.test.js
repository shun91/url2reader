import { describe, expect, it, vi } from "vitest";
import { extractArticleFromUrl } from "../src/lib/article.js";

function createResponse(html) {
  return {
    ok: true,
    status: 200,
    text: async () => html
  };
}

describe("extractArticleFromUrl", () => {
  it("prioritizeLanguageRedirect有効時に英語は本文抽出をスキップする", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse(`<!doctype html>
<html lang="en">
  <head><title>English title</title></head>
  <body>
    <p>This is a long English article body to make language detection reliable enough for redirect.</p>
  </body>
</html>`)
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractArticleFromUrl("https://example.com/en-article", {
      prioritizeLanguageRedirect: true
    });

    expect(result.ok).toBe(true);
    expect(result.skippedExtraction).toBe(true);
    expect(result.article.language).toBe("en");
    expect(result.article.contentHtml).toBe("");

    vi.unstubAllGlobals();
  });

  it("日本語はprioritizeLanguageRedirect有効でも通常抽出する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse(`<!doctype html>
<html lang="ja">
  <head><title>日本語タイトル</title></head>
  <body>
    <article>
      <p>これはテスト用の本文です。十分な長さを持つように複数の文章を書いています。読みやすい形で抽出されることを期待します。</p>
      <p>さらに追記して文字数を増やします。これでReadabilityが本文として判定しやすくなります。</p>
    </article>
  </body>
</html>`)
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractArticleFromUrl("https://example.com/ja-article", {
      prioritizeLanguageRedirect: true
    });

    expect(result.ok).toBe(true);
    expect(result.skippedExtraction).not.toBe(true);
    expect(result.article.language).toBe("ja");
    expect(result.article.contentHtml.length).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});
