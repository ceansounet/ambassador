import Image from "next/image";
import orphHappy from "@/assets/landing/emotes/orph-happy.png";

import Link from "next/link";

import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";

export default async function Header() {
  const session = await getSession();
  const t = await getTranslations("landing");

  return (
    <header className="px-12 mx-auto max-w-7xl pt-6 flex items-center">
      <Image
        src={orphHappy}
        alt=""
        role="presentation"
        className="h-12 w-auto"
        placeholder="blur"
        sizes="3rem"
      />
      <div className="flex-1 min-w-0" />
      <Link
        href={session ? "/dashboard" : "/auth"}
        className="font-medium hover:text-black hover:underline underline-offset-2 transition hover:scale-105 text-neutral-600 text-sm"
      >
        {session ? t("dashboard") : t("log-in")}
      </Link>
    </header>
  );
}
