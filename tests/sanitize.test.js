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
    expect(output).toContain("<p>Hello link</p>");
    expect(output).toContain("<blockquote>Quote</blockquote>");
    expect(output).not.toContain("<script");
    expect(output).not.toContain("<a ");
    expect(output).not.toContain("<div");
  });
});
