import { ImageResponse } from "next/og";

/**
 * Share card. Generated rather than a static asset so the wordmark and tagline
 * stay in one place — edit here and every future share updates.
 *
 * Deliberately no external fonts or images: this renders at request time on the
 * server, and a network fetch here is a failure mode for something whose whole
 * job is to render reliably when someone pastes a link.
 */
/**
 * The mark, inlined.
 *
 * Satori (what next/og renders with) does not draw our React <LogoMark/>, and
 * it must not FETCH anything either — a share card that depends on a network
 * call fails exactly when someone pastes a link. So the same artwork lives here
 * as a string and is base64'd into a data URI at render time. It is a copy of
 * src/components/Logo.tsx and src/app/icon.svg: change the mark and change all
 * three, or the share card quietly keeps the old logo.
 */
const MARK_SVG = `<svg viewBox="0 0 32 32" width="64" height="64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#38BDF8"/><stop offset="1" stop-color="#6366F1"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><path d="M12 8.8 Q10.8 8.1 10.8 9.5 L10.8 22.5 Q10.8 23.9 12 23.2 L22.6 17.1 Q23.8 16.4 22.6 15.7 Z" fill="#0A0E18"/><rect x="13.1" y="13.2" width="5.4" height="1.15" rx="0.5" fill="#F8FAFC"/><rect x="13.1" y="15.45" width="7.6" height="1.15" rx="0.5" fill="#F8FAFC"/><rect x="13.1" y="17.7" width="4.2" height="1.15" rx="0.5" fill="#F8FAFC"/></svg>`;

const MARK_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString("base64")}`;

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
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori
              renders to a PNG on the server; next/image has nothing to do here. */}
          <img src={MARK_DATA_URI} width={64} height={64} alt="" />
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
