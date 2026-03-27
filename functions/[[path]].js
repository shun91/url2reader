import { buildGoogleTranslateUrl } from "../src/lib/language.js";
import { extractArticleFromUrl } from "../src/lib/article.js";
import { isSupportedHttpUrl, pathToTargetUrl } from "../public/lib/url.js";

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

function renderHomePage() {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>URL Reader</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f6f7f9;
        color: #111;
        font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
      }
      main {
        width: min(760px, 92vw);
        background: #fff;
        border-radius: 12px;
        padding: 2rem;
      }
      h1 { margin-top: 0; line-height: 1.4; }
      p, li { line-height: 1.8; }
      code {
        background: #f0f0f0;
        padding: 0.1rem 0.3rem;
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>URL Reader</h1>
      <p>URL を次の形式で開くと、記事本文を抽出して表示します。</p>
      <p><code>/https://example.com/article</code></p>
    </main>
  </body>
</html>`;
}

function renderErrorPage(status, title, detail) {
  return html(
    `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(detail)}</p>
    </main>
  </body>
</html>`,
    status
  );
}

function renderArticlePage({ article, translationUrl }) {
  const safeTitle = escapeHtml(article.title || "無題");
  const safeSourceUrl = escapeHtml(article.sourceUrl);
  const lang = article.language === "unknown" ? "en" : article.language;
  const translationScript = translationUrl
    ? `<script>
(() => {
  const isGoogleTranslateHost = location.hostname.endsWith(".translate.goog");
  if (!isGoogleTranslateHost) {
    location.replace(${JSON.stringify(translationUrl)});
  }
})();
</script>`
    : "";

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
      <section>${article.contentHtml}</section>
    </main>
    ${translationScript}
  </body>
</html>`;
}

function pickTargetUrl(requestUrl) {
  const queryValue = requestUrl.searchParams.get("url");
  if (queryValue && isSupportedHttpUrl(queryValue)) {
    return queryValue;
  }
  return pathToTargetUrl(requestUrl.pathname);
}

function isAssetLikePath(pathname) {
  if (!pathname || pathname === "/") {
    return false;
  }

  const normalized = pathname.toLowerCase();
  return (
    normalized.startsWith("/api/") ||
    normalized === "/favicon.ico" ||
    normalized.startsWith("/assets/") ||
    /\.[a-z0-9]+$/.test(normalized)
  );
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);

  if (isAssetLikePath(requestUrl.pathname)) {
    return context.next();
  }

  const targetUrl = pickTargetUrl(requestUrl);

  if (!targetUrl) {
    if (requestUrl.pathname === "/" || requestUrl.pathname === "") {
      return html(renderHomePage());
    }
    return renderErrorPage(400, "Invalid URL", "http/https のURLを指定してください。");
  }

  const result = await extractArticleFromUrl(targetUrl);
  if (!result.ok) {
    return renderErrorPage(result.status, "記事を取得できませんでした", result.message);
  }

  const appArticleUrl = new URL(`/${encodeURIComponent(targetUrl)}`, requestUrl.origin).toString();
  const translationUrl =
    result.article.language !== "ja" && result.article.language !== "unknown"
      ? buildGoogleTranslateUrl(appArticleUrl)
      : null;

  return html(renderArticlePage({ article: result.article, translationUrl }));
}
