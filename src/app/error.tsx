"use client";

import { useEffect } from "react";

export default function ErrorPage({
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
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "#ffd8e7",
            border: "4px solid #ba1a1a",
            boxShadow: "5px 5px 0 #ba1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 44, color: "#ba1a1a" }}
          >
            error
          </span>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontSize: 36,
            fontWeight: 900,
            textTransform: "uppercase",
            color: "#1b1b1e",
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          SIGNAL CORRUPTED
        </h1>

        <div
          style={{
            backgroundColor: "#ffd8e7",
            border: "3px solid #ba1a1a",
            padding: "10px 16px",
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#ba1a1a",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            500 — SYSTEM ERROR
          </p>
        </div>

        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#544249",
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          Something went wrong on our end. The resistance is working on it.
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
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontWeight: 800,
              fontSize: 16,
              textTransform: "uppercase",
              cursor: "pointer",
              width: "100%",
              letterSpacing: "0.02em",
            }}
          >
            RETRY SIGNAL
          </button>
          <a
            href="/"
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
            ← RETURN TO BASE
          </a>
        </div>
      </div>
    </div>
  );
}
