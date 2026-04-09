import Icon from "@hackclub/icons";
import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Input } from "@/components/ui/input";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import { getSession } from "@/lib/session";

import logoCentered from "@/assets/app/logo-centered.png";
import hackClub from "@/assets/landing/hc-rounded.svg";
import orphHappy from "@/assets/landing/emotes/orph-happy.png";

import { ArrowRightIcon } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("app.login.metadata.title");
}

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const t = await getTranslations();

  return (
    <main className="page-shell flex flex-col items-center justify-center px-6">
      <Image
        src={logoCentered}
        alt="Hack Club Ambassadors"
        className="h-16 w-auto mb-4"
      />
      <div className="flex w-full max-w-md bg-white border border-neutral-300 p-8 flex-col">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-white">
            {t("app.login.title")}
          </h1>
          <Image
            src={orphHappy}
            alt=""
            width={48}
            height={48}
            className="size-12 -my-2"
          />
        </div>
        <p className="mt-1 text-neutral-600">{t("app.login.desc")}</p>

        <div className="mt-4 flex gap-3">
          <div className="relative h-12 w-full rounded-sm bg-card">
            <Icon
              glyph="email"
              fill="currentColor"
              className="absolute size-5 top-3.5 left-3 pointer-events-none"
            />
            <Input
              type="email"
              placeholder={t("app.login.email-placeholder")}
              className="h-full rounded-none border-0 bg-transparent pl-10 py-0 text-base text-white shadow-none placeholder:text-foreground focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
          <button className="flex size-12 flex-none rounded-sm cursor-pointer items-center justify-center bg-primary text-white">
            <ArrowRightIcon className="size-5" strokeWidth={2.5} />
            <span className="sr-only">Next</span>
          </button>
        </div>
      </div>
      <a
        href="/api/auth/login"
        className="mt-4 flex h-12 w-full max-w-md items-center justify-center gap-3 bg-primary text-white"
      >
        <Image src={hackClub} alt="" className="size-6 w-auto drop-shadow-sm" />
        <span className="font-bold">{t("app.login.alt-login-link")}</span>
      </a>
    </main>
  );
}
