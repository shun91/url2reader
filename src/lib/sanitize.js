import { parseHTML } from "linkedom";

const ALLOWED_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "blockquote",
  "pre",
  "code",
  "br",
  "hr",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "sup",
  "sub",
  "kbd",
  "samp",
  "mark",
  "small",
  "a",
  "figure",
  "figcaption",
  "img",
  "picture",
  "source"
]);

const ALLOWED_ATTRIBUTES_BY_TAG = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "srcset", "alt", "title", "width", "height", "loading", "decoding"]),
  source: new Set(["srcset", "sizes", "type", "media"]),
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
  figure: new Set([]),
  figcaption: new Set([]),
  picture: new Set([])
};

const LAZY_SRC_CANDIDATES = ["data-src", "data-original", "data-lazy-src"];
const LAZY_SRCSET_CANDIDATES = ["data-srcset"];

function isSafeUrl(urlString) {
  return /^https?:\/\//i.test(urlString) || /^data:image\//i.test(urlString);
}

function resolveUrl(rawValue, baseUrl) {
  if (!rawValue || !rawValue.trim()) {
    return null;
  }

  const trimmed = rawValue.trim();
  if (/^data:image\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const resolved = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    if (!isSafeUrl(resolved.href)) {
      return null;
    }
    return resolved.href;
  } catch {
    return null;
  }
}

function sanitizeSrcset(rawValue, baseUrl) {
  if (!rawValue || !rawValue.trim()) {
    return null;
  }

  const entries = rawValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [urlPart, descriptor] = part.split(/\s+/, 2);
      const resolvedUrl = resolveUrl(urlPart, baseUrl);
      if (!resolvedUrl) {
        return null;
      }
      return descriptor ? `${resolvedUrl} ${descriptor}` : resolvedUrl;
    })
    .filter(Boolean);

  if (!entries.length) {
    return null;
  }

  return entries.join(", ");
}

function getAttributeWithFallback(node, primaryName, fallbackNames = []) {
  const directValue = node.getAttribute(primaryName);
  if (directValue && directValue.trim()) {
    return directValue;
  }

  for (const fallbackName of fallbackNames) {
    const fallbackValue = node.getAttribute(fallbackName);
    if (fallbackValue && fallbackValue.trim()) {
      return fallbackValue;
    }
  }

  return null;
}

function sanitizeAttributeValue(tagName, attributeName, value, baseUrl) {
  if (!value) {
    return null;
  }

  if (attributeName === "href" || attributeName === "src") {
    return resolveUrl(value, baseUrl);
  }

  if (attributeName === "srcset") {
    return sanitizeSrcset(value, baseUrl);
  }

  if (attributeName === "width" || attributeName === "height") {
    return /^\d+$/.test(value.trim()) ? value.trim() : null;
  }

  if (attributeName === "colspan" || attributeName === "rowspan") {
    const normalized = value.trim();
    return /^[1-9]\d*$/.test(normalized) ? normalized : null;
  }

  if (attributeName === "loading") {
    const normalized = value.trim().toLowerCase();
    return normalized === "lazy" || normalized === "eager" ? normalized : null;
  }

  if (attributeName === "decoding") {
    const normalized = value.trim().toLowerCase();
    return normalized === "sync" || normalized === "async" || normalized === "auto"
      ? normalized
      : null;
  }

  if (attributeName === "alt" || attributeName === "title" || attributeName === "sizes" || attributeName === "type" || attributeName === "media") {
    return value;
  }

  return null;
}

function copySanitizedNode(node, outputDocument, parent, options) {
  if (node.nodeType === 3) {
    parent.appendChild(outputDocument.createTextNode(node.textContent ?? ""));
    return;
  }

  if (node.nodeType !== 1) return;

  const tagName = node.tagName.toLowerCase();

  if (ALLOWED_TAGS.has(tagName)) {
    const element = outputDocument.createElement(tagName);
    const allowedAttributes = ALLOWED_ATTRIBUTES_BY_TAG[tagName];

    if (allowedAttributes) {
      for (const attributeName of allowedAttributes) {
        const primaryValue =
          tagName === "img" && attributeName === "src"
            ? getAttributeWithFallback(node, "src", LAZY_SRC_CANDIDATES)
            : tagName === "img" && attributeName === "srcset"
              ? getAttributeWithFallback(node, "srcset", LAZY_SRCSET_CANDIDATES)
              : node.getAttribute(attributeName);

        const sanitizedValue = sanitizeAttributeValue(
          tagName,
          attributeName,
          primaryValue,
          options.baseUrl
        );

        if (sanitizedValue) {
          element.setAttribute(attributeName, sanitizedValue);
        }
      }
    }

    for (const child of node.childNodes) {
      copySanitizedNode(child, outputDocument, element, options);
    }

    const hasRenderableText = element.textContent?.trim().length;
    const hasChildElements = element.children.length > 0;
    const isImage = tagName === "img" && element.getAttribute("src");
    const isSource = tagName === "source" && element.getAttribute("srcset");
    const isVoidRenderable = tagName === "br" || tagName === "hr";

    if (hasRenderableText || hasChildElements || isImage || isSource || isVoidRenderable) {
      parent.appendChild(element);
    }

    return;
  }

  for (const child of node.childNodes) {
    copySanitizedNode(child, outputDocument, parent, options);
  }
}

export function sanitizeArticleHtml(html, options = {}) {
  const source = parseHTML(`<div id="source-root">${html}</div>`).document;
  const sourceRoot = source.querySelector("#source-root");
  const output = parseHTML('<div id="output-root"></div>').document;
  const root = output.querySelector("#output-root");

  for (const child of sourceRoot.childNodes) {
    copySanitizedNode(child, output, root, options);
  }

  return root.innerHTML;
}
