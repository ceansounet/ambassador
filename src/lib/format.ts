function normalizeDateValue(value: string | number | Date | null | undefined) {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue === "" ? null : trimmedValue;
  }

  if (typeof value === "number" || value instanceof Date) {
    return value;
  }

  return null;
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

export function formatDate(value: string | number | Date | null | undefined, locale: string) {
  const normalizedValue = normalizeDateValue(value);

  if (normalizedValue === null) {
    return null;
  }

  const date = new Date(normalizedValue);

  if (!isValidDate(date)) {
    return null;
  }

  return date.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | number | Date | null | undefined, locale: string) {
  const normalizedValue = normalizeDateValue(value);

  if (normalizedValue === null) {
    return null;
  }

  const date = new Date(normalizedValue);

  if (!isValidDate(date)) {
    return null;
  }

  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTimeInTimeZone(
  value: string | number | Date | null | undefined,
  locale: string,
  timeZone: string | null | undefined,
) {
  const normalizedValue = normalizeDateValue(value);

  if (normalizedValue === null || timeZone == null || timeZone.trim() === "") {
    return null;
  }

  const date = new Date(normalizedValue);

  if (!isValidDate(date)) {
    return null;
  }

  try {
    return date.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    });
  } catch {
    return null;
  }
}

export function joinNonEmpty(...parts: Array<string | null | undefined>) {
  const value = parts
    .filter((part): part is string => part !== null && part !== undefined && part.trim().length > 0)
    .join(", ");

  return value !== "" ? value : null;
}
