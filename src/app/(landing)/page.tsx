import type { Metadata } from "next";
import Image from "next/image";

import Intro from "@/components/landing/Intro";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import PastEvents from "@/components/landing/PastEvents";
import PastProjects from "@/components/landing/PastProjects";
import Questions from "@/components/landing/Questions";
import Sep from "@/components/landing/Sep";
import Footer from "@/components/landing/Footer";

import orphHappy from "@/assets/landing/emotes/orph-happy.png";

import { getTranslatedPageMetadata } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("landing.metadata.title");
}

export default function Home() {
  return (
    <>
      <div className="bg-grid relative bg-neutral-50">
        <Header />
        <Hero />

        <Sep className="absolute bottom-0 translate-y-1/2 inset-x-0" />
      </div>

      <Intro />

      <div className="bg-linear-to-b from-indigo-200 relative isolate to-violet-300">
        <div className="absolute inset-0 bg-noise -z-10" />
        <Sep className="absolute top-0 -translate-y-1/2 inset-x-0" />
        <Sep className="absolute bottom-0 translate-y-1/2 inset-x-0" />

        <PastEvents />
        <div className="px-12 max-w-7xl mx-auto">
          <hr className="border-black/20" />
        </div>
        <PastProjects />
      </div>

      <Questions />

      <div className="relative bg-neutral-900 mt-8 text-white">
        <Sep className="absolute top-0 -translate-y-1/2 inset-x-0" />
        <Image
          src={orphHappy}
          alt=""
          role="presentation"
          className="h-24 md:h-28 xl:h-32 left-1/2 absolute w-auto top-0 -translate-x-1/2 -translate-y-1/2"
          placeholder="blur"
          sizes="(min-width: 1280px) 8rem, (min-width: 768px) 7rem, 6rem"
        />

        <Footer />
      </div>
    </>
  );
}
