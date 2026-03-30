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
  const highlightScript = `<script>
(() => {
  const storageKey = "highlights:" + location.pathname;
  const uiAttr = "data-highlight-ui";
  const article = document.querySelector("main article");
  const contentSection = document.getElementById("reader-content");
  if (!article || !contentSection) {
    return;
  }

  const articleTitle = (article.querySelector("h1")?.textContent || document.title || "無題").trim();
  const sourceLink = article.querySelector(".source a");
  const articleUrl = sourceLink?.href || location.href;
  let highlights = loadHighlights();
  let pendingHighlight = null;

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function loadHighlights() {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = safeParse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => ({
          id: normalizeText(item?.id),
          text: normalizeText(item?.text),
          createdAt: normalizeText(item?.createdAt),
          updatedAt: normalizeText(item?.updatedAt),
          startPath: normalizeText(item?.startPath),
          startOffset: Number.isInteger(item?.startOffset) ? item.startOffset : null,
          endPath: normalizeText(item?.endPath),
          endOffset: Number.isInteger(item?.endOffset) ? item.endOffset : null,
          anchorY: Number.isFinite(item?.anchorY) ? item.anchorY : null
        }))
        .filter((item) => item.id && item.text);
    } catch {
      return [];
    }
  }

  function saveHighlights() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(highlights));
    } catch {
      // noop
    }
  }

  function makeId() {
    return "hl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function isUiNode(node) {
    if (!node) {
      return false;
    }
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return !!(element && element.closest("[" + uiAttr + "]"));
  }

  function isInsideContent(node) {
    if (!node) {
      return false;
    }
    const target = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
    return !!(target && contentSection.contains(target));
  }

  function nodeToPath(root, node) {
    if (node === root) {
      return "";
    }
    const parts = [];
    let current = node;
    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) {
        return null;
      }
      const index = Array.prototype.indexOf.call(parent.childNodes, current);
      if (index < 0) {
        return null;
      }
      parts.push(String(index));
      current = parent;
    }
    if (current !== root) {
      return null;
    }
    return parts.reverse().join(".");
  }

  function pathToNode(root, path) {
    if (!path) {
      return root;
    }
    const indexes = path.split(".").map((part) => Number(part));
    let current = root;
    for (const index of indexes) {
      if (!Number.isInteger(index) || index < 0 || !current?.childNodes?.[index]) {
        return null;
      }
      current = current.childNodes[index];
    }
    return current;
  }

  function serializeRange(range) {
    const startPath = nodeToPath(contentSection, range.startContainer);
    const endPath = nodeToPath(contentSection, range.endContainer);
    if (startPath === null || endPath === null) {
      return null;
    }
    return {
      startPath,
      startOffset: range.startOffset,
      endPath,
      endOffset: range.endOffset,
      anchorY: range.getBoundingClientRect().top + window.scrollY
    };
  }

  function rangeFromStored(highlight) {
    const startNode = pathToNode(contentSection, highlight.startPath);
    const endNode = pathToNode(contentSection, highlight.endPath);
    if (!startNode || !endNode) {
      return null;
    }
    const range = document.createRange();
    try {
      range.setStart(startNode, highlight.startOffset ?? 0);
      range.setEnd(endNode, highlight.endOffset ?? 0);
    } catch {
      return null;
    }
    return range.collapsed ? null : range;
  }

  function findTextCandidates(text) {
    const normalized = normalizeText(text);
    if (!normalized) {
      return [];
    }

    const candidates = [];
    const walker = document.createTreeWalker(contentSection, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue || "";
      if (value) {
        let start = value.indexOf(normalized);
        while (start !== -1) {
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + normalized.length);
          const rect = range.getBoundingClientRect();
          candidates.push({
            range,
            anchorY: rect.top + window.scrollY
          });
          start = value.indexOf(normalized, start + normalized.length);
        }
      }
      node = walker.nextNode();
    }
    return candidates;
  }

  function pickClosestCandidate(candidates, anchorY) {
    if (!candidates.length) {
      return null;
    }
    if (!Number.isFinite(anchorY)) {
      return candidates[0];
    }

    let best = candidates[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const distance = Math.abs(candidate.anchorY - anchorY);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  }

  function unwrapMarks() {
    const marks = contentSection.querySelectorAll("mark.reader-highlight");
    for (const mark of marks) {
      const parent = mark.parentNode;
      if (!parent) {
        continue;
      }
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    }
    contentSection.normalize();
  }

  function paintRange(range, highlightId) {
    const mark = document.createElement("mark");
    mark.className = "reader-highlight";
    mark.dataset.highlightId = highlightId;
    try {
      range.surroundContents(mark);
      return;
    } catch {
      const fragment = range.extractContents();
      mark.appendChild(fragment);
      range.insertNode(mark);
    }
  }

  function applyHighlights() {
    unwrapMarks();
    for (const highlight of highlights) {
      let range = rangeFromStored(highlight);
      if (!range) {
        const candidates = findTextCandidates(highlight.text);
        const picked = pickClosestCandidate(candidates, highlight.anchorY);
        range = picked?.range || null;
      }
      if (!range) {
        continue;
      }
      paintRange(range, highlight.id);
    }
  }

  function persistHighlights() {
    saveHighlights();
    applyHighlights();
    renderList();
  }

  function upsertHighlight(next) {
    const text = normalizeText(next.text);
    if (!text) {
      return;
    }

    const now = new Date().toISOString();
    const existingIndex = highlights.findIndex((item) => normalizeText(item.text) === text);
    if (existingIndex === -1) {
      highlights.push({
        id: next.id || makeId(),
        text,
        createdAt: now,
        updatedAt: now,
        startPath: next.startPath || "",
        startOffset: Number.isInteger(next.startOffset) ? next.startOffset : 0,
        endPath: next.endPath || "",
        endOffset: Number.isInteger(next.endOffset) ? next.endOffset : 0,
        anchorY: Number.isFinite(next.anchorY) ? next.anchorY : null
      });
      persistHighlights();
      return;
    }

    const existing = highlights[existingIndex];
    highlights[existingIndex] = {
      ...existing,
      text,
      updatedAt: now,
      startPath: next.startPath || existing.startPath || "",
      startOffset: Number.isInteger(next.startOffset) ? next.startOffset : existing.startOffset,
      endPath: next.endPath || existing.endPath || "",
      endOffset: Number.isInteger(next.endOffset) ? next.endOffset : existing.endOffset,
      anchorY: Number.isFinite(next.anchorY) ? next.anchorY : existing.anchorY
    };
    persistHighlights();
  }

  function deleteHighlight(id) {
    highlights = highlights.filter((item) => item.id !== id);
    persistHighlights();
  }

  function buildXText(text) {
    return '"' + normalizeText(text) + '"\\n\\n' + articleTitle + "\\n" + articleUrl;
  }

  function openXQuote(text) {
    const intent = new URL("https://twitter.com/intent/tweet");
    intent.searchParams.set("text", buildXText(text));
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
  }

  const root = document.createElement("div");
  root.className = "reader-highlight-ui-root";
  root.setAttribute(uiAttr, "true");
  root.setAttribute("data-tts-exclude", "true");
  document.body.appendChild(root);

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "reader-highlight-fab";
  openButton.textContent = "ハイライト";
  openButton.setAttribute(uiAttr, "true");
  openButton.setAttribute("data-tts-exclude", "true");
  openButton.setAttribute("aria-label", "ハイライト一覧を開く");
  root.appendChild(openButton);

  const overlay = document.createElement("div");
  overlay.className = "reader-highlight-overlay";
  overlay.hidden = true;
  overlay.setAttribute(uiAttr, "true");
  overlay.setAttribute("data-tts-exclude", "true");
  root.appendChild(overlay);

  const registerButton = document.createElement("button");
  registerButton.type = "button";
  registerButton.className = "reader-highlight-register";
  registerButton.textContent = "登録";
  registerButton.hidden = true;
  registerButton.setAttribute(uiAttr, "true");
  registerButton.setAttribute("data-tts-exclude", "true");
  registerButton.setAttribute("aria-label", "選択したテキストをハイライトに登録");
  root.appendChild(registerButton);

  const modal = document.createElement("section");
  modal.className = "reader-highlight-modal";
  modal.hidden = true;
  modal.setAttribute(uiAttr, "true");
  modal.setAttribute("data-tts-exclude", "true");
  modal.setAttribute("aria-label", "登録済みハイライト");
  root.appendChild(modal);

  const header = document.createElement("header");
  header.className = "reader-highlight-modal-header";
  header.setAttribute(uiAttr, "true");
  modal.appendChild(header);

  const title = document.createElement("h2");
  title.textContent = "登録済みハイライト";
  title.setAttribute(uiAttr, "true");
  header.appendChild(title);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "閉じる";
  closeButton.className = "reader-highlight-close";
  closeButton.setAttribute(uiAttr, "true");
  closeButton.setAttribute("data-tts-exclude", "true");
  header.appendChild(closeButton);

  const list = document.createElement("ul");
  list.className = "reader-highlight-list";
  list.setAttribute(uiAttr, "true");
  modal.appendChild(list);

  function setModalOpen(isOpen) {
    overlay.hidden = !isOpen;
    modal.hidden = !isOpen;
    document.body.classList.toggle("reader-highlight-modal-open", isOpen);
  }

  function clearPendingHighlight() {
    pendingHighlight = null;
    registerButton.hidden = true;
  }

  function showRegisterButton() {
    registerButton.hidden = false;
  }

  function renderList() {
    list.textContent = "";
    if (!highlights.length) {
      const item = document.createElement("li");
      item.className = "reader-highlight-empty";
      item.textContent = "ハイライトはまだありません。本文をドラッグして登録できます。";
      item.setAttribute(uiAttr, "true");
      list.appendChild(item);
      openButton.textContent = "ハイライト (0)";
      openButton.classList.remove("reader-highlight-fab-active");
      return;
    }

    const ordered = [...highlights].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (const itemData of ordered) {
      const item = document.createElement("li");
      item.className = "reader-highlight-item";
      item.setAttribute(uiAttr, "true");

      const quote = document.createElement("p");
      quote.className = "reader-highlight-text";
      quote.textContent = itemData.text;
      quote.setAttribute(uiAttr, "true");
      item.appendChild(quote);

      const actions = document.createElement("div");
      actions.className = "reader-highlight-actions";
      actions.setAttribute(uiAttr, "true");

      const xButton = document.createElement("button");
      xButton.type = "button";
      xButton.className = "reader-highlight-action";
      xButton.textContent = "Xで引用";
      xButton.setAttribute(uiAttr, "true");
      xButton.setAttribute("data-tts-exclude", "true");
      xButton.addEventListener("click", () => {
        openXQuote(itemData.text);
      });
      actions.appendChild(xButton);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "reader-highlight-action reader-highlight-delete";
      removeButton.textContent = "削除";
      removeButton.setAttribute(uiAttr, "true");
      removeButton.setAttribute("data-tts-exclude", "true");
      removeButton.addEventListener("click", () => {
        deleteHighlight(itemData.id);
      });
      actions.appendChild(removeButton);

      item.appendChild(actions);
      list.appendChild(item);
    }

    openButton.textContent = "ハイライト (" + highlights.length + ")";
    openButton.classList.add("reader-highlight-fab-active");
  }

  openButton.addEventListener("click", () => setModalOpen(modal.hidden));
  closeButton.addEventListener("click", () => setModalOpen(false));
  overlay.addEventListener("click", () => setModalOpen(false));
  registerButton.addEventListener("click", () => {
    if (!pendingHighlight) {
      return;
    }
    upsertHighlight(pendingHighlight);
    clearPendingHighlight();
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      setModalOpen(false);
    }
    if (event.key === "Escape") {
      clearPendingHighlight();
    }
  });

  const updatePendingHighlightFromSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }
    const selectedText = normalizeText(selection.toString());
    if (!selectedText) {
      return;
    }

    const range = selection.getRangeAt(0).cloneRange();
    if (isUiNode(range.commonAncestorContainer)) {
      return;
    }
    if (!isInsideContent(range.startContainer) || !isInsideContent(range.endContainer)) {
      return;
    }

    const anchorY = range.getBoundingClientRect().top + window.scrollY;
    const serialized = serializeRange(range);
    const candidates = findTextCandidates(selectedText);
    const picked = pickClosestCandidate(candidates, anchorY);
    const normalizedSerialized = picked?.range ? serializeRange(picked.range) : null;
    const finalSerialized = normalizedSerialized || serialized;
    if (!finalSerialized) {
      return;
    }

    pendingHighlight = {
      text: selectedText,
      ...finalSerialized,
      anchorY
    };
    showRegisterButton();
  };

  document.addEventListener("mouseup", updatePendingHighlightFromSelection);
  document.addEventListener("touchend", () => {
    window.setTimeout(updatePendingHighlightFromSelection, 0);
  });

  let selectionChangeTimer = null;
  document.addEventListener("selectionchange", () => {
    if (selectionChangeTimer !== null) {
      window.clearTimeout(selectionChangeTimer);
    }
    selectionChangeTimer = window.setTimeout(() => {
      selectionChangeTimer = null;
      updatePendingHighlightFromSelection();
    }, 80);
  });

  document.addEventListener("mousedown", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("[" + uiAttr + "]")) {
      return;
    }
    clearPendingHighlight();
  });
  document.addEventListener("touchstart", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("[" + uiAttr + "]")) {
      return;
    }
    clearPendingHighlight();
  });

  applyHighlights();
  renderList();
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
        <section id="reader-content">${article.contentHtml}</section>
      </article>
    </main>
    ${translationScript}
    ${scrollPersistenceScript}
    ${highlightScript}
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

function isTranslateContext(requestUrl, requestHeaders) {
  const referer = requestHeaders.get("referer") || "";
  const origin = requestHeaders.get("origin") || "";
  const forwardedHost = requestHeaders.get("x-forwarded-host") || "";

  return (
    requestUrl.hostname.endsWith(".translate.goog") ||
    requestUrl.searchParams.has("_x_tr_sl") ||
    requestUrl.searchParams.has("_x_tr_tl") ||
    requestUrl.searchParams.has("_x_tr_hl") ||
    referer.includes(".translate.goog/") ||
    origin.includes(".translate.goog") ||
    forwardedHost.includes(".translate.goog")
  );
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const skipLanguageRedirect = requestUrl.searchParams.get("__skip_lang_redirect") === "1";
  const translateContext =
    isTranslateContext(requestUrl, context.request.headers) || skipLanguageRedirect;

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

  if (source === "path" && !translateContext) {
    const isRawUrlPath =
      requestUrl.pathname.startsWith("/http://") || requestUrl.pathname.startsWith("/https://");
    if (isRawUrlPath) {
      const normalizedPath = `/${encodeURIComponent(targetUrl)}`;
      const normalizedUrl = new URL(normalizedPath, requestUrl.origin);
      return Response.redirect(normalizedUrl.toString(), 302);
    }
  }

  const result = await extractArticleFromUrl(targetUrl, {
    prioritizeLanguageRedirect: !translateContext
  });
  if (!result.ok) {
    return renderErrorPage(result.status, "記事を取得できませんでした", result.message);
  }

  const appArticleUrl = new URL(`/${encodeURIComponent(targetUrl)}`, requestUrl.origin).toString();
  if (result.skippedExtraction && !translateContext) {
    const articleUrlForTranslate = new URL(appArticleUrl);
    articleUrlForTranslate.searchParams.set("__skip_lang_redirect", "1");
    const earlyTranslationUrl = buildGoogleTranslateUrl(articleUrlForTranslate.toString());
    return Response.redirect(earlyTranslationUrl, 302);
  }

  const translationUrl =
    result.article.language !== "ja" && result.article.language !== "unknown" && !translateContext
      ? buildGoogleTranslateUrl(appArticleUrl)
      : null;

  return html(renderArticlePage({ article: result.article, translationUrl }));
}
