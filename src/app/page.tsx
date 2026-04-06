import Icon from "@hackclub/icons";
import { getTranslations } from "next-intl/server";

import { Input } from "@/components/ui/input";

export default async function LoginPage() {
  const t = await getTranslations();

  return (
    <main className="page-shell flex items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col">
        <h1 className="text-4xl font-bold text-white">{t("app.login.title")}</h1>
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
            className="h-auto rounded-none border-0 bg-transparent px-0 py-0 text-base text-white shadow-none placeholder:text-accent focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
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
