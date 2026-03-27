import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { detectArticleLanguage } from "./language.js";
import { sanitizeArticleHtml } from "./sanitize.js";

const USER_AGENT = "url2reader/0.1 (+https://example.com)";

export async function extractArticleFromUrl(targetUrl) {
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
    return {
      ok: false,
      status: 502,
      code: "FETCH_FAILED",
      message: "failed to fetch target URL"
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      code: "FETCH_FAILED",
      message: `origin returned ${response.status}`
    };
  }

  const html = await response.text();
  const { document } = parseHTML(html);
  const article = new Readability(document, { charThreshold: 80 }).parse();

  if (!article || !article.content) {
    return {
      ok: false,
      status: 422,
      code: "EXTRACTION_FAILED",
      message: "article extraction failed"
    };
  }

  const contentHtml = sanitizeArticleHtml(article.content, { baseUrl: targetUrl });
  const language = detectArticleLanguage({ document, textContent: article.textContent });

  return {
    ok: true,
    article: {
      title: article.title || document.title || "無題",
      contentHtml,
      sourceUrl: targetUrl,
      language
    }
  };
}
