import Icon from "@hackclub/icons";
import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Input } from "@/components/ui/input";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("app.login.metadata.title");
}

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const t = await getTranslations();

  return (
    <main className="page-shell flex items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold text-white">{t("app.login.title")}</h1>
          <Image
            src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f44b/emoji.svg"
            alt={t("app.login.waving-hand-alt")}
            width={40}
            height={40}
            className="h-10 w-10"
          />
        </div>
        <p className="mt-1 text-lg leading-tight text-white">
          <strong>{t("app.login.login")}</strong>{" "}
          <span className="font-normal">{t("app.login.or")}</span>{" "}
          <strong>{t("app.login.sign-up")}</strong>?
        </p>

        <div className="mt-5 flex h-14 w-full items-stretch overflow-hidden rounded-lg bg-card">
          <div className="flex shrink-0 items-center pl-4 pr-2 text-white">
            <Icon glyph="person" size={20} fill="currentColor" />
          </div>
          <Input
            type="email"
            placeholder={t("app.login.email-placeholder")}
            className="h-auto rounded-none border-0 bg-transparent px-0 py-0 text-base text-white shadow-none placeholder:text-foreground focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          />
          <button className="flex w-14 shrink-0 cursor-pointer items-center justify-center bg-primary text-white">
            <span className="text-4xl font-bold leading-none">&rsaquo;</span>
          </button>
        </div>

        <p className="mt-3 text-sm text-right">
          <span className="text-white">{t("app.login.alt-login-prefix")}</span>{" "}
          <a
            href="/api/auth/login"
            className="!text-primary !underline hover:!opacity-80"
          >
            {t("app.login.alt-login-link")}
          </a>
        </p>
      </div>
    </main>
  );
}
