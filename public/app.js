import { pathToTargetUrl } from "/lib/url.js";

const articleEl = document.getElementById("article");
const statusEl = document.getElementById("status");

function setStatus(message) {
  statusEl.textContent = message;
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
  setStatus("");
}

run().catch(() => {
  setStatus("処理中にエラーが発生しました。");
});
