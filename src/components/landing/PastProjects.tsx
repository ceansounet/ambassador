import Image from "next/image";

import doomPdf from "@/assets/landing/projects-bg/doom-pdf.png";
import librepods from "@/assets/landing/projects-bg/librepods.png";
import vert from "@/assets/landing/projects-bg/vert.png";
import biblicallyAccurate from "@/assets/landing/projects-bg/biblically-accurate.png";
import specter from "@/assets/landing/projects-bg/specter.png";
import blindDefusal from "@/assets/landing/projects-bg/blind-defusal.png";

import orphThumbsUp from "@/assets/landing/emotes/orph-thumbsup.png";
import { useTranslations } from "next-intl";

const projects = [
  { key: "doom-pdf", image: doomPdf, textClassName: "text-white" },
  { key: "librepods", image: librepods, textClassName: "" },
  { key: "vert", image: vert, textClassName: "" },
  {
    key: "biblically-accurate",
    image: biblicallyAccurate,
    textClassName: "text-white",
  },
  { key: "specter", image: specter, textClassName: "text-white" },
  { key: "blind-defusal", image: blindDefusal, textClassName: "text-white" },
] as const;

export default function PastProjects() {
  const t = useTranslations("landing.past-projects");

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <h2 className="text-4xl md:text-5xl text-pretty font-jersey">
        {t("title")}
      </h2>
      <div className="mt-8 gap-6 relative text-black grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <div key={project.key} className="relative @container">
            <Image
              src={project.image}
              alt={t(`${project.key}.title`)}
              className="w-full h-auto shadow-lg"
              placeholder="blur"
              sizes="(max-width: 640px) calc(100vw - 6rem), (max-width: 1024px) calc(50vw - 3rem), calc(33vw - 2rem)"
            />
            <div
              className={`absolute inset-0 flex flex-col items-center justify-end gap-[4cqw] p-[6.66cqw] text-center leading-tight ${project.textClassName}`}
            >
              <p className="text-[5cqw] font-medium whitespace-pre-wrap">
                {t(`${project.key}.desc`)}
              </p>
              <p className="text-[3.33cqw]">
                <span className="text-current/60 italic">{t("by")} </span>
                {t(`${project.key}.by`)}
              </p>
            </div>
          </div>
        ))}

        <Image
          src={orphThumbsUp}
          alt=""
          role="presentation"
          className="h-32 right-0 absolute w-auto bottom-0 translate-y-1/2"
          placeholder="blur"
          sizes="8rem"
        />
      </div>
    </div>
  );
}
