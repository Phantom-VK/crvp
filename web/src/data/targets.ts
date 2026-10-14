import type { TargetId } from "../api/types";
import { LOW_CONFIDENCE_AUC } from "./vessels";

export interface TargetInfo {
  id: TargetId;
  short: string;
  title: string;
  question: string;
}

export const TARGET_INFO: TargetInfo[] = [
  { id: "Cath", short: "Overall CAD", title: "Any coronary disease", question: "that at least one coronary artery is narrowed by 50% or more" },
  { id: "LAD", short: "LAD", title: "Left anterior descending", question: "that the left anterior descending artery is narrowed by 50% or more" },
  { id: "LCX", short: "LCX", title: "Left circumflex", question: "that the left circumflex artery is narrowed by 50% or more" },
  { id: "RCA", short: "RCA", title: "Right coronary artery", question: "that the right coronary artery is narrowed by 50% or more" },
];

export const isLowConfidence = (id: TargetId, auc: number): boolean => id !== "Cath" && auc < LOW_CONFIDENCE_AUC;

/** Plain-language reading of a model's cross-validated AUC. */
export function confidenceNote(auc: number): { label: string; text: string } {
  const score = auc.toFixed(2);
  if (auc >= 0.85) {
    return { label: "Good discrimination", text: `Cross-validated AUC ${score}. On held-out patients this model separates narrowed from open arteries well.` };
  }
  if (auc >= LOW_CONFIDENCE_AUC) {
    return { label: "Moderate discrimination", text: `Cross-validated AUC ${score}. Useful, but expect real misses; read the likely range.` };
  }
  return { label: "Low confidence", text: `Cross-validated AUC ${score}, only modestly better than chance. Treat this as a rough prior and read the likely range, not the single number.` };
}
