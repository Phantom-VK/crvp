import type { Predictions } from "./types";
import type { PatientValues } from "../data/fields";

const API_URL: string = import.meta.env.VITE_API_URL ?? "";
const TIMEOUT_MS = 8000;

export class PredictionError extends Error {}

/** POST a patient to the backend. Rejects with a PredictionError carrying a readable reason. */
export async function predict(patient: PatientValues): Promise<Predictions> {
  if (!API_URL) throw new PredictionError("No prediction service is configured for this deployment.");
  let response: Response;
  try {
    response = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patient),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new PredictionError("The prediction service did not respond.");
  }
  if (response.status === 422) throw new PredictionError("A value is outside the range the model accepts.");
  if (!response.ok) throw new PredictionError(`The prediction service returned an error (${response.status}).`);
  return ((await response.json()) as { predictions: Predictions }).predictions;
}
