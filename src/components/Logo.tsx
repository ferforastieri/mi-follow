/** The mark: a pixel heart in the brand tile, drawn on the same 2px grid as the kit's pixels. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span className="mf-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg
        viewBox="0 0 14 12"
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.54)}
        shapeRendering="crispEdges"
      >
        <g fill="currentColor">
          <rect x="2" y="0" width="4" height="2" />
          <rect x="8" y="0" width="4" height="2" />
          <rect x="0" y="2" width="14" height="2" />
          <rect x="0" y="4" width="14" height="2" />
          <rect x="2" y="6" width="10" height="2" />
          <rect x="4" y="8" width="6" height="2" />
          <rect x="6" y="10" width="2" height="2" />
        </g>
        <rect x="2" y="2" width="2" height="2" className="mf-mark__light" />
      </svg>
    </span>
  );
}

/** Mark and wordmark: "mi" quiet, "follow" certain. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="mf-logo">
      <LogoMark size={size} />
      <span className="mf-logo__word">
        <span className="mf-logo__mi">mi</span> follow
      </span>
    </span>
  );
}
