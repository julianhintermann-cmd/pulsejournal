"use client";

/** Last-resort error page (replaces the root layout, so it carries its own minimal styles). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de-CH">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0B0F",
          color: "#ECEFF4",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Da ist etwas schiefgelaufen.</h1>
          <p style={{ color: "#8B93A7", fontSize: 14, margin: "0 0 20px" }}>Bitte lade die Seite neu.</p>
          <button
            type="button"
            onClick={() => {
              reset();
              window.location.reload();
            }}
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 10,
              border: 0,
              background: "#4F7CFF",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Neu laden
          </button>
        </div>
      </body>
    </html>
  );
}
