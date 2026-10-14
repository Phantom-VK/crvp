import { Color } from "three";
import type { VesselId } from "../api/types";

const ANATOMY_DIR = `${import.meta.env.BASE_URL}anatomy/`;

export interface VesselSpec {
  id: VesselId;
  name: string;
  files: string[];
}

export const VESSELS: VesselSpec[] = [
  { id: "LAD", name: "Left anterior descending", files: ["FMA3862nsn"] },
  { id: "LCX", name: "Left circumflex", files: ["FMA3895"] },
  {
    id: "RCA",
    name: "Right coronary artery",
    files: ["FMA3802", "FMA3818", "FMA3840nsn", "FMA76994"],
  },
];

// Left coronary stem: joins LAD and LCX, drawn for anatomy only and never coloured.
export const CONTEXT_FILES = ["FMA4685"];

export const stlUrl = (file: string): string => `${ANATOMY_DIR}${file}.stl`;

export const UNSCORED_COLOUR = "#6b6f78";

// One-hue sequential ramp (OKLCH hue 50, lightness 0.50 to 0.78), validated for monotone
// lightness and contrast on the dark ground. Lightness carries the value, so it survives colour blindness.
const SCALE_STOPS = ["#9c4803", "#ba5703", "#d96603", "#f37c2b", "#ff9b60"].map((hex) => new Color(hex));

export const SCALE_GRADIENT = `linear-gradient(90deg, ${SCALE_STOPS.map((c) => `#${c.getHexString()}`).join(", ")})`;

/** Map a probability in [0, 1] onto the sequential risk ramp. The percentage is always printed beside it. */
export function riskColour(probability: number): string {
  const position = Math.min(Math.max(probability, 0), 1) * (SCALE_STOPS.length - 1);
  const lower = Math.min(Math.floor(position), SCALE_STOPS.length - 2);
  const mixed = SCALE_STOPS[lower].clone().lerp(SCALE_STOPS[lower + 1], position - lower);
  return `#${mixed.getHexString()}`;
}

/** CV AUC below this marks a vessel model as only weakly discriminating. */
export const LOW_CONFIDENCE_AUC = 0.75;

export const percent = (probability: number): string => `${Math.round(probability * 100)}%`;
