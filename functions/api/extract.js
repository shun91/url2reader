import { isSupportedHttpUrl } from "../../public/lib/url.js";
import { extractArticleFromUrl } from "../../src/lib/article.js";
import { buildGoogleTranslateUrl } from "../../src/lib/language.js";

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

  const result = await extractArticleFromUrl(targetUrl);
  if (!result.ok) {
    return json({ error: { code: result.code, message: result.message } }, { status: result.status });
  }

  const requestUrl = new URL(context.request.url);
  const appArticleUrl = new URL(`/view?url=${encodeURIComponent(targetUrl)}`, requestUrl.origin).toString();
  const translationUrl =
    result.article.language !== "ja" && result.article.language !== "unknown"
      ? buildGoogleTranslateUrl(appArticleUrl)
      : null;

  return json({
    ...result.article,
    translationUrl
  });
}
