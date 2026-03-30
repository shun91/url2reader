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

export function pickHomeRedirectPath(pathname, search = "") {
  const searchParams = new URLSearchParams(search || "");
  const queryValue = searchParams.get("url");
  if (queryValue && isSupportedHttpUrl(queryValue)) {
    return `/${encodeURIComponent(queryValue)}`;
  }

  if (pathname && (pathname.startsWith("/http://") || pathname.startsWith("/https://"))) {
    const rawUrl = pathname.slice(1);
    const normalizedPath = `/${encodeURIComponent(rawUrl)}`;
    if (pathname !== normalizedPath) {
      return normalizedPath;
    }
  }

  return null;
}

export function isSupportedHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
