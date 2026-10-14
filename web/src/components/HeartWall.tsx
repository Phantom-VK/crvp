import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import { BufferAttribute, type BufferGeometry, Color, Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { HEART_FILE, VESSELS, stlUrl } from "../data/vessels";
import { smooth } from "./geometry";

// BodyParts3D places the heart about 1.2 m from the origin; this is the wall mesh's centroid.
export const HEART_CENTRE = new Vector3(16.2, -121.9, 1235.5);

// The wall is rendered at true size; the arteries are lifted off it in ArteryMesh instead.
const WALL_SCALE = 1;

// Colours follow clinical photographs and anatomical atlases: myocardium is a deep reddish-brown
// (myoglobin) and epicardial fat is a creamy yellow that collects along the coronary grooves and the base.
const MUSCLE = new Color("#a14a40");
const FAT = new Color("#cfa774");

const APEX_TO_BASE = new Vector3(-0.4, 0.333, 0.854);
const FAT_REACH_MM = 8;
const FAT_CORE_MM = 3;
const BASE_FAT_FROM = 0.72;
const BASE_FAT_STRENGTH = 0.55;
const CELL_MM = FAT_REACH_MM;

const smoothstep = (low: number, high: number, x: number): number => {
  const t = Math.min(Math.max((x - low) / (high - low), 0), 1);
  return t * t * (3 - 2 * t);
};

function cellKey(x: number, y: number, z: number): string {
  return `${Math.floor(x / CELL_MM)},${Math.floor(y / CELL_MM)},${Math.floor(z / CELL_MM)}`;
}

function vesselGrid(geometries: BufferGeometry[]): Map<string, number[]> {
  const grid = new Map<string, number[]>();
  for (const geometry of geometries) {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
      const key = cellKey(x, y, z);
      const cell = grid.get(key) ?? [];
      cell.push(x, y, z);
      grid.set(key, cell);
    }
  }
  return grid;
}

function nearestVessel(grid: Map<string, number[]>, x: number, y: number, z: number): number {
  const [cx, cy, cz] = [Math.floor(x / CELL_MM), Math.floor(y / CELL_MM), Math.floor(z / CELL_MM)];
  let best = Infinity;
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
        if (!cell) continue;
        for (let i = 0; i < cell.length; i += 3) {
          best = Math.min(best, Math.hypot(cell[i] - x, cell[i + 1] - y, cell[i + 2] - z));
        }
      }
  return best;
}

function paintFat(geometry: BufferGeometry, grid: Map<string, number[]>): void {
  const position = geometry.attributes.position;
  const height = Array.from({ length: position.count }, (_, i) => APEX_TO_BASE.dot(new Vector3().fromBufferAttribute(position, i)));
  const [low, high] = [Math.min(...height), Math.max(...height)];
  const colours = new Float32Array(position.count * 3);
  const mixed = new Color();
  for (let i = 0; i < position.count; i++) {
    const near = 1 - smoothstep(FAT_CORE_MM, FAT_REACH_MM, nearestVessel(grid, position.getX(i), position.getY(i), position.getZ(i)));
    const base = smoothstep(BASE_FAT_FROM, 1, (height[i] - low) / (high - low)) * BASE_FAT_STRENGTH;
    mixed.copy(MUSCLE).lerp(FAT, Math.max(near * 0.5, base));
    mixed.toArray(colours, i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colours, 3));
}

// Context only: not a prediction target, so it has no handlers and never takes part in picking.
export function HeartWall() {
  const [raw] = useLoader(STLLoader, [stlUrl(HEART_FILE)]);
  const vessels = useLoader(STLLoader, VESSELS.flatMap((vessel) => vessel.files.map(stlUrl)));
  const geometry = useMemo(() => {
    const wall = smooth(raw);
    wall.translate(-HEART_CENTRE.x, -HEART_CENTRE.y, -HEART_CENTRE.z);
    wall.scale(WALL_SCALE, WALL_SCALE, WALL_SCALE);
    wall.translate(HEART_CENTRE.x, HEART_CENTRE.y, HEART_CENTRE.z);
    paintFat(wall, vesselGrid(vessels));
    return wall;
  }, [raw, vessels]);
  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshPhysicalMaterial vertexColors roughness={0.55} metalness={0} clearcoat={0.25} clearcoatRoughness={0.5} />
    </mesh>
  );
}
