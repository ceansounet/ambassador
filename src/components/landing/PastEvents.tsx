import Image from "next/image";

import blueprint from "@/assets/landing/events/blueprint.png";
import campfireFlagship from "@/assets/landing/events/campfire-flagship.png";
import midnight from "@/assets/landing/events/midnight.jpg";
import siege from "@/assets/landing/events/siege.png";
import orphWowCute from "@/assets/landing/emotes/orph-wowcute.png";
import { useTranslations } from "next-intl";

const events = [
  { key: "flagship", image: campfireFlagship, decoration: false },
  { key: "midnight", image: midnight, decoration: true },
  { key: "blueprint", image: blueprint, decoration: false },
  { key: "siege", image: siege, decoration: false },
] as const;

export default function PastEvents() {
  const t = useTranslations("landing.past-events");

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <h2 className="text-4xl md:text-5xl font-jersey">{t("title")}</h2>
      <div className="leading-relaxed text-xl md:text-2xl xl:text-3xl text-pretty space-y-4 mt-4">
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
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-12">
        {events.map((event) => (
          <section key={event.key}>
            <div className={event.decoration ? "relative" : undefined}>
              <Image
                src={event.image}
                alt=""
                className="w-full aspect-3/2 object-cover border-[0.75rem] border-white shadow-lg"
              />
              {event.decoration && (
                <Image
                  src={orphWowCute}
                  alt=""
                  role="presentation"
                  className="h-24 -left-8 -bottom-8 -rotate-3 -scale-x-100 absolute w-auto"
                />
              )}
            </div>
            <p className="mt-6 text-xl font-bold">{t(`${event.key}.title`)}</p>
            <p className="mt-1 text-xl">{t(`${event.key}.desc`)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
