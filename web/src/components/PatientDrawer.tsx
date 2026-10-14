import { type RefObject } from "react";
import type { PatientValues } from "../data/fields";
import { PatientForm } from "./PatientForm";

interface Props {
  dialogRef: RefObject<HTMLDialogElement | null>;
  values: PatientValues;
  busy: boolean;
  onChange: (name: string, value: string | number) => void;
  onSubmit: () => void;
}

export function PatientDrawer({ dialogRef, values, busy, onChange, onSubmit }: Props) {
  return (
    <dialog
      ref={dialogRef}
      className="drawer"
      aria-labelledby="drawer-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="drawer__head">
        <h2 id="drawer-title">Patient data</h2>
        <button type="button" className="secondary" onClick={() => dialogRef.current?.close()}>
          Close
        </button>
      </div>
      <p className="drawer__lead">Enter or edit the patient's values, then press Estimate risk at the bottom to calculate. Field names follow the published dataset.</p>
      <PatientForm values={values} busy={busy} onChange={onChange} onSubmit={onSubmit} />
    </dialog>
  );
}
