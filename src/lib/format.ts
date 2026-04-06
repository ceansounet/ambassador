export function formatDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function joinNonEmpty(...parts: Array<string | null | undefined>) {
  const value = parts.filter((part): part is string => !!part && part.trim().length > 0).join(", ");

  return value || null;
}
