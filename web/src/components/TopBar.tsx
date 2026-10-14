export function TopBar({ onOpenData, onOpenModel }: { onOpenData: () => void; onOpenModel: () => void }) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <h1>CRVP</h1>
        <p>Coronary risk and per-vessel stenosis from clinical data</p>
      </div>
      <div className="topbar__actions">
        <button type="button" className="secondary" onClick={onOpenModel}>
          Model &amp; validation
        </button>
        <button type="button" className="primary" onClick={onOpenData}>
          Estimate risk
        </button>
      </div>
    </header>
  );
}
