import Image from "next/image";

import blueprint from "@/assets/landing/events/blueprint.png";
import campfireFlagship from "@/assets/landing/events/campfire-flagship.png";
import midnight from "@/assets/landing/events/midnight.jpg";
import siege from "@/assets/landing/events/siege.png";
import orphWowCute from "@/assets/landing/emotes/orph-wowcute.png";
import { useTranslations } from "next-intl";

export default function PastEvents() {
  const t = useTranslations("landing.past-events");

  return (
    <div className="p-12">
      <h2 className="text-5xl font-jersey">{t("title")}</h2>
      <div className="leading-relaxed text-3xl text-pretty space-y-4 mt-4">
        <p>
          {t.rich("0", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p>
          {t.rich("1", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </div>
      <div className="mt-8 columns-2 gap-8 space-y-12 *:break-inside-avoid">
        <section>
          <Image
            src={campfireFlagship}
            alt=""
            className="w-full aspect-3/2 object-cover border-[0.75rem] border-white shadow-lg"
          />
          <p className="mt-6 text-xl font-bold">{t("flagship.title")}</p>
          <p className="mt-1 text-xl">{t("flagship.desc")}</p>
        </section>
        <section>
          <Image
            src={blueprint}
            alt=""
            className="w-full aspect-3/2 object-cover border-[0.75rem] border-white shadow-lg"
          />
          <p className="mt-6 text-xl font-bold">{t("blueprint.title")}</p>
          <p className="mt-1 text-xl">{t("blueprint.desc")}</p>
        </section>
        <section>
          <div className="relative">
            <Image
              src={midnight}
              alt=""
              className="w-full aspect-3/2 object-cover border-[0.75rem] border-white shadow-lg"
            />
            <Image
              src={orphWowCute}
              alt=""
              role="presentation"
              className="h-24 -left-8 -bottom-8 -rotate-3 -scale-x-100 absolute w-auto"
            />
          </div>
          <p className="mt-6 text-xl font-bold">{t("midnight.title")}</p>
          <p className="mt-1 text-xl">{t("midnight.desc")}</p>
        </section>
        <section>
          <Image
            src={siege}
            alt=""
            className="w-full aspect-3/2 object-cover border-[0.75rem] border-white shadow-lg"
          />
          <p className="mt-6 text-xl font-bold">{t("siege.title")}</p>
          <p className="mt-1 text-xl">{t("siege.desc")}</p>
        </section>
      </div>
    </div>
  );
}
