import { describe, expect, it } from "vitest";
import { sanitizeArticleHtml } from "../src/lib/sanitize.js";

describe("sanitizeArticleHtml", () => {
  it("許可タグ以外を除去し、本文タグのみ残す", () => {
    const input = `
      <div>
        <h1>Title</h1>
        <p>Hello <a href="https://example.com">link</a></p>
        <script>alert(1)</script>
        <blockquote>Quote</blockquote>
      </div>
    `;

    const output = sanitizeArticleHtml(input);

    expect(output).toContain("<h1>Title</h1>");
    expect(output).toContain('<p>Hello <a href="https://example.com/">link</a></p>');
    expect(output).toContain("<blockquote>Quote</blockquote>");
    expect(output).not.toContain("<script");
    expect(output).not.toContain("<div");
  });

  it("画像を保持し、相対パスを絶対URLに解決する", () => {
    const input = `
      <figure>
        <img src="/assets/image.jpg" alt="sample" width="600" onerror="alert(1)" />
        <figcaption>caption</figcaption>
      </figure>
    `;

    const output = sanitizeArticleHtml(input, { baseUrl: "https://example.com/posts/1" });

    expect(output).toContain("<figure>");
    expect(output).toContain('<img width="600"');
    expect(output).toContain('alt="sample"');
    expect(output).toContain('src="https://example.com/assets/image.jpg"');
    expect(output).toContain("<figcaption>caption</figcaption>");
    expect(output).not.toContain("onerror=");
  });

  it("危険なURLスキームを除去する", () => {
    const input = `
      <p><a href="javascript:alert(1)">bad</a></p>
      <img src="javascript:alert(1)" alt="bad" />
    `;

    const output = sanitizeArticleHtml(input, { baseUrl: "https://example.com" });

    expect(output).toContain("<p><a>bad</a></p>");
    expect(output).not.toContain("<img");
  });
});
