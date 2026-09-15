/**
 * The TubeData mark: a play button with rows of data inside it.
 *
 * Which is the product in one shape — a video, and the record behind it. It
 * replaced a plain "T" placeholder.
 *
 * WHY IT SURVIVES SHRINKING, which is the only real test a mark has to pass:
 * the silhouette is a plain play triangle and the rows are knocked out of it,
 * so as the mark gets smaller the rows close up and it degrades into the most
 * recognisable shape on the internet. Nothing depends on reading the detail.
 * Earlier attempts sliced the triangle itself into three pieces; at 16px those
 * stopped reading as a play button at all, which is the failure this avoids.
 *
 * GEOMETRY. The triangle spans x 10.8 → 23.8 and y 8.1 → 23.9, apex right, with
 * quadratic curves rounding all three corners. The rows sit between x 13.1 and
 * x 20.7, comfortably inside those edges — the longest row ends at 20.7 where
 * the triangle still reaches 22.6, so there is ~2 units of clearance. Lengthen
 * a row past that and it will break out through the hypotenuse.
 *
 * Colours are the ones this replaced: near-black on the site's sky→indigo
 * gradient, with the rows in slate-50 rather than pure white.
 *
 * THIS ARTWORK EXISTS IN THREE PLACES and they have to be changed together:
 * here, src/app/icon.svg (the favicon), and MARK_SVG in
 * src/app/opengraph-image.tsx (the share card, which Satori renders and so
 * cannot use this component).
 *
 * A single `<defs>` id is fine even when two of these render on one page — the
 * definitions are identical, so whichever wins paints the same gradient.
 */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="TubeData"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="tubedata-mark"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>

      <rect width="32" height="32" rx="8" fill="url(#tubedata-mark)" />

      <path
        d="M12 8.8 Q10.8 8.1 10.8 9.5 L10.8 22.5 Q10.8 23.9 12 23.2 L22.6 17.1 Q23.8 16.4 22.6 15.7 Z"
        fill="#0A0E18"
      />

      {/* The record inside the video. Uneven lengths on purpose: three equal
          bars read as a menu icon, not as data. */}
      <rect x="13.1" y="13.2" width="5.4" height="1.15" rx="0.5" fill="#F8FAFC" />
      <rect x="13.1" y="15.45" width="7.6" height="1.15" rx="0.5" fill="#F8FAFC" />
      <rect x="13.1" y="17.7" width="4.2" height="1.15" rx="0.5" fill="#F8FAFC" />
    </svg>
  );
}
