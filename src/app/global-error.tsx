"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "#fbf8fc",
          backgroundImage: "radial-gradient(#9f376f 1px, transparent 0)",
          backgroundSize: "24px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "'Quicksand',sans-serif",
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
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: "#ff85c1",
              textShadow: "5px 5px 0 #1b1b1e",
              lineHeight: 1,
              marginBottom: 16,
              fontFamily: "'Bricolage Grotesque','Arial Black',sans-serif",
              letterSpacing: "-0.04em",
            }}
          >
            500
          </div>

          <h1
            style={{
              fontFamily: "'Bricolage Grotesque','Arial Black',sans-serif",
              fontSize: 28,
              fontWeight: 900,
              textTransform: "uppercase",
              color: "#1b1b1e",
              marginBottom: 16,
              letterSpacing: "-0.02em",
            }}
          >
            CRITICAL FAILURE
          </h1>

          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#544249",
              lineHeight: 1.6,
              marginBottom: 32,
            }}
          >
            A critical error has brought the system down.
            <br />
            The resistance is regrouping.
          </p>

          {error.digest && (
            <p
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "#877179",
                marginBottom: 24,
                padding: "8px 12px",
                backgroundColor: "#f6f2f7",
                border: "2px solid #e4e1e6",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={unstable_retry}
              style={{
                backgroundColor: "#9f376f",
                color: "white",
                border: "3px solid #1b1b1e",
                boxShadow: "5px 5px 0 #1b1b1e",
                padding: "14px 24px",
                fontFamily: "'Bricolage Grotesque','Arial Black',sans-serif",
                fontWeight: 800,
                fontSize: 16,
                textTransform: "uppercase",
                cursor: "pointer",
                width: "100%",
                letterSpacing: "0.02em",
              }}
            >
              REBOOT SYSTEM
            </button>
            <a
              href="/"
              style={{
                backgroundColor: "#fbf8fc",
                color: "#1b1b1e",
                border: "3px solid #1b1b1e",
                boxShadow: "5px 5px 0 #1b1b1e",
                padding: "14px 24px",
                fontFamily: "'Bricolage Grotesque','Arial Black',sans-serif",
                fontWeight: 800,
                fontSize: 16,
                textTransform: "uppercase",
                textDecoration: "none",
                display: "block",
                letterSpacing: "0.02em",
              }}
            >
              ← RETURN TO BASE
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
