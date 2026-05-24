import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About & Legal",
  description:
    "IT'S STATIC platform overview, rules, terms, privacy policy, GDPR, cookie and permission consent.",
};

const sections = [
  { id: "about", label: "ABOUT" },
  { id: "rules", label: "RULES" },
  { id: "terms", label: "TERMS" },
  { id: "refund", label: "REFUND" },
  { id: "privacy", label: "PRIVACY" },
  { id: "gdpr", label: "GDPR" },
  { id: "cookies", label: "COOKIES" },
  { id: "permissions", label: "PERMISSIONS" },
];

function SectionCard({
  id,
  label,
  accent,
  children,
}: {
  id: string;
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="bg-white sticker-border sticker-shadow rounded-2xl md:rounded-3xl p-6 md:p-10 scroll-mt-24"
    >
      <div
        className={`inline-block ${accent} px-4 py-1 sticker-border font-display-lg text-xl md:text-2xl uppercase tracking-tight mb-6 transform -rotate-1`}
      >
        {label}
      </div>
      <div className="font-body-md text-on-surface leading-relaxed space-y-4 text-sm md:text-base">
        {children}
      </div>
    </section>
  );
}

function Rule({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="bg-primary text-on-primary font-display-lg text-sm px-2 py-0.5 sticker-border shrink-0 mt-0.5">
        {String(n).padStart(2, "0")}
      </span>
      <p className="text-on-surface">{children}</p>
    </div>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display-lg text-base md:text-lg uppercase text-on-surface tracking-tight mt-6 mb-2">
      {children}
    </h3>
  );
}

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="flex flex-col flex-1">

        {/* ── Hero ── */}
        <section className="py-10 md:py-16 px-4 md:px-16 border-b-8 border-on-surface">
          <div className="max-w-7xl mx-auto">
            <div className="inline-block bg-tertiary-fixed text-on-tertiary-fixed px-5 py-2 sticker-border sticker-shadow transform -rotate-1 font-display-lg text-lg md:text-2xl uppercase tracking-tighter mb-6 mobile-no-rotate">
              TRANSMISSION 002: THE FINE PRINT
            </div>
            <h1 className="font-display-lg text-5xl md:text-7xl text-on-surface leading-[0.9] tracking-tighter uppercase mb-6">
              ABOUT &amp;{" "}
              <span className="bg-secondary-container px-3 sticker-border sticker-shadow inline-block transform rotate-1">
                LEGAL
              </span>
            </h1>
            <p className="font-body-md text-on-surface-variant text-base md:text-lg max-w-2xl font-bold uppercase tracking-wide">
              Everything you need to know about who we are, what we stand for,
              and the framework that keeps the static signal clean.
            </p>
          </div>
        </section>

        {/* ── Anchor nav ── */}
        <div className="sticky top-[72px] z-40 bg-secondary-container border-b-4 border-on-surface overflow-x-auto">
          <div className="flex gap-0 max-w-7xl mx-auto">
            {sections.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="shrink-0 px-4 md:px-6 py-3 font-display-lg text-xs md:text-sm uppercase tracking-tight text-on-secondary-container hover:bg-on-surface hover:text-secondary-container transition-colors border-r-4 border-on-surface"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-7xl mx-auto w-full px-4 md:px-16 py-10 md:py-16 flex flex-col gap-10">

          {/* ABOUT */}
          <SectionCard id="about" label="WHO WE ARE" accent="bg-primary-container text-on-primary-container">
            <p className="font-display-lg text-xl md:text-2xl text-on-surface uppercase leading-tight mb-4">
              IT&apos;S STATIC IS A LOCATION-BASED URBAN SOCIAL PLATFORM —
              BUILT FOR PEOPLE WHO EXIST IN THE REAL WORLD.
            </p>
            <p>
              IT&apos;S STATIC is an urban resistance collective disguised as an
              app. We exist to help real people find real moments in real
              cities — no algorithm-optimised content, no performative
              engagement loops, no hollow notifications designed to keep you
              doom-scrolling.
            </p>
            <p>
              Our platform combines live location sharing within trusted Squads,
              city-wide photo challenges, treasure hunts, a discover map, and a
              leaderboard — all anchored in the belief that proximity,
              spontaneity, and genuine human presence are the most radical acts
              of resistance in the digital age.
            </p>
            <p>
              We verify every member through a KYC (Know Your Crew) process.
              This is not bureaucracy — it is how we keep the static signal
              clean and the community safe.
            </p>
            <p className="font-bold uppercase tracking-wide">
              Headquarters: India · Est. 2025 · Established to Disrupt.
            </p>
          </SectionCard>

          {/* RULES */}
          <SectionCard id="rules" label="RULES & REGULATIONS" accent="bg-tertiary-fixed text-on-tertiary-fixed">
            <p className="mb-6">
              The following rules govern all members of the IT&apos;S STATIC
              community. Violation may result in suspension or permanent removal
              from the platform, with no refund of subscription fees.
            </p>
            <div className="flex flex-col gap-3">
              <Rule n={1}>
                <strong>Real identity only.</strong> You must complete KYC
                verification using your genuine identity. Impersonation of any
                person or entity is strictly prohibited.
              </Rule>
              <Rule n={2}>
                <strong>One account per person.</strong> Creating multiple
                accounts to circumvent bans, boost leaderboard rankings, or
                exploit features is not permitted.
              </Rule>
              <Rule n={3}>
                <strong>Respect physical and digital boundaries.</strong> Do not
                use location features to track, stalk, harass, or intimidate
                other members. Squad location sharing is a privilege, not a
                tool.
              </Rule>
              <Rule n={4}>
                <strong>Content must be original and lawful.</strong> All photos
                submitted in challenges must be your own work and must not
                contain nudity, hate speech, illegal activity, violence, or
                content that violates any applicable law.
              </Rule>
              <Rule n={5}>
                <strong>No bots, no automation.</strong> Automated interactions,
                bots, scraping tools, or scripts that interact with IT&apos;S
                STATIC systems are strictly prohibited.
              </Rule>
              <Rule n={6}>
                <strong>No harassment or hate.</strong> Discrimination based on
                race, gender, religion, sexual orientation, disability,
                nationality, or any other characteristic is a zero-tolerance
                offence.
              </Rule>
              <Rule n={7}>
                <strong>Challenge integrity.</strong> Treasure hunt locations,
                photo challenge submissions, and leaderboard scores must reflect
                genuine, real-world activity. Coordinate manipulation or
                fabricated submissions will result in disqualification and
                account ban.
              </Rule>
              <Rule n={8}>
                <strong>Squad responsibility.</strong> Squad founders are
                responsible for the conduct of their members. If a Squad
                consistently produces violating content, the entire Squad may be
                dissolved.
              </Rule>
              <Rule n={9}>
                <strong>Report, don&apos;t retaliate.</strong> If you encounter
                content or behaviour that violates these rules, report it through
                the platform. Do not engage in counter-harassment.
              </Rule>
              <Rule n={10}>
                <strong>Respect the platform.</strong> Do not attempt to
                reverse-engineer, exploit, or interfere with the IT&apos;S
                STATIC infrastructure, APIs, or services.
              </Rule>
            </div>
          </SectionCard>

          {/* TERMS */}
          <SectionCard id="terms" label="TERMS & CONDITIONS" accent="bg-primary-fixed text-on-primary-fixed">
            <p className="text-xs text-on-surface-variant mb-4">Last updated: May 2026</p>

            <H3>1. Acceptance of Terms</H3>
            <p>
              By accessing or using IT&apos;S STATIC (the &quot;Platform&quot;),
              you agree to be bound by these Terms &amp; Conditions, our Privacy
              Policy, and all applicable laws and regulations. If you do not
              agree, you must discontinue use immediately.
            </p>

            <H3>2. Eligibility</H3>
            <p>
              You must be at least 18 years of age to use the Platform. By
              registering, you represent and warrant that you meet this
              requirement and that all information you provide is accurate and
              truthful.
            </p>

            <H3>3. Account Registration &amp; KYC</H3>
            <p>
              Access to core Platform features requires successful completion of
              our KYC process. You agree to provide genuine identification
              documents when requested. IT&apos;S STATIC reserves the right to
              reject or revoke access if verification fails or if fraudulent
              documents are detected.
            </p>

            <H3>4. Subscriptions</H3>
            <p>
              Certain features are gated behind a subscription tier. Subscription
              fees are billed as stated at the time of purchase. Subscriptions
              auto-renew unless cancelled before the renewal date. IT&apos;S
              STATIC reserves the right to adjust subscription pricing with
              30 days&apos; prior notice.
            </p>

            <H3>5. User Content</H3>
            <p>
              By submitting content (photos, messages, challenge entries) to the
              Platform, you grant IT&apos;S STATIC a non-exclusive, royalty-free,
              worldwide licence to use, display, and distribute that content
              within the Platform. You retain ownership of your content and are
              solely responsible for it.
            </p>

            <H3>6. Intellectual Property</H3>
            <p>
              All Platform branding, design, code, features, and content created
              by IT&apos;S STATIC are the exclusive property of IT&apos;S STATIC
              and its licensors. You may not reproduce, distribute, or create
              derivative works without prior written consent.
            </p>

            <H3>7. Prohibited Conduct</H3>
            <p>
              In addition to the Community Rules above, you agree not to: use
              the Platform for any unlawful purpose; transmit malware or
              disruptive code; interfere with the security of the Platform;
              commercialise any Platform feature without permission; or
              misrepresent your identity.
            </p>

            <H3>8. Termination</H3>
            <p>
              IT&apos;S STATIC may suspend or terminate your account at any time
              for violation of these Terms. You may delete your account at any
              time via the Platform settings. Termination does not automatically
              entitle you to a refund (see Refund Policy).
            </p>

            <H3>9. Disclaimers &amp; Limitation of Liability</H3>
            <p>
              The Platform is provided &quot;as is&quot; without warranties of
              any kind. IT&apos;S STATIC is not liable for any indirect,
              incidental, or consequential damages arising from your use of the
              Platform. Our total liability to you shall not exceed the amount
              paid by you in the 3 months preceding the claim.
            </p>

            <H3>10. Governing Law</H3>
            <p>
              These Terms are governed by the laws of India. Any disputes shall
              be subject to the exclusive jurisdiction of the courts of India.
            </p>
          </SectionCard>

          {/* REFUND */}
          <SectionCard id="refund" label="REFUND POLICY" accent="bg-tertiary-container text-on-tertiary-container">
            <p className="text-xs text-on-surface-variant mb-4">Last updated: May 2026</p>

            <H3>Subscription Refunds</H3>
            <p>
              All subscription purchases are final. IT&apos;S STATIC does not
              offer refunds for unused subscription periods once a billing cycle
              has commenced. If you cancel a subscription, you will retain
              access to subscription features until the end of the current
              billing period.
            </p>

            <H3>Store Purchases</H3>
            <p>
              Digital items purchased through the IT&apos;S STATIC Store
              (including cosmetic items, badges, and boosts) are
              non-refundable once delivered to your account. Refunds may be
              considered on a case-by-case basis if:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>The item was not delivered due to a verified technical error.</li>
              <li>You were charged multiple times for the same item.</li>
              <li>The item was materially different from its description.</li>
            </ul>

            <H3>How to Request a Refund</H3>
            <p>
              Contact us via our official Instagram{" "}
              <Link
                href="https://instagram.com/itstatic.space"
                target="_blank"
                className="underline decoration-4 underline-offset-4 text-primary font-bold"
              >
                @itstatic.space
              </Link>{" "}
              within 7 days of the transaction. Include your registered email
              address and transaction ID.
            </p>

            <H3>Payment Processing</H3>
            <p>
              Payments are processed via Razorpay. Approved refunds are credited
              to the original payment method within 5–10 business days, subject
              to your bank&apos;s processing times.
            </p>
          </SectionCard>

          {/* PRIVACY */}
          <SectionCard id="privacy" label="PRIVACY POLICY" accent="bg-secondary-container text-on-secondary-container">
            <p className="text-xs text-on-surface-variant mb-4">Last updated: May 2026</p>

            <H3>What We Collect</H3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Identity data:</strong> Name, email address, profile photo, KYC documents (processed and not stored in raw form after verification).</li>
              <li><strong>Location data:</strong> Real-time GPS coordinates when you enable live location sharing within a Squad. Location is shared only with your Squad members and is not stored permanently.</li>
              <li><strong>Usage data:</strong> Pages visited, features used, interactions with challenges and the leaderboard, session duration.</li>
              <li><strong>Device data:</strong> Device type, OS version, push notification tokens, IP address.</li>
              <li><strong>Content data:</strong> Photos you submit to challenges, messages sent in Squad or direct chats.</li>
            </ul>

            <H3>How We Use Your Data</H3>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide, maintain, and improve the Platform.</li>
              <li>To verify your identity and prevent fraud.</li>
              <li>To facilitate Squad features and live location sharing within your authorised group.</li>
              <li>To send push notifications you have opted into.</li>
              <li>To process payments and manage subscriptions.</li>
              <li>To enforce our Community Rules and Terms.</li>
              <li>To analyse aggregated, anonymised usage patterns.</li>
            </ul>

            <H3>Data Sharing</H3>
            <p>
              We do not sell your personal data. We share data only with:
              service providers essential to Platform operation (Firebase,
              Razorpay, Google Maps), law enforcement when required by law, and
              other users only to the extent necessary for platform features
              (e.g., your username and profile photo are visible to Squad
              members and on the leaderboard).
            </p>

            <H3>Data Retention</H3>
            <p>
              We retain your data for as long as your account is active. Upon
              account deletion, personal data is removed within 30 days, except
              where retention is required by law.
            </p>

            <H3>Your Rights</H3>
            <p>
              You have the right to access, correct, export, or delete your
              personal data. Contact us via{" "}
              <Link
                href="https://instagram.com/itstatic.space"
                target="_blank"
                className="underline decoration-4 underline-offset-4 text-secondary font-bold"
              >
                @itstatic.space
              </Link>{" "}
              to exercise any of these rights.
            </p>
          </SectionCard>

          {/* GDPR */}
          <SectionCard id="gdpr" label="GDPR COMPLIANCE" accent="bg-primary-container text-on-primary-container">
            <p className="text-xs text-on-surface-variant mb-4">Last updated: May 2026</p>
            <p>
              Where the General Data Protection Regulation (GDPR) applies to
              your use of the Platform, IT&apos;S STATIC acts as the Data
              Controller of your personal data.
            </p>

            <H3>Legal Bases for Processing</H3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contract performance:</strong> Processing necessary to deliver the services you have subscribed to.</li>
              <li><strong>Legitimate interests:</strong> Fraud prevention, platform security, and aggregated analytics.</li>
              <li><strong>Legal obligation:</strong> Compliance with applicable laws and regulations.</li>
              <li><strong>Consent:</strong> Marketing communications and optional data uses — withdrawable at any time.</li>
            </ul>

            <H3>Your GDPR Rights</H3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Right of access (Art. 15):</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Right to rectification (Art. 16):</strong> Request correction of inaccurate data.</li>
              <li><strong>Right to erasure (Art. 17):</strong> Request deletion of your data under certain conditions.</li>
              <li><strong>Right to restriction (Art. 18):</strong> Request restriction of processing in certain circumstances.</li>
              <li><strong>Right to portability (Art. 20):</strong> Receive your data in a machine-readable format.</li>
              <li><strong>Right to object (Art. 21):</strong> Object to processing based on legitimate interests.</li>
            </ul>

            <H3>Data Transfers</H3>
            <p>
              Your data may be processed outside the European Economic Area
              (EEA) by service providers including Google Firebase and Razorpay.
              Where data is transferred internationally, we rely on Standard
              Contractual Clauses or equivalent safeguards.
            </p>

            <H3>Supervisory Authority</H3>
            <p>
              If you believe your GDPR rights have been violated, you have the
              right to lodge a complaint with your local data protection
              supervisory authority.
            </p>
          </SectionCard>

          {/* COOKIES */}
          <SectionCard id="cookies" label="COOKIE POLICY" accent="bg-tertiary-fixed text-on-tertiary-fixed">
            <p className="text-xs text-on-surface-variant mb-4">Last updated: May 2026</p>
            <p>
              IT&apos;S STATIC uses cookies and similar technologies to operate
              the Platform and improve your experience.
            </p>

            <H3>What Are Cookies</H3>
            <p>
              Cookies are small data files stored on your device. They help the
              Platform recognise you across sessions and remember your
              preferences.
            </p>

            <H3>Types of Cookies We Use</H3>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-on-surface text-secondary-container">
                    <th className="text-left p-3 border-2 border-on-surface font-display-lg uppercase">Type</th>
                    <th className="text-left p-3 border-2 border-on-surface font-display-lg uppercase">Purpose</th>
                    <th className="text-left p-3 border-2 border-on-surface font-display-lg uppercase">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Essential", "Session authentication, security tokens, KYC state", "Session / 30 days"],
                    ["Functional", "Theme preferences, notification settings, app installation state", "1 year"],
                    ["Analytics", "Anonymised usage data to improve the Platform (aggregated only)", "90 days"],
                    ["Firebase", "Firebase Authentication and Firestore session management", "Session"],
                  ].map(([type, purpose, duration]) => (
                    <tr key={type} className="border-b-2 border-outline-variant even:bg-surface-container-low">
                      <td className="p-3 border-2 border-on-surface font-bold">{type}</td>
                      <td className="p-3 border-2 border-on-surface">{purpose}</td>
                      <td className="p-3 border-2 border-on-surface">{duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <H3>Your Cookie Choices</H3>
            <p>
              Essential cookies cannot be disabled as they are necessary for the
              Platform to function. For analytical and functional cookies, you
              may adjust your browser settings to block or delete cookies.
              Blocking non-essential cookies may impact certain Platform
              features.
            </p>

            <H3>Third-Party Cookies</H3>
            <p>
              Google Firebase, Google Maps, and Razorpay may set their own
              cookies as part of their service delivery. These are governed by
              each provider&apos;s respective cookie policy.
            </p>
          </SectionCard>

          {/* PERMISSIONS */}
          <SectionCard id="permissions" label="PERMISSION CONSENT" accent="bg-primary-fixed text-on-primary-fixed">
            <p className="mb-4">
              IT&apos;S STATIC requests the following device permissions to
              deliver its core features. Each permission is explained below.
              You can revoke permissions at any time through your device
              settings.
            </p>

            <div className="flex flex-col gap-5">
              {[
                {
                  icon: "location_on",
                  title: "LOCATION (GPS)",
                  required: true,
                  why: "Live location sharing with your Squad, the Discover map, and Treasure Hunt coordinate verification all require real-time GPS access. Location is shared only within your Squad and is never stored permanently on our servers.",
                  when: "Only when you enable Squad live location or are participating in a Hunt. The app does not track you in the background unless you have explicitly enabled background location in a Squad session.",
                },
                {
                  icon: "photo_camera",
                  title: "CAMERA",
                  required: false,
                  why: "Required for Photo Challenges — you must capture and submit original photos taken in real time via the in-app camera. This ensures challenge integrity.",
                  when: "Only when you open the Photo Challenge camera. The app does not access your camera at any other time.",
                },
                {
                  icon: "photo_library",
                  title: "PHOTO LIBRARY",
                  required: false,
                  why: "Allows you to set a profile photo from your device gallery. Not required for challenge submissions.",
                  when: "Only when you select a profile photo. Read-only access to the selected image only.",
                },
                {
                  icon: "notifications",
                  title: "PUSH NOTIFICATIONS",
                  required: false,
                  why: "Enables you to receive Squad activity alerts, Hunt start notifications, Store drops, and direct message pings. You can customise notification types in your account settings.",
                  when: "You will be asked once for notification permission. You can disable notifications at any time in device settings or within the Platform.",
                },
                {
                  icon: "call",
                  title: "MICROPHONE (CALLS)",
                  required: false,
                  why: "Required for voice calls between Squad members through the WebRTC calling feature.",
                  when: "Only when you initiate or answer a voice call. The app does not access your microphone outside of active calls.",
                },
              ].map(({ icon, title, required, why, when }) => (
                <div
                  key={title}
                  className="bg-surface-container-low sticker-border p-5 rounded-xl flex gap-4 items-start"
                >
                  <div className="bg-on-surface text-secondary-container p-3 sticker-border shrink-0">
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-display-lg text-base md:text-lg uppercase">{title}</span>
                      <span
                        className={`text-xs px-2 py-0.5 font-display-lg uppercase sticker-border ${
                          required
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container text-on-surface"
                        }`}
                      >
                        {required ? "Required" : "Optional"}
                      </span>
                    </div>
                    <p className="text-sm mb-1"><strong>Why:</strong> {why}</p>
                    <p className="text-sm text-on-surface-variant"><strong>When accessed:</strong> {when}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Footer CTA */}
          <div className="bg-primary-container sticker-border sticker-shadow rounded-2xl p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="font-display-lg text-2xl md:text-3xl text-on-primary-container uppercase mb-1">
                QUESTIONS? CONCERNS?
              </div>
              <p className="font-body-md text-on-primary-container text-sm md:text-base">
                Reach out to us on Instagram — we actually respond.
              </p>
            </div>
            <Link
              href="/contact"
              className="tactile-button bg-on-surface text-secondary-container px-8 py-4 font-display-lg text-lg rounded-xl uppercase shrink-0"
            >
              CONTACT US
              <span className="material-symbols-outlined ml-2">arrow_forward</span>
            </Link>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
