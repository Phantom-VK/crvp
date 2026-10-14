import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import { BufferAttribute, FileLoader, Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { HEART_FILE, stlUrl } from "../data/vessels";
import { smooth } from "./geometry";

// BodyParts3D places the heart about 1.2 m from the origin; this is the wall mesh's centroid.
export const HEART_CENTRE = new Vector3(16.2, -121.9, 1235.5);

const COLOURS_URL = `${import.meta.env.BASE_URL}anatomy/heartwall-colors.bin`;
const FALLBACK_COLOUR = "#a14a40";

function configureBinary(loader: FileLoader<unknown>): void {
  loader.setResponseType("arraybuffer");
}

// Context only: not a prediction target, so it has no handlers and never takes part in picking.
// Per-vertex muscle and fat colours are baked offline by scripts/bake_heart_colours.mjs, using the same
// welding as smooth(), so they line up with the vertices below.
export function HeartWall() {
  const [raw] = useLoader(STLLoader, [stlUrl(HEART_FILE)]);
  const [baked] = useLoader(FileLoader, [COLOURS_URL], configureBinary);
  const { geometry, painted } = useMemo(() => {
    const wall = smooth(raw);
    const colours = new Float32Array(baked as ArrayBuffer);
    const matches = colours.length === wall.attributes.position.count * 3;
    if (matches) wall.setAttribute("color", new BufferAttribute(colours, 3));
    return { geometry: wall, painted: matches };
  }, [raw, baked]);
  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshStandardMaterial vertexColors={painted} color={painted ? "#ffffff" : FALLBACK_COLOUR} roughness={0.6} metalness={0} />
    </mesh>
  );
}
