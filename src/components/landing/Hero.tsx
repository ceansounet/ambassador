import Image from "next/image";

import ambassador from "@/assets/landing/logo/ambassador.png";
import become from "@/assets/landing/logo/become.png";
import becomeArrow from "@/assets/landing/logo/become-arrow.png";
import summer26Bg from "@/assets/landing/logo/summer-26-bg.png";
import summer26Fg from "@/assets/landing/logo/summer-26-fg.png";
import highlight from "@/assets/landing/highlight.svg";
import flagHoldingText from "@/assets/landing/flagholdingtext.png";

import { useTranslations } from "next-intl";
import Link from "next/link";

export default function Hero() {
  const t = useTranslations("landing");
  return (
    <div className="p-12 max-w-7xl mx-auto overflow-clip max-lg:pb-0 flex gap-x-8 max-lg:flex-col items-center justify-between">
      <div className="max-lg:text-center">
        <div className="max-w-fit max-lg:mx-auto">
          <div className="relative max-w-fit">
            <Image
              src={become}
              alt="Become a"
              className="h-4 mb-2 -rotate-2 w-auto"
              sizes="7rem"
            />
            <Image
              src={becomeArrow}
              alt=""
              role="presentation"
              className="h-8 absolute top-1/2 right-full mr-1 w-auto"
              sizes="2rem"
            />
          </div>
          <div className="relative max-w-fit">
            <Image
              src={ambassador}
              alt="Hack Club Ambassador"
              className="h-24 w-auto"
              placeholder="blur"
              sizes="(max-width: 1024px) 18rem, 24rem"
            />
            <div className="absolute -bottom-5 rotate-2 -right-2">
              <Image
                src={summer26Bg}
                alt=""
                role="presentation"
                className="h-8 w-auto"
                placeholder="blur"
                sizes="8rem"
              />
              <Image
                src={summer26Fg}
                alt="Summer '26"
                className="h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-auto"
                placeholder="blur"
                sizes="4rem"
              />
            </div>
          </div>
        </div>
        <h1 className="text-5xl text-pretty mt-8 font-jersey">{t("hero.0")}</h1>
        <h1 className="text-5xl relative isolate font-jersey">
          {t("hero.1")}{" "}
          <span className="relative inline-block">
            {t("hero.2")}
            <Image
              src={highlight}
              alt="Hack Club Ambassador"
              className="h-12 max-w-none absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-auto"
              sizes="10rem"
              unoptimized
            />
          </span>
        </h1>

        <Link
          href="/apply"
          className="mt-6 max-lg:mx-auto max-w-fit corner-squircle rounded-full hover:scale-105 transition hover:bg-rose-700 bg-primary text-white h-14 px-5 flex items-center"
        >
          <span className="font-jersey text-3xl uppercase">{t("apply")}</span>
        </Link>
        <p className="mt-4 text-neutral-600 text-sm">{t("apply-sub")}</p>
      </div>
      <Image
        src={flagHoldingText}
        alt=""
        role="presentation"
        className="w-96 max-lg:-mb-16 h-auto"
        placeholder="blur"
        preload
        sizes="(max-width: 640px) calc(100vw - 6rem), 24rem"
      />
    </div>
  );
}
