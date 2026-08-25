import { ImageResponse } from "next/og";

/**
 * Share card. Generated rather than a static asset so the wordmark and tagline
 * stay in one place — edit here and every future share updates.
 *
 * Deliberately no external fonts or images: this renders at request time on the
 * server, and a network fetch here is a failure mode for something whose whole
 * job is to render reliably when someone pastes a link.
 */
export const alt = "TubeData — every detail behind any YouTube video";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #070a12 0%, #0d1424 55%, #131a2e 100%)",
          color: "#e8eefc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
              color: "#0a0e18",
              fontSize: 38,
              fontWeight: 900,
            }}
          >
            T
          </div>
          {/* Satori requires an explicit display on any element with more than
              one child — text + span counts as two. */}
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, letterSpacing: -0.5 }}>
            <span>TubeData</span>
            <span style={{ color: "#64748b", fontWeight: 400 }}>.io</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 56,
            fontSize: 78,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>Every detail behind</span>
          <span>any YouTube video</span>
        </div>

        <div style={{ marginTop: 40, fontSize: 30, color: "#94a3b8", display: "flex" }}>
          Tags · topic categories · thumbnails · stats over time
        </div>

        <div style={{ marginTop: 28, fontSize: 24, color: "#38bdf8", display: "flex" }}>
          Free — no account needed
        </div>
      </div>
    ),
    size
  );
}
