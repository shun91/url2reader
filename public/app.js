import { pathToTargetUrl } from "/lib/url.js";

const articleEl = document.getElementById("article");
const statusEl = document.getElementById("status");
const scrollStorageKey = `scroll-position:${window.location.pathname}`;

function setStatus(message) {
  statusEl.textContent = message;
}

function restoreScrollPosition() {
  const rawValue = localStorage.getItem(scrollStorageKey);
  const savedY = Number(rawValue);

  if (!Number.isFinite(savedY) || savedY < 0) {
    return;
  }

  // 記事描画でレイアウトが確定した後に復元する
  requestAnimationFrame(() => {
    window.scrollTo(0, savedY);
  });
}

function setupScrollPositionPersistence() {
  let ticking = false;

  const persist = () => {
    localStorage.setItem(scrollStorageKey, String(window.scrollY));
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

  // リロード直前の位置も取りこぼさないように最終保存する
  window.addEventListener("beforeunload", () => {
    localStorage.setItem(scrollStorageKey, String(window.scrollY));
  });
}

function renderArticle(title, contentHtml) {
  articleEl.innerHTML = "";

  const h1 = document.createElement("h1");
  h1.textContent = title || "無題";
  articleEl.appendChild(h1);

  const contentContainer = document.createElement("section");
  contentContainer.innerHTML = contentHtml;
  articleEl.appendChild(contentContainer);
}

async function run() {
  const targetUrl = pathToTargetUrl(window.location.pathname);

  if (!targetUrl) {
    setStatus("URLを指定してください。例: /https://example.com/article");
    return;
  }

  setStatus("本文を抽出中...");

  const endpoint = `/api/extract?url=${encodeURIComponent(targetUrl)}`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    setStatus("記事を取得できませんでした。");
    return;
  }

  const data = await response.json();
  renderArticle(data.title, data.contentHtml);
  restoreScrollPosition();
  setStatus("");
}

setupScrollPositionPersistence();

run().catch(() => {
  setStatus("処理中にエラーが発生しました。");
});
