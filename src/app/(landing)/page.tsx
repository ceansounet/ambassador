import type { ComponentProps } from "react";
import Image from "next/image";

import ambassador from "@/assets/landing/logo/ambassador.png";
import become from "@/assets/landing/logo/become.png";
import becomeArrow from "@/assets/landing/logo/become-arrow.png";
import summer26Bg from "@/assets/landing/logo/summer-26-bg.png";
import summer26Fg from "@/assets/landing/logo/summer-26-fg.png";
import highlight from "@/assets/landing/highlight.svg";
import flagHoldingText from "@/assets/landing/flagholdingtext.png";

import blueprint from "@/assets/landing/events/blueprint.png";
import campfireFlagship from "@/assets/landing/events/campfire-flagship.png";
import midnight from "@/assets/landing/events/midnight.jpg";
import siege from "@/assets/landing/events/siege.png";

import doomPdf from "@/assets/landing/projects-bg/doom-pdf.png";
import librepods from "@/assets/landing/projects-bg/librepods.png";
import vert from "@/assets/landing/projects-bg/vert.png";
import biblicallyAccurate from "@/assets/landing/projects-bg/biblically-accurate.png";
import specter from "@/assets/landing/projects-bg/specter.png";
import blindDefusal from "@/assets/landing/projects-bg/blind-defusal.png";

import orphHappy from "@/assets/landing/emotes/orph-happy.png";
import orphThumbsUp from "@/assets/landing/emotes/orph-thumbsup.png";
import orphWowCute from "@/assets/landing/emotes/orph-wowcute.png";

import hcRounded from "@/assets/landing/hc-rounded.svg";

import sep from "@/assets/landing/sep.png";

const Sep = ({
  className = "",
  ...props
}: Omit<ComponentProps<typeof Image>, "src" | "alt">) => (
  <Image
    {...props}
    src={sep}
    alt=""
    role="presentation"
    className={`w-full h-auto ${className}`}
    sizes="100vw"
  />
);

