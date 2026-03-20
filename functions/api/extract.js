import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { isSupportedHttpUrl } from "../../public/lib/url.js";
import { sanitizeArticleHtml } from "../../src/lib/sanitize.js";

const USER_AGENT = "url2reader/0.1 (+https://example.com)";

function json(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function badRequest(code, message) {
  return json({ error: { code, message } }, { status: 400 });
}

export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return badRequest("INVALID_URL", "url query is required");
  }

  if (!isSupportedHttpUrl(targetUrl)) {
    return badRequest("INVALID_URL", "only http/https are supported");
  }

  let response;
  try {
    response = await fetch(targetUrl, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml"
      },
      redirect: "follow"
    });
  } catch {
    return json(
      { error: { code: "FETCH_FAILED", message: "failed to fetch target URL" } },
      { status: 502 }
    );
  }

  if (!response.ok) {
    return json(
      { error: { code: "FETCH_FAILED", message: `origin returned ${response.status}` } },
      { status: 502 }
    );
  }

  const html = await response.text();
  const { document } = parseHTML(html);
  const article = new Readability(document, { charThreshold: 80 }).parse();

  if (!article || !article.content) {
    return json(
      { error: { code: "EXTRACTION_FAILED", message: "article extraction failed" } },
      { status: 422 }
    );
  }

  const contentHtml = sanitizeArticleHtml(article.content);

  return json({
    title: article.title || document.title || "無題",
    contentHtml,
    sourceUrl: targetUrl
  });
}
