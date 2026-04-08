import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { Tracker } from "@/components/tracker";
import { instrumentSans, jersey25 } from "@/lib/fonts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.metadata");

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <html
      lang={locale}
      className={`${instrumentSans.variable} ${jersey25.variable}`}
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Tracker />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
