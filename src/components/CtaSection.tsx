import Link from "next/link";

export default function CtaSection() {
  return (
    <section className="bg-primary-container text-on-primary-container py-12 md:py-16 px-4 md:px-16 border-y-8 border-on-surface">
      <div className="max-w-5xl mx-auto text-center flex flex-col gap-8 md:gap-12">

        <h2 className="cta-h2 font-display-lg text-5xl md:text-8xl lg:text-9xl leading-[0.88] tracking-tighter uppercase">
          YOU EITHER
          <br />
          GET IT
          <br />
          <span className="bg-on-surface text-secondary-container px-4 md:px-6 transform -rotate-1 inline-block mt-3 md:mt-4 sticker-border sticker-shadow mobile-no-rotate">
            OR YOU DON&apos;T.
          </span>
        </h2>

        <p className="font-display-lg text-xl md:text-2xl text-on-surface uppercase tracking-wide">
          (Both are valid. Only one is correct. We won&apos;t say which.)
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6">
          <Link
            href="/auth"
            className="tactile-button bg-tertiary-fixed text-on-tertiary-fixed px-10 md:px-16 py-5 md:py-7 font-display-lg text-2xl md:text-4xl rounded-2xl uppercase"
          >
            ENLIST ⚡
          </Link>
          <Link
            href="/auth"
            className="tactile-button bg-on-surface text-secondary-container px-10 md:px-16 py-5 md:py-7 font-display-lg text-2xl md:text-4xl rounded-2xl uppercase"
          >
            ALSO ENLIST
          </Link>
        </div>

        <p className="font-body-md text-sm text-on-surface/50 uppercase tracking-widest">
          * both buttons do the same thing. we contain multitudes.
        </p>

      </div>
    </section>
  );
}
