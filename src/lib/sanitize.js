import { parseHTML } from "linkedom";

const ALLOWED_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "blockquote"]);

function copySanitizedNode(node, outputDocument, parent) {
  if (node.nodeType === 3) {
    parent.appendChild(outputDocument.createTextNode(node.textContent ?? ""));
    return;
  }

  if (node.nodeType !== 1) return;

  const tagName = node.tagName.toLowerCase();

  if (ALLOWED_TAGS.has(tagName)) {
    const element = outputDocument.createElement(tagName);

    for (const child of node.childNodes) {
      copySanitizedNode(child, outputDocument, element);
    }

    const hasRenderableText = element.textContent?.trim().length;
    const hasChildElements = element.children.length > 0;

    if (hasRenderableText || hasChildElements) {
      parent.appendChild(element);
    }

    return;
  }

  for (const child of node.childNodes) {
    copySanitizedNode(child, outputDocument, parent);
  }
}

export function sanitizeArticleHtml(html) {
  const source = parseHTML(`<div id="source-root">${html}</div>`).document;
  const sourceRoot = source.querySelector("#source-root");
  const output = parseHTML('<div id="output-root"></div>').document;
  const root = output.querySelector("#output-root");

  for (const child of sourceRoot.childNodes) {
    copySanitizedNode(child, output, root);
  }

  return root.innerHTML;
}
