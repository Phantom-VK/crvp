interface Props {
  autoRotate: boolean;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleRotate: () => void;
}

const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function Tool({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="tool" aria-pressed={pressed} onClick={onClick}>
      <svg {...ICON}>{children}</svg>
      <span>{label}</span>
    </button>
  );
}

export function ViewTools({ autoRotate, onReset, onZoomIn, onZoomOut, onToggleRotate }: Props) {
  return (
    <div className="tools" role="toolbar" aria-label="3D view controls">
      <Tool label="Reset" onClick={onReset}>
        <path d="M4 12a8 8 0 1 0 2.6-5.9" />
        <path d="M4 4v4.5h4.5" />
      </Tool>
      <Tool label="Zoom in" onClick={onZoomIn}>
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5" />
      </Tool>
      <Tool label="Zoom out" onClick={onZoomOut}>
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4.2-4.2M8.5 11h5" />
      </Tool>
      <Tool label="Auto-rotate" pressed={autoRotate} onClick={onToggleRotate}>
        <path d="M20 12a8 8 0 0 1-14.4 4.8" />
        <path d="M4 12a8 8 0 0 1 14.4-4.8" />
        <path d="M18.4 3.5v3.7h-3.7M5.6 20.5v-3.7h3.7" />
      </Tool>
    </div>
  );
}
