interface Props {
  busy: boolean;
  onOpenData: () => void;
  onEstimate: () => void;
}

export function TopBar({ busy, onOpenData, onEstimate }: Props) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <h1>CRVP</h1>
        <p>Coronary risk and per-vessel stenosis from clinical data</p>
      </div>
      <div className="topbar__actions">
        <button type="button" className="secondary" onClick={onOpenData}>
          Patient data
        </button>
        <button type="button" className="primary" disabled={busy} onClick={onEstimate}>
          {busy ? "Estimating…" : "Estimate risk"}
        </button>
      </div>
    </header>
  );
}
