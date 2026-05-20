"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="bg-secondary-container w-full top-0 sticky z-50 border-b-8 border-on-surface shadow-[0px_8px_0px_0px_rgba(27,27,30,1)]">
      <div className="flex justify-between items-center px-4 md:px-16 py-3 w-full max-w-full mx-auto">
        <div className="flex items-center gap-3 md:gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Mascot"
            className="w-10 h-10 md:w-14 md:h-14 rounded-full sticker-border hidden sm:block bg-white"
            src="https://lh3.googleusercontent.com/aida/ADBb0ui0V5hyJ4LKbmlRdKH5X_RqRCugYELRGY8eBAIvuLu429nejk93_NBDXzDMwuB4XxOHV1hzHSp1x7Clz2vyVMABBenUmmIqLUaWrA9LHnyNUQ63k7yK6QlRq3FJZAQCU3Y36nTxrE4zVrl17cdBxjPRG2FgkAS8qI4wRtBiiMrfY90CPMTsmHPulP-vqdhGURM8ugNzC8V2yQ1k1PZ2dUcwY0TMFWfWtHKo_Liz1v_-nbSMrXRbRHwyJnM"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="IT'S STATIC"
            className="h-10 md:h-14 filter drop-shadow-[2px_2px_0px_#000]"
            src="https://lh3.googleusercontent.com/aida/ADBb0uhqB2RSMzGaKnMznnykCI_3KjTl3OfTCYXSIgIhCtKhCVmo5FW8eLo22NLSIB_6alM_gJq2kkgsYuJROPspSSpgI1c2IOxpAeYOjO6SGJON2l3fCMeS_oARBEskmcp4pydRib_kXYoDbjUsxx0ZtfCB0qEDA5o1LTxCr6VlYmGaadxQV3XV-dw1a6S8kCjM89pWoG-CuqR1ZeSpTYpHwzdBVdpDIMmvUKbJwKPH2Vq_VrR6s5ShN7jU0Io"
          />
        </div>

        {session?.user ? (
          <div className="flex items-center gap-3">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? "User"}
                referrerPolicy="no-referrer"
                className="w-9 h-9 md:w-11 md:h-11 rounded-full border-4 border-on-surface shadow-[2px_2px_0px_0px_#1b1b1e]"
              />
            )}
            <span className="hidden sm:block font-label-lg text-on-secondary-container text-sm font-bold truncate max-w-[120px]">
              {session.user.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="tactile-button bg-error text-on-error px-4 md:px-6 py-2 md:py-3 font-display-lg text-sm md:text-base rounded-xl uppercase"
            >
              SIGN OUT
            </button>
          </div>
        ) : (
          <Link
            href="/auth"
            className="tactile-button bg-primary-container text-on-primary-container px-5 md:px-8 py-2 md:py-3 font-display-lg text-base md:text-xl rounded-xl uppercase"
          >
            ENLIST
          </Link>
        )}
      </div>
    </header>
  );
}
