import Link from "next/link";

export default function StaticFormats() {
  return (
    <section className="py-12 md:py-16 px-4 md:px-16">
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-10 md:mb-16 gap-4">
          <h2 className="bento-h2 font-display-lg text-4xl md:text-6xl lg:text-7xl bg-tertiary-fixed px-5 md:px-8 py-3 md:py-4 sticker-border sticker-shadow transform rotate-1 uppercase tracking-tighter">
            STATIC FORMATS
          </h2>
          <div className="font-display-lg text-base md:text-xl uppercase tracking-widest text-primary">
            / CHOOSE YOUR FREQUENCY /
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">

          {/* THE DARK FREQUENCY — wide card */}
          <div className="lg:col-span-2 pop-gradient-1 rounded-[32px] md:rounded-[40px] p-6 md:p-8 sticker-border sticker-shadow relative overflow-hidden cursor-pointer border-8 border-on-surface h-72 md:h-[400px] flex flex-col justify-between">
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <span className="material-symbols-outlined text-6xl md:text-7xl text-on-surface mb-4 md:mb-6">
                  nightlife
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="mascot"
                  className="w-16 md:w-24 h-16 md:h-24 transform -rotate-12"
                  src="https://lh3.googleusercontent.com/aida/ADBb0ui0V5hyJ4LKbmlRdKH5X_RqRCugYELRGY8eBAIvuLu429nejk93_NBDXzDMwuB4XxOHV1hzHSp1x7Clz2vyVMABBenUmmIqLUaWrA9LHnyNUQ63k7yK6QlRq3FJZAQCU3Y36nTxrE4zVrl17cdBxjPRG2FgkAS8qI4wRtBiiMrfY90CPMTsmHPulP-vqdhGURM8ugNzC8V2yQ1k1PZ2dUcwY0TMFWfWtHKo_Liz1v_-nbSMrXRbRHwyJnM"
                />
              </div>
              <h3 className="font-display-lg text-3xl md:text-5xl uppercase leading-none">
                THE DARK
                <br />
                FREQUENCY
              </h3>
              <p className="font-body-md text-sm md:text-base text-on-surface-variant mt-2 uppercase">
                It happens after the city forgets it&apos;s awake. You bring your
                presence. We bring the static. Nobody asks questions. Especially
                not you.
              </p>
            </div>
            <div className="relative z-10">
              <Link
                href="/auth"
                className="tactile-button bg-white text-on-surface font-display-lg text-lg md:text-2xl py-3 md:py-4 px-6 md:px-8 rounded-2xl uppercase"
              >
                TUNE IN
              </Link>
            </div>
            <div className="absolute bottom-4 right-8 font-display-lg text-7xl md:text-9xl opacity-10 pointer-events-none uppercase">
              DARK
            </div>
          </div>

          {/* BRAIN STATIC */}
          <div className="pop-gradient-3 rounded-[32px] md:rounded-[40px] p-6 md:p-8 sticker-border sticker-shadow relative overflow-hidden flex flex-col justify-between border-8 border-on-surface h-72 md:h-[400px]">
            <div className="relative z-10">
              <span className="material-symbols-outlined text-6xl md:text-7xl text-on-surface mb-4 md:mb-6">
                terminal
              </span>
              <h3 className="font-display-lg text-3xl md:text-4xl uppercase leading-tight">
                BRAIN
                <br />
                STATIC
              </h3>
              <p className="font-body-md text-xs text-on-surface-variant mt-2 uppercase">
                We discuss things. Important things. Possibly made-up things. The
                line is the point.
              </p>
            </div>
            <div className="bg-white px-4 py-2 font-display-lg text-base md:text-lg sticker-border rounded-xl transform -rotate-3 text-center uppercase w-fit">
              THINK HARD
            </div>
          </div>

          {/* BODY PROTOCOL */}
          <div className="pop-gradient-2 rounded-[32px] md:rounded-[40px] p-6 md:p-8 sticker-border sticker-shadow relative overflow-hidden flex flex-col justify-between border-8 border-on-surface h-72 md:h-[400px]">
            <div className="relative z-10">
              <span className="material-symbols-outlined text-6xl md:text-7xl text-on-surface mb-4 md:mb-6">
                sprint
              </span>
              <h3 className="font-display-lg text-3xl md:text-4xl uppercase leading-tight">
                BODY
                <br />
                PROTOCOL
              </h3>
              <p className="font-body-md text-xs text-on-surface-variant mt-2 uppercase">
                Move your body. Through a city. With intention. Or without. The
                movement is the manifesto.
              </p>
            </div>
            <div className="bg-white px-4 py-2 font-display-lg text-base md:text-lg sticker-border rounded-xl transform rotate-3 text-center uppercase w-fit">
              JUST MOVE
            </div>
          </div>

          {/* CONSUME THE STATIC — full-width */}
          <div className="lg:col-span-4 bg-on-surface rounded-[32px] md:rounded-[40px] p-8 md:p-10 sticker-border sticker-shadow relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between border-8 border-on-surface gap-6 md:gap-8">
            <div className="relative z-10 text-secondary-container">
              <h3 className="font-display-lg text-4xl md:text-6xl mb-3 md:mb-4 uppercase tracking-tighter">
                CONSUME THE STATIC
              </h3>
              <p className="font-display-lg text-xl md:text-2xl italic text-white/80 max-w-2xl">
                EATING IS POLITICAL. EATING IS ALSO JUST EATING. WE DO BOTH.
                SIMULTANEOUSLY. AT A TABLE THAT MAY OR MAY NOT EXIST.
              </p>
            </div>
            <div className="flex relative z-10 gap-5 md:gap-8">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-primary-container rounded-[24px] md:rounded-[30px] sticker-border flex items-center justify-center transform rotate-12 sticker-shadow">
                <span className="material-symbols-outlined text-5xl md:text-7xl text-white">
                  restaurant
                </span>
              </div>
              <div className="w-24 h-24 md:w-32 md:h-32 bg-tertiary-fixed rounded-[24px] md:rounded-[30px] sticker-border flex items-center justify-center transform -rotate-6 sticker-shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="pop mascot small"
                  className="w-16 md:w-20 h-16 md:h-20"
                  src="https://lh3.googleusercontent.com/aida/ADBb0ui0V5hyJ4LKbmlRdKH5X_RqRCugYELRGY8eBAIvuLu429nejk93_NBDXzDMwuB4XxOHV1hzHSp1x7Clz2vyVMABBenUmmIqLUaWrA9LHnyNUQ63k7yK6QlRq3FJZAQCU3Y36nTxrE4zVrl17cdBxjPRG2FgkAS8qI4wRtBiiMrfY90CPMTsmHPulP-vqdhGURM8ugNzC8V2yQ1k1PZ2dUcwY0TMFWfWtHKo_Liz1v_-nbSMrXRbRHwyJnM"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
