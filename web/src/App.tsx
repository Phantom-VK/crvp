import { useRef, useState } from "react";
import type { Predictions, TargetId, VesselId } from "./api/types";
import { DataBanner } from "./components/DataBanner";
import { HeartViewer } from "./components/HeartViewer";
import { Honesty } from "./components/Honesty";
import { LegalBar } from "./components/LegalBar";
import { ModelPanel } from "./components/ModelPanel";
import { PatientDrawer } from "./components/PatientDrawer";
import { TargetDetail } from "./components/TargetDetail";
import { TargetRail } from "./components/TargetRail";
import { TopBar } from "./components/TopBar";
import { usePatient } from "./hooks/usePatient";

function vesselProbabilities(predictions: Predictions | null) {
  if (!predictions) return {};
  return { LAD: predictions.LAD.probability, LCX: predictions.LCX.probability, RCA: predictions.RCA.probability };
}

export function App() {
  const patient = usePatient();
  const [selected, setSelected] = useState<TargetId>("Cath");
  const drawer = useRef<HTMLDialogElement>(null);
  const modelPanel = useRef<HTMLDialogElement>(null);
  const { predictions } = patient;
  const exampleLabel = patient.presets.find((preset) => preset.id === patient.presetId)?.label ?? "";
  const vessel: VesselId | null = selected === "Cath" ? null : selected;

  const estimate = async () => {
    await patient.submit();
    drawer.current?.close();
  };

  return (
    <div className="shell">
      <TopBar onOpenData={() => drawer.current?.showModal()} onOpenModel={() => modelPanel.current?.showModal()} />
      <DataBanner origin={patient.origin} exampleLabel={exampleLabel} notice={patient.notice} />

      <div className="workspace">
        <aside className="rail" aria-label="Patient and targets">
          <label className="preset">
            <span>Example patient</span>
            <select value={patient.presetId} onChange={(event) => patient.choosePreset(event.target.value)}>
              {patient.presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          {predictions && <TargetRail predictions={predictions} selected={selected} onSelect={setSelected} />}
        </aside>

        <main className="canvas">
          <HeartViewer
            probabilities={vesselProbabilities(predictions)}
            selected={vessel}
            onSelect={(id) => setSelected(id ?? "Cath")}
          />
          <p className="canvas__hint">Drag to rotate. Click a vessel or a target to explain it.</p>
        </main>

        <aside className="detail" aria-label="Selected target">
          {predictions && <TargetDetail id={selected} prediction={predictions[selected]} patient={patient.values} example={patient.origin === "stored" || patient.origin === "fallback"} />}
          <Honesty />
        </aside>
      </div>

      <LegalBar />
      <ModelPanel dialogRef={modelPanel} />
      <PatientDrawer
        dialogRef={drawer}
        values={patient.values}
        busy={patient.busy}
        onChange={patient.edit}
        onSubmit={estimate}
      />
    </div>
  );
}
