import Image from "next/image";
import hcRounded from "@/assets/landing/hc-rounded.svg";

import { useTranslations } from "next-intl";
import Link from "next/link";

export default function Footer() {
  const t = useTranslations("landing");

  return (
    <footer className="max-w-7xl mx-auto">
      <div className="text-center p-12 pt-16">
        <h2 className="text-4xl md:text-5xl font-jersey">{t("footer.cta")}</h2>
        <Link
          href="/apply"
          className="mt-6 flex items-center max-w-fit mx-auto h-22 md:h-28 px-10 md:px-14 rounded-full hover:bg-rose-700 transition hover:scale-105 bg-primary corner-squircle"
        >
          <span className="font-jersey text-5xl md:text-6xl uppercase">
            {t("apply")}
          </span>
        </Link>
      </div>
      <div className="px-12 pb-6 gap-4 flex items-center">
        <a href="https://hackclub.com" target="_blank" rel="noreferrer">
          <Image
            src={hcRounded}
            alt="Hack Club"
            className="h-8 w-auto"
            sizes="2rem"
            unoptimized
          />
        </a>
        <p className="flex-1 text-pretty leading-snug text-right text-xs text-neutral-500">
          {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
