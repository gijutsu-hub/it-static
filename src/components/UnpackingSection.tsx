export default function UnpackingSection() {
  return (
    <section className="py-12 md:py-16 px-4 md:px-16 bg-white border-b-8 border-on-surface relative">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16">

          {/* Sticky heading */}
          <div className="lg:w-1/3">
            <h2 className="section-h2 font-display-lg text-5xl md:text-7xl lg:text-8xl text-on-surface leading-[0.85] tracking-tighter lg:sticky lg:top-32 uppercase">
              DECODING
              <br />
              <span className="bg-primary-container px-3 md:px-4 text-white inline-block mt-3 md:mt-4 sticker-border sticker-shadow transform -rotate-2">
                THE
                <br />
                VIBE
              </span>
            </h2>
          </div>

          {/* Cards grid */}
          <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">

            <div className="bg-white sticker-border sticker-shadow p-6 md:p-8 flex flex-col gap-4 md:gap-6 floating-sticker transform rotate-1">
              <span className="material-symbols-outlined text-5xl md:text-6xl text-primary">
                location_away
              </span>
              <h3 className="font-display-lg text-3xl md:text-4xl uppercase">
                01. HYPER-LOCATE
              </h3>
              <p className="font-body-lg text-lg md:text-xl">
                Mark the unmarkable. Presence is protocol. Your footprint is a
                declaration of something. We&apos;re not saying what. You know.
                (You don&apos;t know.)
              </p>
            </div>

            <div className="bg-on-surface text-white sticker-border sticker-shadow p-6 md:p-8 flex flex-col gap-4 md:gap-6 floating-sticker transform -rotate-1">
              <span className="material-symbols-outlined text-5xl md:text-6xl text-secondary-container">
                vocal_soft
              </span>
              <h3 className="font-display-lg text-3xl md:text-4xl text-secondary-container uppercase">
                02. EMIT NOISE
              </h3>
              <p className="font-body-lg text-lg md:text-xl opacity-90">
                It&apos;s not a message. It&apos;s a frequency. Curated disruption
                delivered at the velocity of a feeling you can&apos;t name. The
                signal is the noise. The noise is the signal. Both are correct.
              </p>
            </div>

            <div className="pop-gradient-3 sticker-border sticker-shadow p-6 md:p-8 flex flex-col gap-4 md:gap-6 floating-sticker transform -rotate-2">
              <span className="material-symbols-outlined text-5xl md:text-6xl text-on-tertiary-container">
                diversity_3
              </span>
              <h3 className="font-display-lg text-3xl md:text-4xl uppercase">
                03. CONVERGE PHYSICALLY
              </h3>
              <p className="font-body-lg text-lg md:text-xl">
                From digital ping to IRL impact. Bodies in a space. A space that
                used to be a different kind of space. We don&apos;t do RSVPs. We
                do arrivals. Sudden ones.
              </p>
            </div>

            <div className="pop-gradient-2 sticker-border sticker-shadow p-6 md:p-8 flex flex-col gap-4 md:gap-6 floating-sticker transform rotate-2">
              <span className="material-symbols-outlined text-5xl md:text-6xl text-primary">
                shield_person
              </span>
              <h3 className="font-display-lg text-3xl md:text-4xl text-primary uppercase">
                04. PROTECT THE FREQUENCY
              </h3>
              <p className="font-body-lg text-lg md:text-xl">
                Not everyone can hear it. Not everyone should. We don&apos;t
                gatekeep but we do vibekeep. There&apos;s a difference. Nobody
                knows what it is. That&apos;s the point.
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
