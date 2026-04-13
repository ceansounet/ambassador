export function formatDate(value: string | null | undefined, locale: string) {
  const trimmedValue = value?.trim() ?? "";

  if (trimmedValue === "") {
    return null;
  }

  return new Date(trimmedValue).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined, locale: string) {
  const trimmedValue = value?.trim() ?? "";

  if (trimmedValue === "") {
    return null;
  }

  return new Date(trimmedValue).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function joinNonEmpty(...parts: Array<string | null | undefined>) {
  const value = parts
    .filter((part): part is string => part !== null && part !== undefined && part.trim().length > 0)
    .join(", ");

  return value !== "" ? value : null;
}
