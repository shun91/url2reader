import { isSupportedHttpUrl } from "../public/lib/url.js";
import { extractArticleFromUrl } from "../src/lib/article.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

function renderDocument({ title, contentHtml, sourceUrl, language }) {
  const safeTitle = escapeHtml(title || "無題");
  const safeSourceUrl = escapeHtml(sourceUrl);
  const lang = language === "unknown" ? "en" : language;

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        padding: 2rem 1rem 4rem;
        font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN",
          "Yu Gothic", sans-serif;
        line-height: 1.8;
        color: #111;
        background: #fafafa;
      }
      main {
        max-width: 760px;
        margin: 0 auto;
        background: #fff;
        padding: 2rem;
        border-radius: 12px;
      }
      h1 { line-height: 1.4; margin-top: 0; }
      img { max-width: 100%; height: auto; }
      pre, code { white-space: pre-wrap; overflow-wrap: anywhere; }
      a { color: #0b57d0; }
      .source { font-size: 0.9rem; color: #555; margin-bottom: 1.5rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p class="source">Source: <a href="${safeSourceUrl}" rel="noopener noreferrer">${safeSourceUrl}</a></p>
      <section>${contentHtml}</section>
    </main>
  </body>
</html>`;
}

export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl || !isSupportedHttpUrl(targetUrl)) {
    return html("<h1>Invalid URL</h1>", 400);
  }

  const result = await extractArticleFromUrl(targetUrl);
  if (!result.ok) {
    return html(`<h1>${escapeHtml(result.message)}</h1>`, result.status);
  }

  return html(renderDocument(result.article));
}
