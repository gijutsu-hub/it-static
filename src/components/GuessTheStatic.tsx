const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSf6lE6Uv4I5E3mSWThlwyA1l-X-jq1c-xEYJy9fRAMMG8yUXA/viewform";

export default function GuessTheStatic() {
  return (
    <section
      id="guess-the-static"
      className="py-12 md:py-20 px-4 md:px-16 bg-on-surface border-y-8 border-on-surface relative"
    >
      {/* Decorative background text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span className="font-display-lg text-[20vw] font-black text-white/5 uppercase tracking-tighter whitespace-nowrap">
          GUESS
        </span>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex flex-col items-center text-center gap-6 mb-14 md:mb-20">
          <span className="guess-tape text-on-tertiary-fixed">INTEL DROP 002</span>

          <h2 className="guess-h2 font-display-lg text-5xl md:text-7xl lg:text-8xl text-white leading-[0.88] tracking-tighter uppercase">
            CRACK THE CODE.
            <br />
            <span className="text-tertiary-fixed">WIN THE WORLD.</span>
          </h2>

          <p className="font-body-lg text-lg md:text-xl text-white/70 max-w-2xl uppercase tracking-wide">
            Think you know what{" "}
            <strong className="text-secondary-container">iStatic</strong> is
            actually about?
            <br className="hidden md:block" />
            Submit your theory. The sharpest mind wins an all-expenses-paid trip
            to an exotic destination — chosen by the squad.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-2">
            <span className="prize-badge text-on-primary-container text-sm md:text-base">
              ✈️ Flights Covered
            </span>
            <span className="prize-badge bg-tertiary-fixed text-on-tertiary-fixed text-sm md:text-base">
              🏝️ Stay Covered
            </span>
            <span className="prize-badge bg-secondary-container text-on-secondary-container text-sm md:text-base">
              🎒 Squad Travel Kit
            </span>
          </div>
        </div>

        {/* Destinations + Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* Destination mystery cards */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white/10 border-4 border-white/20 rounded-2xl p-4 text-white">
              <p className="font-display-lg text-sm uppercase tracking-widest text-tertiary-fixed mb-3">
                / POSSIBLE DESTINATIONS /
              </p>
              <p className="font-body-md text-white/60 text-sm uppercase mb-4">
                One winner. One mystery city. Could be any of these.
              </p>
            </div>

            {[
              { flag: "🇯🇵", city: "TOKYO", sub: "Urban chaos. Neon resistance." },
              { flag: "🇲🇦", city: "MARRAKECH", sub: "Markets. Medinas. Movement." },
              { flag: "🇧🇷", city: "RIO DE JANEIRO", sub: "Street culture. Raw energy." },
              { flag: "🇮🇸", city: "REYKJAVIK", sub: "Subculture capital of the North." },
            ].map(({ flag, city, sub }, i) => {
              const gradients = [
                "pop-gradient-1",
                "pop-gradient-3",
                "pop-gradient-4",
                "pop-gradient-2",
              ];
              const rotations = [
                "transform rotate-1",
                "transform -rotate-1",
                "transform rotate-2",
                "transform -rotate-2",
              ];
              return (
                <div
                  key={city}
                  className={`dest-card ${gradients[i]} floating-sticker ${rotations[i]}`}
                >
                  <div className="p-5 flex items-center gap-4">
                    <div className="text-4xl">{flag}</div>
                    <div>
                      <p className="font-display-lg text-xl uppercase text-on-surface">
                        {city}
                      </p>
                      <p className="font-body-md text-sm text-on-surface-variant">
                        {sub}
                      </p>
                    </div>
                    <div className="ml-auto bg-on-surface text-secondary-container px-3 py-1 rounded-full font-display-lg text-xs uppercase">
                      ???
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="bg-primary-container sticker-border sticker-shadow p-4 transform -rotate-2 mobile-no-rotate">
              <p className="font-display-lg text-lg uppercase text-on-primary-container leading-snug">
                💡 HINT: THE RIGHT ANSWER
                <br />
                IS SOMEWHERE IN THE STATIC.
              </p>
            </div>
          </div>

          {/* Google Form */}
          <div className="lg:col-span-8">
            <div className="flex items-center gap-4 mb-6">
              <span className="guess-tape">SUBMIT YOUR THEORY</span>
              <span className="font-display-lg text-white/50 text-sm uppercase tracking-widest hidden sm:block">
                → Google Form
              </span>
            </div>

            <div className="form-shell">
              <iframe
                src={`${FORM_URL}?embedded=true`}
                title="Guess the iStatic — Win an Exotic Trip"
                loading="lazy"
                allowFullScreen
              />
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <p className="font-body-md text-white/50 text-sm uppercase tracking-wide">
                Form not loading?
              </p>
              <a
                href={FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="tactile-button bg-white text-on-surface px-6 py-3 font-display-lg text-base rounded-xl uppercase"
              >
                OPEN IN NEW TAB ↗
              </a>
            </div>
          </div>

        </div>

        {/* Bottom rules strip */}
        <div className="mt-14 md:mt-20 border-t-4 border-white/20 pt-6 flex flex-col sm:flex-row justify-between gap-4">
          <p className="font-body-md text-white/40 text-sm uppercase tracking-wider">
            Entries close when the squad says so. One submission per frequency.
            Winner announced via static signal.
          </p>
          <p className="font-body-md text-white/40 text-sm uppercase tracking-wider">
            NO BOTS. NO STATIC. ONLY ECSTATICS.
          </p>
        </div>

      </div>
    </section>
  );
}
