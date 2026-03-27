function normalizeLanguageCode(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim().toLowerCase().replace(/_/g, "-");
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("ja")) {
    return "ja";
  }

  const matched = normalized.match(/^[a-z]{2,3}/);
  if (!matched) {
    return null;
  }

  return matched[0];
}

function pickLanguageFromMetadata(document) {
  if (!document) {
    return null;
  }

  const htmlLang = document.documentElement?.getAttribute("lang");
  const normalizedHtmlLang = normalizeLanguageCode(htmlLang);
  if (normalizedHtmlLang) {
    return normalizedHtmlLang;
  }

  const metaSelectors = [
    'meta[property="og:locale"]',
    'meta[http-equiv="content-language"]',
    'meta[name="language"]'
  ];

  for (const selector of metaSelectors) {
    const element = document.querySelector(selector);
    const content = element?.getAttribute("content");
    const normalized = normalizeLanguageCode(content);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function pickLanguageFromText(textContent) {
  if (!textContent || typeof textContent !== "string") {
    return "unknown";
  }

  const text = textContent.trim();
  if (text.length < 40) {
    return "unknown";
  }

  let japaneseCount = 0;
  let latinCount = 0;
  let letterCount = 0;

  for (const char of text) {
    if (/\p{Letter}/u.test(char)) {
      letterCount += 1;
    }

    if (/[\u3040-\u30ff\u3400-\u9fff]/u.test(char)) {
      japaneseCount += 1;
      continue;
    }

    if (/[A-Za-z]/.test(char)) {
      latinCount += 1;
    }
  }

  if (letterCount < 20) {
    return "unknown";
  }

  const japaneseRatio = japaneseCount / letterCount;
  const latinRatio = latinCount / letterCount;

  if (japaneseCount >= 20 && japaneseRatio >= 0.25) {
    return "ja";
  }

  if (latinCount >= 20 && latinRatio >= 0.5) {
    return "en";
  }

  return "unknown";
}

export function detectArticleLanguage({ document, textContent }) {
  const metadataLanguage = pickLanguageFromMetadata(document);
  if (metadataLanguage) {
    return metadataLanguage;
  }

  return pickLanguageFromText(textContent);
}

export function buildGoogleTranslateUrl(targetUrl) {
  const translateUrl = new URL("https://translate.google.com/translate");
  translateUrl.searchParams.set("sl", "auto");
  translateUrl.searchParams.set("tl", "ja");
  translateUrl.searchParams.set("u", targetUrl);
  return translateUrl.toString();
}
