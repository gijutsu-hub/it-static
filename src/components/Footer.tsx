import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-surface-container-highest w-full border-t-4 border-on-surface">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-4 md:px-16 py-8 gap-6 w-full max-w-7xl mx-auto">

        <div className="flex flex-col items-start gap-2">
          <div className="font-display-lg text-2xl md:text-3xl text-on-surface uppercase">
            IT&apos;S STATIC
          </div>
          <div className="font-label-sm text-primary uppercase">
            Established to Disrupt.
          </div>
        </div>

        <nav className="flex flex-wrap gap-3 md:gap-6">
          {[
            { label: "ABOUT", href: "/about" },
            { label: "RULES", href: "/about#rules" },
            { label: "GUESS THE STATIC", href: "#guess-the-static" },
            { label: "PRIVACY", href: "/about#privacy" },
            { label: "TERMS", href: "/about#terms" },
            { label: "CONTACT", href: "/contact" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="font-label-lg hover:text-primary transition-colors underline decoration-4 underline-offset-4"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="font-body-md text-primary font-bold bg-primary-fixed-dim px-4 py-2 sticker-border transform rotate-1 inline-block">
          © 2026 IT&apos;S STATIC. STAY ECSTATIC.
        </div>

      </div>
    </footer>
  );
}
