import type { Origin } from "../hooks/usePatient";

interface Props {
  origin: Origin;
  exampleLabel: string;
  notice: string | null;
}

const COPY: Record<Origin, { label: string; text: (example: string) => string }> = {
  stored: {
    label: "Example patient data",
    text: (example) =>
      `You are looking at a stored example, "${example}": a real patient from the training set, so these scores are optimistic. Press Estimate risk to enter your own patient.`,
  },
  fallback: {
    label: "Example patient data",
    text: (example) => `The prediction service did not answer, so the stored example "${example}" is shown, not your values.`,
  },
  stale: {
    label: "Inputs not yet estimated",
    text: () => "Patient data was edited but not estimated. The results shown are for the previous values.",
  },
  live: {
    label: "Your patient data",
    text: () => "Results calculated just now by the prediction service for the values you entered.",
  },
};

export function DataBanner({ origin, exampleLabel, notice }: Props) {
  const copy = COPY[origin];
  const isExample = origin === "stored" || origin === "fallback";
  return (
    <div className={`databanner${isExample ? " databanner--example" : ""}`} role="status" data-origin={origin}>
      <strong>{copy.label}</strong>
      <span>{origin === "fallback" && notice ? notice : copy.text(exampleLabel)}</span>
    </div>
  );
}
