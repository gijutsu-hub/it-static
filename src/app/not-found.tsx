import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fbf8fc",
        backgroundImage: "radial-gradient(#9f376f 1px, transparent 0)",
        backgroundSize: "24px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-quicksand),'Quicksand',sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#fbf8fc",
          border: "5px solid #1b1b1e",
          boxShadow: "10px 10px 0 #1b1b1e",
          padding: "48px 40px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Big 404 */}
        <div
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontSize: 120,
            fontWeight: 900,
            lineHeight: 1,
            color: "#ff85c1",
            textShadow: "6px 6px 0 #1b1b1e",
            letterSpacing: "-0.04em",
            marginBottom: 8,
          }}
        >
          404
        </div>

        <div
          style={{
            backgroundColor: "#ffe24c",
            border: "3px solid #1b1b1e",
            boxShadow: "4px 4px 0 #1b1b1e",
            padding: "8px 20px",
            display: "inline-block",
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontWeight: 800,
              fontSize: 16,
              textTransform: "uppercase",
              color: "#1b1b1e",
              letterSpacing: "0.04em",
            }}
          >
            SIGNAL LOST
          </span>
        </div>

        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#544249",
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          The page you&apos;re looking for has gone dark.
          <br />
          It may have been moved or never existed.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link
            href="/"
            style={{
              backgroundColor: "#9f376f",
              color: "white",
              border: "3px solid #1b1b1e",
              boxShadow: "5px 5px 0 #1b1b1e",
              padding: "14px 24px",
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontWeight: 800,
              fontSize: 16,
              textTransform: "uppercase",
              textDecoration: "none",
              display: "block",
              letterSpacing: "0.02em",
            }}
          >
            ← RETURN TO BASE
          </Link>
          <Link
            href="/auth"
            style={{
              backgroundColor: "#fbf8fc",
              color: "#1b1b1e",
              border: "3px solid #1b1b1e",
              boxShadow: "5px 5px 0 #1b1b1e",
              padding: "14px 24px",
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontWeight: 800,
              fontSize: 16,
              textTransform: "uppercase",
              textDecoration: "none",
              display: "block",
              letterSpacing: "0.02em",
            }}
          >
            ENLIST NOW
          </Link>
        </div>
      </div>

      <p
        style={{
          marginTop: 24,
          fontSize: 11,
          fontWeight: 700,
          color: "#9f376f",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          opacity: 0.7,
        }}
      >
        IT&apos;S STATIC — THE URBAN RESISTANCE
      </p>
    </div>
  );
}