export default function Home() {
  return (
    <>
      <div className="p-12 flex gap-8 items-center justify-between bg-grid bg-neutral-50">
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
          <h1 className="text-5xl mt-8 font-jersey">
            Inspire more teens like you to code.
          </h1>
          <h1 className="text-5xl relative isolate font-jersey">
            Get money.
            <span className="relative ml-4">
              Repeat.
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
            <span className="font-jersey text-3xl uppercase">Apply</span>
          </button>
          <p className="mt-4 text-neutral-600 text-sm">
            14 days left, US, UK, CA, EU, AU only
          </p>
        </div>
        <Image
          src={flagHoldingText}
          alt=""
          role="presentation"
          className="h-96 w-auto"
        />
      </div>
      <div className="p-12 relative">
        <Sep className="absolute top-0 -translate-y-1/2 inset-x-0" />
        <p className="text-neutral-500 text-xl font-jersey">
          --- START OF MESSAGE ---
        </p>
        <div className="leading-relaxed text-3xl text-pretty space-y-4 mt-4">
          <p>
            At Hack Club, we help teens to discover the joy of code, together.
            We run events for teen hackers to make cool things, and earn prizes
            - from iPads, MacBooks and Raspberry Pis, to flights to in-person
            hackathons around the world. Along the way, they&rsquo;ll find a
            space online made for them, and maybe make a few friends too.
          </p>
          <p>
            This summer, we&rsquo;re planning our most ambitious summer event
            yet. We&rsquo;re partnering with NASA, AMD, and GitHub to run the
            world&rsquo;s biggest engineering challenge, and we want your help.
          </p>
          <p>
            We&rsquo;re looking for young people like you to advertise Hack Club
            in your country. We want even more teens to sign up and take part in
            our events, and we want you to make it happen.
          </p>
          <p>
            You can send emails to schools, put up posters, post on social
            media, or do anything really - how you do outreach is up to you.
          </p>
          <p>
            In return, we&rsquo;ll give you exclusive Ambassador t-shirts and
            merch. Plus, for every poster you put up, and every signup you get,{" "}
            <strong>we give you money.</strong> Real money. To your bank
            account.
          </p>
          <p>Ready?</p>
          <p>copy subject to change</p>

          <button
            type="button"
            className="mt-4 corner-squircle rounded-full hover:scale-105 transition hover:bg-rose-700 bg-primary text-white h-14 px-5 flex items-center"
          >
            <span className="font-jersey text-3xl uppercase">Apply</span>
          </button>
          <p className="mt-4 text-neutral-600 text-sm">
            14 days left, US, UK, CA, EU, AU only
          </p>
        </div>
      </div>
      <div className="p-12 bg-linear-to-b from-indigo-200 relative isolate to-violet-300">
        <div className="absolute inset-0 bg-noise -z-10" />
        <Sep className="absolute top-0 -translate-y-1/2 inset-x-0" />

        <h2 className="text-5xl font-jersey">Past events</h2>
        <div className="leading-relaxed text-3xl text-pretty space-y-4 mt-4">
          <p>
            In 2025, Hack Clubbers around the world spent over{" "}
            <strong>240,000 hours coding</strong>, building over{" "}
            <strong>23,000 unique projects</strong>.
          </p>
          <p>In 2026, we want to do even better.</p>
        </div>
        <div className="mt-8 columns-2 gap-8 space-y-12 *:break-inside-avoid">
          <section>
            <Image
              src={campfireFlagship}
              alt=""
              className="w-full aspect-3/2 object-cover border-[0.75rem] border-white shadow-lg"
            />
            <p className="mt-6 text-xl font-bold">Campfire Flagship</p>
            <p className="mt-1 text-xl">
              A 3-day flagship game jam in Los Angeles with YouTubers like
              Michael Reeves, William Osman, and many more!
            </p>
          </section>
          <section>
            <Image
              src={blueprint}
              alt=""
              className="w-full aspect-3/2 object-cover border-[0.75rem] border-white shadow-lg"
            />
            <p className="mt-6 text-xl font-bold">Blueprint</p>
            <p className="mt-1 text-xl">
              Blueprint gave $140,000 to fund 1,500 hardware and electronics
              projects built by teenagers.
            </p>
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
            <p className="mt-6 text-xl font-bold">Midnight</p>
            <p className="mt-1 text-xl">
              A murder-mystery hackathon held in Austria, Vienna with 60+
              teenagers from all across the world!
            </p>
          </section>
          <section>
            <Image
              src={siege}
              alt=""
              className="w-full aspect-3/2 object-cover border-[0.75rem] border-white shadow-lg"
            />
            <p className="mt-6 text-xl font-bold">Siege</p>
            <p className="mt-1 text-xl">
              100+ teens created a project each week for 10 weeks, and received
              a Framework laptop.
            </p>
          </section>
        </div>

        <hr className="my-8 border-black/20" />

        <h2 className="text-5xl font-jersey">
          Past projects built by teenagers in Hack Club
        </h2>
        <div className="mt-8 gap-6 relative text-black grid grid-cols-3">
          <div className="relative @container">
            <Image
              src={doomPdf}
              alt="Doom PDF"
              className="w-full h-auto shadow-lg"
            />
            <div className="absolute inset-0 leading-tight text-white p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
              <p className="text-[5cqw] font-medium">
                A source port of Doom (1993),
                <br />
                running inside a PDF document.
              </p>
              <p className="text-[3.33cqw] ">
                <span className="text-current/60 italic">by </span>
                Allen D
              </p>
            </div>
          </div>
          <div className="relative @container">
            <Image
              src={librepods}
              alt="LibrePods"
              className="w-full h-auto shadow-lg"
            />
            <div className="absolute inset-0 leading-tight p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
              <p className="text-[5cqw] font-medium">
                Airpods liberated from
                <br />
                Apple&rsquo;s ecosystem.
              </p>
              <p className="text-[3.33cqw]">
                <span className="text-current/60 italic">by </span>
                Kavish D
              </p>
            </div>
          </div>
          <div className="relative @container">
            <Image src={vert} alt="VERT" className="w-full h-auto shadow-lg" />
            <div className="absolute inset-0 leading-tight p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
              <p className="text-[5cqw] font-medium">
                A file conversion utility that uses
                <br />
                WebAssembly to convert files
                <br />
                on-device instead of on the cloud.
              </p>
              <p className="text-[3.33cqw] ">
                <span className="text-current/60 italic">by </span>
                Maya
              </p>
            </div>
          </div>
          <div className="relative @container">
            <Image
              src={biblicallyAccurate}
              alt="The Biblically Accurate Macropad"
              className="w-full h-auto shadow-lg"
            />
            <div className="absolute inset-0 leading-tight text-white p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
              <p className="text-[5cqw] font-medium">
                A very macro macropad in the shape
                <br />
                of a biblically accurate angel!
              </p>
              <p className="text-[3.33cqw] ">
                <span className="text-current/60 italic">by </span>
                Alex Tran
              </p>
            </div>
          </div>
          <div className="relative @container">
            <Image
              src={specter}
              alt="Specter"
              className="w-full h-auto shadow-lg"
            />
            <div className="absolute inset-0 leading-tight text-white p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
              <p className="text-[5cqw] font-medium">
                A game about a knight bravely
                <br />
                trying to escape the cave, but
                <br />
                is haunted by his own ghost.
              </p>
              <p className="text-[3.33cqw] ">
                <span className="text-current/60 italic">by </span>
                Ayessa
              </p>
            </div>
          </div>
          <div className="relative @container">
            <Image
              src={blindDefusal}
              alt="Blind Defusal"
              className="w-full h-auto shadow-lg"
            />
            <div className="absolute inset-0 leading-tight text-white p-[6.66cqw] gap-[4cqw] flex flex-col text-center justify-end items-center">
              <p className="text-[5cqw] font-medium">
                A two-player, cooperative
                <br />
                &ldquo;bomb defusal&rdquo; game.
              </p>
              <p className="text-[3.33cqw] ">
                <span className="text-current/60 italic">by </span>
                Joshua W
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
      <div className="p-12 relative">
        <Sep className="absolute top-0 -translate-y-1/2 inset-x-0" />
        <h2 className="text-5xl font-jersey">Questions you might have</h2>
        <div className="mt-6 border-t border-neutral-300">
          <div className="py-4 border-b border-neutral-300 leading-relaxed text-xl">
            <p className="font-bold">What would I do?</p>
            <p className="mt-2">
              Help spread the word about Hack Club in your country! Put up
              posters to encourage teens to check out our events, with your
              unique QR code on them.
            </p>
          </div>
          <div className="py-4 border-b border-neutral-300 leading-relaxed text-xl">
            <p className="font-bold">How does this work?</p>
            <p className="mt-2">
              We&rsquo;ve already made some amazing posters for you, so all you
              have to do is print them out (from this website) and put them up
              for people to see! Please remember to follow any local laws about
              putting up posters - you could look into places like local shops
              or community boards.
            </p>
            <p className="mt-2">
              We&rsquo;re planning to add referral links too, but for now
              it&rsquo;s posters only.
            </p>
          </div>
          <div className="py-4 border-b border-neutral-300 leading-relaxed text-xl">
            <p className="font-bold">Who can apply?</p>
            <p className="mt-2">
              Teenagers aged 13-18 from the United States, United Kingdom,
              Canada, Europe and Australia can apply.
            </p>
            <p className="mt-2">
              We hope to add more countries in the future, but this is a brand
              new program, so we&rsquo;re trying it out first in a small number
              of areas.
            </p>
          </div>
        </div>
        <p className="mt-6 text-3xl leading-relaxed">
          If your question isn&rsquo;t answered here, you can always ask in{" "}
          <strong>#ambassadors-program</strong> or email us,{" "}
          <strong>ambassadors@hackclub.com</strong>.
        </p>
      </div>

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
          <h2 className="text-5xl font-jersey">Make your mark.</h2>
          <button
            type="button"
            className="mt-6 h-36 px-20 rounded-full hover:bg-rose-700 transition hover:scale-105 bg-primary corner-squircle"
          >
            <span className="font-jersey text-7xl uppercase">Apply</span>
          </button>
          <p className="mt-6 italic text-neutral-400">
            applications close [tbd] April 2026, at 12:00am EDT.
          </p>
        </div>
        <div className="px-12 pb-8 pt-4 flex items-center">
          <a href="https://hackclub.com" target="_blank" rel="noreferrer">
            <Image src={hcRounded} alt="Hack Club" className="h-8 w-auto" />
          </a>
          <p className="flex-1 text-right text-xs text-neutral-500">
            © 2026 Hack Club. 501(c)(3) nonprofit (EIN: 81-2908499)
          </p>
        </div>
      </footer>
    </>
  );
}
