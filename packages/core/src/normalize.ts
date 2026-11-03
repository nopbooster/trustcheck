const URL_LIKE = /^[a-z][a-z0-9+.-]*:\/\//i;

export function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Emails and URLs are case-insensitive; paths and other values are not. */
export function isCaseInsensitive(value: string): boolean {
  return value.includes("@") || URL_LIKE.test(value);
}

export function normalize(value: string): string {
  const trimmed = value.trim();
  return isCaseInsensitive(trimmed) ? trimmed.toLowerCase() : trimmed;
}

/** Does `value` appear in `text`, using the same normalization rules? */
export function appearsIn(value: string, text: string): boolean {
  const needle = normalize(value);
  if (needle === "") return false;
  return isCaseInsensitive(needle) ? text.toLowerCase().includes(needle) : text.includes(needle);
}
