import Image from "next/image";
import orphHappy from "@/assets/landing/emotes/orph-happy.png";

import Link from "next/link";

import { useTranslations } from "next-intl";

export default function Header() {
  const t = useTranslations("landing");

  return (
    <header className="px-12 pt-6 flex items-center">
      <Image
        src={orphHappy}
        alt=""
        role="presentation"
        className="h-12 w-auto"
      />
      <div className="flex-1 min-w-0"></div>
      <Link
        href="/auth"
        className="font-medium hover:text-black hover:underline underline-offset-2 transition hover:scale-105 text-neutral-600 text-sm"
      >
        {t("log-in")}
      </Link>
    </header>
  );
}
