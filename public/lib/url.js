export function pathToTargetUrl(pathname) {
  if (!pathname || pathname === "/") return null;

  const raw = pathname.startsWith("/") ? pathname.slice(1) : pathname;

  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  if (!isSupportedHttpUrl(decoded)) return null;
  return decoded;
}

export function isSupportedHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
