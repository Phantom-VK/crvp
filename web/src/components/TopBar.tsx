export function TopBar({ onOpenData }: { onOpenData: () => void }) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <h1>CRVP</h1>
        <p>Coronary risk and per-vessel stenosis from clinical data</p>
      </div>
      <button type="button" className="primary" onClick={onOpenData}>
        Estimate risk
      </button>
    </header>
  );
}
