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

export const UNSCORED_COLOUR = "#7d8794";

const SCALE_STOPS = ["#3288bd", "#66c2a5", "#abdda4", "#fee08b", "#fdae61", "#f46d43", "#d53e4f"].map((hex) => new Color(hex));

export const SCALE_GRADIENT = `linear-gradient(90deg, ${SCALE_STOPS.map((c) => `#${c.getHexString()}`).join(", ")})`;

/** Map a probability in [0, 1] onto the blue → green → yellow → orange → red (ColorBrewer Spectral) risk scale. */
export function riskColour(probability: number): string {
  const position = Math.min(Math.max(probability, 0), 1) * (SCALE_STOPS.length - 1);
  const lower = Math.min(Math.floor(position), SCALE_STOPS.length - 2);
  const mixed = SCALE_STOPS[lower].clone().lerp(SCALE_STOPS[lower + 1], position - lower);
  return `#${mixed.getHexString()}`;
}

export const percent = (probability: number): string => `${Math.round(probability * 100)}%`;
