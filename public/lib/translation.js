export function resolveTranslationUrl(data) {
  if (!data || typeof data.translationUrl !== "string" || !data.translationUrl) {
    return null;
  }

  try {
    const parsed = new URL(data.translationUrl);
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
