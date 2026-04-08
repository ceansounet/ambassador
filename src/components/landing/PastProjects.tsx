import Image from "next/image";

import doomPdf from "@/assets/landing/projects-bg/doom-pdf.png";
import librepods from "@/assets/landing/projects-bg/librepods.png";
import vert from "@/assets/landing/projects-bg/vert.png";
import biblicallyAccurate from "@/assets/landing/projects-bg/biblically-accurate.png";
import specter from "@/assets/landing/projects-bg/specter.png";
import blindDefusal from "@/assets/landing/projects-bg/blind-defusal.png";

import orphThumbsUp from "@/assets/landing/emotes/orph-thumbsup.png";
import { useTranslations } from "next-intl";

export default function PastProjects() {
  const t = useTranslations("landing.past-projects");

  return (
    <div className="p-12">
      <h2 className="text-5xl font-jersey">{t("title")}</h2>
      <div className="mt-8 gap-6 relative text-black grid grid-cols-3">
        <div className="relative @container">
          <Image
            src={doomPdf}
            alt={t("doom-pdf.title")}
            className="w-full h-auto shadow-lg"
          />
          <div className="absolute inset-0 leading-tight text-white p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
            <p className="text-[5cqw] font-medium whitespace-pre-wrap">
              {t("doom-pdf.desc")}
            </p>
            <p className="text-[3.33cqw] ">
              <span className="text-current/60 italic">{t("by")} </span>
              {t("doom-pdf.by")}
            </p>
          </div>
        </div>
        <div className="relative @container">
          <Image
            src={librepods}
            alt={t("librepods.title")}
            className="w-full h-auto shadow-lg"
          />
          <div className="absolute inset-0 leading-tight p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
            <p className="text-[5cqw] font-medium whitespace-pre-wrap">
              {t("librepods.desc")}
            </p>
            <p className="text-[3.33cqw]">
              <span className="text-current/60 italic">{t("by")} </span>
              {t("librepods.by")}
            </p>
          </div>
        </div>
        <div className="relative @container">
          <Image
            src={vert}
            alt={t("vert.title")}
            className="w-full h-auto shadow-lg"
          />
          <div className="absolute inset-0 leading-tight p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
            <p className="text-[5cqw] font-medium whitespace-pre-wrap">
              {t("vert.desc")}
            </p>
            <p className="text-[3.33cqw] ">
              <span className="text-current/60 italic">{t("by")} </span>
              {t("vert.by")}
            </p>
          </div>
        </div>
        <div className="relative @container">
          <Image
            src={biblicallyAccurate}
            alt={t("biblically-accurate.title")}
            className="w-full h-auto shadow-lg"
          />
          <div className="absolute inset-0 leading-tight text-white p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
            <p className="text-[5cqw] font-medium whitespace-pre-wrap">
              {t("biblically-accurate.desc")}
            </p>
            <p className="text-[3.33cqw] ">
              <span className="text-current/60 italic">{t("by")} </span>
              {t("biblically-accurate.by")}
            </p>
          </div>
        </div>
        <div className="relative @container">
          <Image
            src={specter}
            alt={t("specter.title")}
            className="w-full h-auto shadow-lg"
          />
          <div className="absolute inset-0 leading-tight text-white p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
            <p className="text-[5cqw] font-medium whitespace-pre-wrap">
              {t("specter.desc")}
            </p>
            <p className="text-[3.33cqw] ">
              <span className="text-current/60 italic">{t("by")} </span>
              {t("specter.by")}
            </p>
          </div>
        </div>
        <div className="relative @container">
          <Image
            src={blindDefusal}
            alt={t("blind-defusal.title")}
            className="w-full h-auto shadow-lg"
          />
          <div className="absolute inset-0 leading-tight text-white p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
            <p className="text-[5cqw] font-medium whitespace-pre-wrap">
              {t("blind-defusal.desc")}
            </p>
            <p className="text-[3.33cqw] ">
              <span className="text-current/60 italic">{t("by")} </span>
              {t("blind-defusal.by")}
            </p>
          </div>
        </div>

        <Image
          src={orphThumbsUp}
          alt=""
          role="presentation"
          className="h-32 right-0 absolute w-auto bottom-0 translate-y-1/2"
        />
      </div>
    </div>
  );
}
