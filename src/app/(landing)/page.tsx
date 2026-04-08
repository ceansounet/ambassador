import type { Metadata } from "next";

import Intro from "@/components/landing/Intro";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import PastEvents from "@/components/landing/PastEvents";
import PastProjects from "@/components/landing/PastProjects";
import Questions from "@/components/landing/Questions";
import Sep from "@/components/landing/Sep";
import Footer from "@/components/landing/Footer";

import { getTranslatedPageMetadata } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("landing.metadata.title");
}

export default function Home() {
  return (
    <>
      <div className="bg-grid bg-neutral-50">
        <Header />
        <Hero />
      </div>

      <Intro />

      <div className="bg-linear-to-b from-indigo-200 relative isolate to-violet-300">
        <div className="absolute inset-0 bg-noise -z-10" />
        <Sep className="absolute top-0 -translate-y-1/2 inset-x-0" />

        <PastEvents />
        <hr className="border-black/20 mx-12" />
        <PastProjects />
      </div>

      <Questions />
      <Footer />
    </>
  );
}
