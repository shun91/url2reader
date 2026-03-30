import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/article.js", () => ({
  extractArticleFromUrl: vi.fn()
}));

import { extractArticleFromUrl } from "../src/lib/article.js";
import { onRequestGet } from "../functions/[[path]].js";

describe("onRequestGet routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("静的アセットパスはcontext.next()へ委譲する", async () => {
    const context = {
      request: new Request("https://example.com/styles.css"),
      next: vi.fn().mockResolvedValue(new Response("STATIC", { status: 200 }))
    };

    const response = await onRequestGet(context);
    const body = await response.text();

    expect(context.next).toHaveBeenCalledTimes(1);
    expect(body).toBe("STATIC");
  });

  it("拡張子付きのURLエンコード記事パスは静的アセット扱いしない", async () => {
    extractArticleFromUrl.mockResolvedValue({
      ok: true,
      skippedExtraction: false,
      article: {
        title: "Harness Engineering",
        sourceUrl:
          "https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html",
        contentHtml: "<p>article body</p>",
        language: "en"
      }
    });

    const context = {
      request: new Request(
        "https://example.com/https%3A%2F%2Fmartinfowler.com%2Farticles%2Fexploring-gen-ai%2Fharness-engineering.html?__skip_lang_redirect=1"
      ),
      next: vi.fn().mockResolvedValue(new Response("STATIC", { status: 200 }))
    };

    const response = await onRequestGet(context);
    const body = await response.text();

    expect(context.next).not.toHaveBeenCalled();
    expect(extractArticleFromUrl).toHaveBeenCalledWith(
      "https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html",
      expect.objectContaining({ prioritizeLanguageRedirect: false })
    );
    expect(response.status).toBe(200);
    expect(body).toContain("Harness Engineering");
    expect(body).toContain("reader-content");
  });
});
