import { getRequestConfig } from "next-intl/server";

import { defaultLocale, loadMessages } from "@/i18n/load-messages";

export default getRequestConfig(async () => ({
  locale: defaultLocale,
  messages: await loadMessages(),
}));
