import { useEffect, useState } from "react";
import type { Predictions, Preset, PresetFile, VesselId } from "./api/types";
import { Attribution } from "./components/Attribution";
import { HeartViewer } from "./components/HeartViewer";
import { VesselLegend } from "./components/VesselLegend";
import { percent } from "./data/vessels";

const PRESETS_URL = `${import.meta.env.BASE_URL}presets.json`;

function vesselProbabilities(predictions: Predictions | null): Partial<Record<VesselId, number>> {
  if (!predictions) return {};
  return {
    LAD: predictions.LAD.probability,
    LCX: predictions.LCX.probability,
    RCA: predictions.RCA.probability,
  };
}

export function App() {
  const [file, setFile] = useState<PresetFile | null>(null);
  const [presetId, setPresetId] = useState<string>("");
  const [selected, setSelected] = useState<VesselId | null>(null);

  useEffect(() => {
    fetch(PRESETS_URL)
      .then((response) => response.json() as Promise<PresetFile>)
      .then((loaded) => {
        setFile(loaded);
        setPresetId(loaded.presets[0]?.id ?? "");
      })
      .catch(() => setFile(null));
  }, []);

  const preset: Preset | undefined = file?.presets.find((candidate) => candidate.id === presetId);
  const predictions = preset?.prediction.predictions ?? null;
  const detail = selected && predictions ? predictions[selected] : null;

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>CRVP</h1>
          <p>Coronary risk and per-vessel stenosis estimates from clinical data</p>
        </div>
        <label className="preset">
          <span>Example patient</span>
          <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
            {file?.presets.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
          <small>Real patients from the training set, so these scores are optimistic.</small>
        </label>
      </header>

      <main className="app__main">
        <div className="viewer">
          <HeartViewer probabilities={vesselProbabilities(predictions)} selected={selected} onSelect={setSelected} />
          <p className="viewer__hint">Drag to rotate · scroll to zoom · click a vessel</p>
        </div>
        <aside className="side">
          <VesselLegend predictions={predictions} selected={selected} onSelect={setSelected} />
          {detail && selected && (
            <section className="detail">
              <h2>{selected}</h2>
              <p className="detail__value">{percent(detail.probability)}</p>
              <p>
                Likely range {percent(detail.interval_low)}–{percent(detail.interval_high)} · cross-validated AUC{" "}
                {detail.cv_roc_auc.toFixed(2)}
              </p>
            </section>
          )}
          <p className="caveat">
            Colours show each vessel&apos;s own model estimate. No input to the model localises disease to a particular
            artery, so differences between vessels reflect base rates and overall disease burden, not anatomy.
          </p>
        </aside>
      </main>
      <Attribution />
    </div>
  );
}
