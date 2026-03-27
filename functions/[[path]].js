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
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main>
      <article>
        <h1>URL Reader</h1>
        <p>URL を次の形式で開くと、記事本文を抽出して表示します。</p>
        <p><code>/https://example.com/article</code></p>
      </article>
    </main>
    <script>
(() => {
  const path = location.pathname || "";
  if (path.startsWith("/http://") || path.startsWith("/https://")) {
    const rawUrl = path.slice(1);
    const normalizedPath = "/" + encodeURIComponent(rawUrl);
    if (path !== normalizedPath) {
      location.replace(normalizedPath);
    }
  }
})();
</script>
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
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main>
      <article>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(detail)}</p>
      </article>
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
  const searchParams = new URLSearchParams(location.search);
  const isGoogleTranslateHost = location.hostname.endsWith(".translate.goog");
  const hasTranslateParams =
    searchParams.has("_x_tr_sl") ||
    searchParams.has("_x_tr_tl") ||
    searchParams.has("_x_tr_hl");
  const fromTranslate = typeof document.referrer === "string" && document.referrer.includes(".translate.goog/");
  if (!isGoogleTranslateHost && !hasTranslateParams && !fromTranslate) {
    location.replace(${JSON.stringify(translationUrl)});
  }
})();
</script>`
    : "";
  const scrollPersistenceScript = `<script>
(() => {
  const storageKey = "scroll-position:" + location.pathname;

  const saveScrollPosition = () => {
    try {
      localStorage.setItem(storageKey, String(window.scrollY));
    } catch {
      // noop
    }
  };

  const restoreScrollPosition = () => {
    try {
      const rawValue = localStorage.getItem(storageKey);
      const savedY = Number(rawValue);
      if (!Number.isFinite(savedY) || savedY < 0) {
        return;
      }
      requestAnimationFrame(() => {
        window.scrollTo(0, savedY);
      });
    } catch {
      // noop
    }
  };

  let ticking = false;
  const persist = () => {
    saveScrollPosition();
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) {
        return;
      }
      ticking = true;
      requestAnimationFrame(persist);
    },
    { passive: true }
  );

  window.addEventListener("beforeunload", saveScrollPosition);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveScrollPosition();
    }
  });
  window.addEventListener("pagehide", saveScrollPosition);

  restoreScrollPosition();
})();
</script>`;

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main>
      <article>
        <h1>${safeTitle}</h1>
        <p class="source">Source: <a href="${safeSourceUrl}" rel="noopener noreferrer">${safeSourceUrl}</a></p>
        <section>${article.contentHtml}</section>
      </article>
    </main>
    ${translationScript}
    ${scrollPersistenceScript}
  </body>
</html>`;
}

function pickTargetUrl(requestUrl) {
  const queryValue = requestUrl.searchParams.get("url");
  if (queryValue && isSupportedHttpUrl(queryValue)) {
    return { targetUrl: queryValue, source: "query" };
  }

  const pathValue = pathToTargetUrl(requestUrl.pathname);
  if (pathValue) {
    return { targetUrl: pathValue, source: "path" };
  }

  return { targetUrl: null, source: null };
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

  const { targetUrl, source } = pickTargetUrl(requestUrl);

  if (!targetUrl) {
    if (requestUrl.pathname === "/" || requestUrl.pathname === "") {
      return html(renderHomePage());
    }
    return renderErrorPage(400, "Invalid URL", "http/https のURLを指定してください。");
  }

  if (source === "path") {
    const normalizedPath = `/${encodeURIComponent(targetUrl)}`;
    if (requestUrl.pathname !== normalizedPath) {
      const normalizedUrl = new URL(normalizedPath, requestUrl.origin);
      return Response.redirect(normalizedUrl.toString(), 302);
    }
  }

  const result = await extractArticleFromUrl(targetUrl);
  if (!result.ok) {
    return renderErrorPage(result.status, "記事を取得できませんでした", result.message);
  }

  const appArticleUrl = new URL(`/${encodeURIComponent(targetUrl)}`, requestUrl.origin).toString();
  const isTranslateContext =
    requestUrl.hostname.endsWith(".translate.goog") ||
    requestUrl.searchParams.has("_x_tr_sl") ||
    requestUrl.searchParams.has("_x_tr_tl") ||
    requestUrl.searchParams.has("_x_tr_hl");
  const translationUrl =
    result.article.language !== "ja" && result.article.language !== "unknown" && !isTranslateContext
      ? buildGoogleTranslateUrl(appArticleUrl)
      : null;

  return html(renderArticlePage({ article: result.article, translationUrl }));
}
