import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { cache } from "react";
import { parse } from "yaml";

export const defaultLocale = "en-US";

const localeFilePath = path.join(process.cwd(), "src/locales/en.yml");

export const loadMessages = cache(async () => {
  const file = await readFile(localeFilePath, "utf8");
  const messages = parse(file) as unknown;

  if (messages === null || typeof messages !== "object" || Array.isArray(messages)) {
    throw new Error("Locale file must contain a top-level object.");
  }

  return messages;
});
