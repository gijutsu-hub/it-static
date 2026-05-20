"use client";

import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="py-12 md:py-16 px-4 md:px-16 border-b-8 border-on-surface relative">
      <div className="max-w-7xl mx-auto z-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* Left: copy */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="inline-block bg-tertiary-fixed text-on-tertiary-fixed px-4 md:px-6 py-2 sticker-border sticker-shadow transform -rotate-2 font-display-lg text-lg md:text-2xl uppercase tracking-tighter w-fit mobile-no-rotate">
              TRANSMISSION 001: WE ARE NOT A PHASE
            </div>

            <h1 className="hero-h1 font-display-lg text-5xl md:text-7xl lg:text-8xl text-on-surface leading-[0.9] tracking-tighter uppercase">
              WE ARE NOT <span className="text-primary">A THING.</span>
              <br />
              <span className="bg-secondary-container px-3 md:px-4 sticker-border sticker-shadow inline-block transform rotate-1 mt-2">
                WE ARE THE
                <br />
                THING BEFORE THE THING.
              </span>
            </h1>

            <div className="bg-white p-5 md:p-8 sticker-border sticker-shadow transform rotate-1 max-w-2xl relative mobile-no-rotate">
              <p className="hero-manifesto font-display-lg text-xl md:text-2xl text-on-surface leading-tight mb-4 md:mb-6">
                YOUR CITY IS A JPEG. WE ARE THE ARTIFACT. THE COMPRESSION IS
                INTENTIONAL AND SO ARE YOU (PROBABLY).
              </p>
              <p className="font-body-md text-base md:text-lg text-on-surface-variant italic font-bold uppercase tracking-wide">
                Transmitting vibes. Recalibrating souls. Digitising the asphalt
                frequency since before you were aware of it.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 mt-4">
              <Link
                href="/auth"
                className="btn-join tactile-button bg-tertiary-fixed text-on-tertiary-fixed px-8 md:px-12 py-4 md:py-6 font-display-lg text-xl md:text-2xl rounded-2xl gap-3"
              >
                JOIN THE STATIC
                <span className="material-symbols-outlined text-2xl md:text-3xl">
                  bolt
                </span>
              </Link>
            </div>
          </div>

          {/* Right: image */}
          <div className="lg:col-span-5 relative mt-6 lg:mt-0">
            <div className="aspect-square rounded-[32px] md:rounded-[40px] sticker-border sticker-shadow relative overflow-hidden transform rotate-2 md:rotate-3 floating-sticker bg-secondary-container">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="IT'S STATIC Urban Resistance"
                className="w-full h-full object-cover"
                src="/hero.svg"
              />
            </div>
            <div className="hidden sm:block absolute -top-10 -right-4 md:-right-6 bg-primary-container p-3 md:p-4 sticker-border sticker-shadow transform -rotate-12 font-display-lg text-2xl md:text-4xl text-on-primary-container z-20">
              ECSTATIC!
            </div>
            <div className="hidden sm:block absolute -bottom-8 -left-4 md:-left-6 bg-on-surface text-secondary-container p-3 md:p-4 sticker-border sticker-shadow transform rotate-6 font-display-lg text-lg md:text-2xl z-20 uppercase">
              NO BOTS allowed.
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
