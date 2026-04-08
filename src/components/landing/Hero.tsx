import Image from "next/image";

import ambassador from "@/assets/landing/logo/ambassador.png";
import become from "@/assets/landing/logo/become.png";
import becomeArrow from "@/assets/landing/logo/become-arrow.png";
import summer26Bg from "@/assets/landing/logo/summer-26-bg.png";
import summer26Fg from "@/assets/landing/logo/summer-26-fg.png";
import highlight from "@/assets/landing/highlight.svg";
import flagHoldingText from "@/assets/landing/flagholdingtext.png";

import { useTranslations } from "next-intl";

export default function Hero() {
  const t = useTranslations("landing");
  return (
    <div className="p-12 flex gap-8 items-center justify-between">
      <div>
        <div className="relative w-fit">
          <Image
            src={become}
            alt="Become a"
            className="h-4 mb-2 -rotate-2 w-auto"
          />
          <Image
            src={becomeArrow}
            alt=""
            role="presentation"
            className="h-8 absolute top-1/2 right-full mr-1 w-auto"
          />
        </div>
        <div className="relative w-fit">
          <Image
            src={ambassador}
            alt="Hack Club Ambassador"
            className="h-24 w-auto"
          />
          <div className="absolute -bottom-5 rotate-2 -right-2">
            <Image
              src={summer26Bg}
              alt=""
              role="presentation"
              className="h-8 w-auto"
            />
            <Image
              src={summer26Fg}
              alt="Summer '26"
              className="h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-auto"
            />
          </div>
        </div>
        <h1 className="text-5xl mt-8 font-jersey">{t("hero.0")}</h1>
        <h1 className="text-5xl relative isolate font-jersey">
          {t("hero.1")}
          <span className="relative ml-4">
            {t("hero.2")}
            <Image
              src={highlight}
              alt="Hack Club Ambassador"
              className="h-12 max-w-none absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-auto"
            />
          </span>
        </h1>

        <button
          type="button"
          className="mt-6 corner-squircle rounded-full hover:scale-105 transition hover:bg-rose-700 bg-primary text-white h-14 px-5 flex items-center"
        >
          <span className="font-jersey text-3xl uppercase">{t("apply")}</span>
        </button>
        <p className="mt-4 text-neutral-600 text-sm">
          {t("apply-sub", { daysLeft: 14 })}
        </p>
      </div>
      <Image
        src={flagHoldingText}
        alt=""
        role="presentation"
        className="h-96 w-auto"
      />
    </div>
  );
}
