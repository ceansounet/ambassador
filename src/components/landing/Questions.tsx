import Sep from "./Sep";

export default function Questions() {
  return (
    <div className="p-12 relative">
      <Sep className="absolute top-0 -translate-y-1/2 inset-x-0" />
      <h2 className="text-5xl font-jersey">Questions you might have</h2>
      <div className="mt-6 border-t border-neutral-300">
        <div className="py-4 border-b border-neutral-300 leading-relaxed text-xl">
          <p className="font-bold">What would I do?</p>
          <p className="mt-2">
            Help spread the word about Hack Club in your country! Put up posters
            to encourage teens to check out our events, with your unique QR code
            on them.
          </p>
        </div>
        <div className="py-4 border-b border-neutral-300 leading-relaxed text-xl">
          <p className="font-bold">How does this work?</p>
          <p className="mt-2">
            We&rsquo;ve already made some amazing posters for you, so all you
            have to do is print them out from our platform and put them up for
            people to see! Please remember to follow any local laws about
            putting up posters - you could look into places like local shops or
            community boards.
          </p>
          <p className="mt-2">
            We&rsquo;re planning to add referral links too, but for now
            it&rsquo;s posters only.
          </p>
        </div>
        <div className="py-4 border-b border-neutral-300 leading-relaxed text-xl">
          <p className="font-bold">What do I get?</p>
          <p className="mt-2">
            We&rsquo;ll give you $1.00 for every poster you put up (with a
            photo!), and $0.50 for every person who signs up and verifies
            themselves as under 18.
          </p>
          <p className="mt-2 text-base text-neutral-600">
            example: if you put up 15 posters in a month, and 10 people sign up{" "}
            <span className="underline">per poster</span>, that&rsquo;s $15 +
            $75 = $90 for that month!
          </p>
          <p className="mt-2">
            We&rsquo;ll also give you Hack Club branded t-shirts and merch.
          </p>
        </div>
        <div className="py-4 border-b border-neutral-300 leading-relaxed text-xl">
          <p className="font-bold">Who can apply?</p>
          <p className="mt-2">
            Teenagers aged 13-18 from the United States, United Kingdom, Canada,
            Europe and Australia can apply. You&rsquo;ll need to be able to get
            to places around your city - this may involve walking, biking,
            driving, or taking public transit, it&rsquo;s up to you.
          </p>
          <p className="mt-2">
            We hope to add more countries in the future, but this is a brand new
            program, so we&rsquo;re trying it out first in a small number of
            areas.
          </p>
        </div>
      </div>
      <p className="mt-6 text-3xl leading-relaxed">
        If your question isn&rsquo;t answered here, you can always ask in{" "}
        <strong>#ambassadors-program</strong> or email us,{" "}
        <strong>ambassadors@hackclub.com</strong>.
      </p>
    </div>
  );
}
