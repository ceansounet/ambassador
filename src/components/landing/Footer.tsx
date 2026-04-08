import Image from "next/image";
import orphHappy from "@/assets/landing/emotes/orph-happy.png";
import hcRounded from "@/assets/landing/hc-rounded.svg";

import Sep from "./Sep";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("landing");

  return (
    <footer className="bg-neutral-900 mt-8 relative text-white">
      <Sep className="absolute top-0 -translate-y-1/2 inset-x-0" />
      {/* TODO: add variation with closed eyes on hover */}
      <Image
        src={orphHappy}
        alt=""
        role="presentation"
        className="h-32 left-1/2 absolute w-auto top-0 -translate-x-1/2 -translate-y-1/2"
      />
      <div className="text-center p-12 pt-16">
        <h2 className="text-5xl font-jersey">{t("footer.cta")}</h2>
        <button
          type="button"
          className="mt-6 h-36 px-20 rounded-full hover:bg-rose-700 transition hover:scale-105 bg-primary corner-squircle"
        >
          <span className="font-jersey text-7xl uppercase">{t("apply")}</span>
        </button>
        <p className="mt-6 italic text-neutral-400">{t("footer.cta-sub")}</p>
      </div>
      <div className="px-12 pb-6 flex items-center">
        <a href="https://hackclub.com" target="_blank" rel="noreferrer">
          <Image src={hcRounded} alt="Hack Club" className="h-8 w-auto" />
        </a>
        <p className="flex-1 text-right text-xs text-neutral-500">
          {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
