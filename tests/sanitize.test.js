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

  it("テーブルとコードブロックを保持し、危険属性を除去する", () => {
    const input = `
      <table style="width:100%">
        <thead>
          <tr><th colspan="2" onclick="alert(1)">Col</th></tr>
        </thead>
        <tbody>
          <tr>
            <td rowspan="2">A</td>
            <td><pre><code class="language-js">const x = 1;</code></pre></td>
          </tr>
        </tbody>
      </table>
    `;

    const output = sanitizeArticleHtml(input);

    expect(output).toContain("<table>");
    expect(output).toContain("<thead>");
    expect(output).toContain('<th colspan="2">Col</th>');
    expect(output).toContain('<td rowspan="2">A</td>');
    expect(output).toContain("<pre><code>const x = 1;</code></pre>");
    expect(output).not.toContain("onclick=");
    expect(output).not.toContain("style=");
    expect(output).not.toContain('class="language-js"');
  });

  it("本文で一般的な強調や改行タグを保持する", () => {
    const input = `
      <p>line1<br />line2</p>
      <p><strong>strong</strong> <em>em</em> <mark>mark</mark> <small>small</small></p>
      <hr />
      <ul><li>a<ul><li>b</li></ul></li></ul>
    `;

    const output = sanitizeArticleHtml(input);

    expect(output).toContain("<p>line1<br>line2</p>");
    expect(output).toContain("<strong>strong</strong>");
    expect(output).toContain("<em>em</em>");
    expect(output).toContain("<mark>mark</mark>");
    expect(output).toContain("<small>small</small>");
    expect(output).toContain("<hr>");
    expect(output).toContain("<ul><li>a<ul><li>b</li></ul></li></ul>");
  });
});
