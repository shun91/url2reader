export function normalizeSelectedText(value) {
  return String(value || "").trim();
}

export function shouldRegisterHighlight({
  rawText,
  isCollapsed,
  isInsideArticle,
  isInsideUi
}) {
  const text = normalizeSelectedText(rawText);
  if (isCollapsed) {
    return false;
  }
  if (!text) {
    return false;
  }
  if (!isInsideArticle) {
    return false;
  }
  if (isInsideUi) {
    return false;
  }
  return true;
}

export function upsertHighlight(highlights, incoming, nowIso) {
  const next = Array.isArray(highlights) ? [...highlights] : [];
  const text = normalizeSelectedText(incoming?.text);
  if (!text) {
    return next;
  }

  const timestamp = nowIso || new Date().toISOString();
  const existingIndex = next.findIndex((item) => normalizeSelectedText(item?.text) === text);
  if (existingIndex === -1) {
    next.push({
      id: incoming.id,
      text,
      createdAt: incoming.createdAt || timestamp,
      updatedAt: timestamp,
      startPath: incoming.startPath || null,
      startOffset: Number.isInteger(incoming.startOffset) ? incoming.startOffset : null,
      endPath: incoming.endPath || null,
      endOffset: Number.isInteger(incoming.endOffset) ? incoming.endOffset : null,
      anchorY: Number.isFinite(incoming.anchorY) ? incoming.anchorY : null
    });
    return next;
  }

  const existing = next[existingIndex];
  next[existingIndex] = {
    ...existing,
    text,
    updatedAt: timestamp,
    startPath: incoming.startPath || existing.startPath || null,
    startOffset: Number.isInteger(incoming.startOffset) ? incoming.startOffset : existing.startOffset,
    endPath: incoming.endPath || existing.endPath || null,
    endOffset: Number.isInteger(incoming.endOffset) ? incoming.endOffset : existing.endOffset,
    anchorY: Number.isFinite(incoming.anchorY) ? incoming.anchorY : existing.anchorY
  };
  return next;
}

export function buildXIntentText({ text, title, url }) {
  const quote = normalizeSelectedText(text);
  const safeTitle = normalizeSelectedText(title) || "無題";
  const safeUrl = normalizeSelectedText(url);
  return `"${quote}"\n\n${safeTitle}\n${safeUrl}`;
}

export function pickClosestRangeCandidate(candidates, anchorY) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  if (!Number.isFinite(anchorY)) {
    return candidates[0];
  }

  let best = candidates[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const y = Number(candidate?.anchorY);
    const distance = Number.isFinite(y) ? Math.abs(y - anchorY) : Number.POSITIVE_INFINITY;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}
