// Bakes per-vertex colours for the heart-wall mesh into web/public/anatomy/heartwall-colors.bin.
//
// The colours are deterministic, so they are computed once here instead of on every page load. The mesh is
// welded with the same code the viewer uses (web/src/components/geometry.ts), so vertex order matches.
//
// Usage (from the repo root, after `npm ci` in web/):  node scripts/bake_heart_colours.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BufferAttribute, Color, Vector3 } from "../web/node_modules/three/build/three.module.js";
import { STLLoader } from "../web/node_modules/three/examples/jsm/loaders/STLLoader.js";
import { mergeVertices } from "../web/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js";

const ANATOMY = fileURLToPath(new URL("../web/public/anatomy/", import.meta.url));
const HEART_FILE = "FMA7274_heartwall";
const VESSEL_FILES = ["FMA3862nsn", "FMA3895", "FMA3802", "FMA3818", "FMA3840nsn", "FMA76994"];

// Myocardium is a deep reddish-brown (myoglobin); epicardial fat is a creamy yellow that collects along
// the coronary grooves and toward the base of the heart.
const MUSCLE = new Color("#a14a40");
const FAT = new Color("#cfa774");
const APEX_TO_BASE = new Vector3(-0.4, 0.333, 0.854);
const FAT_REACH_MM = 8;
const FAT_CORE_MM = 3;
const VESSEL_FAT_STRENGTH = 0.5;
const BASE_FAT_FROM = 0.72;
const BASE_FAT_STRENGTH = 0.55;
const CELL_MM = FAT_REACH_MM;

const smoothstep = (low, high, x) => {
  const t = Math.min(Math.max((x - low) / (high - low), 0), 1);
  return t * t * (3 - 2 * t);
};

const load = (name) => {
  const bytes = readFileSync(`${ANATOMY}${name}.stl`);
  return new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

function weld(geometry) {
  const unindexed = geometry.clone();
  unindexed.deleteAttribute("normal");
  const merged = mergeVertices(unindexed, 0.01);
  merged.computeVertexNormals();
  return merged;
}

const key = (ix, iy, iz) => `${ix},${iy},${iz}`;

function vesselGrid() {
  const grid = new Map();
  for (const name of VESSEL_FILES) {
    const position = load(name).attributes.position;
    for (let i = 0; i < position.count; i++) {
      const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
      const k = key(Math.floor(x / CELL_MM), Math.floor(y / CELL_MM), Math.floor(z / CELL_MM));
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(x, y, z);
    }
  }
  return grid;
}

function nearestVessel(grid, x, y, z) {
  const [cx, cy, cz] = [Math.floor(x / CELL_MM), Math.floor(y / CELL_MM), Math.floor(z / CELL_MM)];
  let best = Infinity;
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const cell = grid.get(key(cx + dx, cy + dy, cz + dz));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i += 3) best = Math.min(best, Math.hypot(cell[i] - x, cell[i + 1] - y, cell[i + 2] - z));
      }
  return best;
}

function heightRange(position) {
  const point = new Vector3();
  const heights = new Float32Array(position.count);
  let [low, high] = [Infinity, -Infinity];
  for (let i = 0; i < position.count; i++) {
    heights[i] = APEX_TO_BASE.dot(point.fromBufferAttribute(position, i));
    low = Math.min(low, heights[i]);
    high = Math.max(high, heights[i]);
  }
  return { heights, low, high };
}

function colours(geometry, grid) {
  const position = geometry.attributes.position;
  const { heights, low, high } = heightRange(position);
  const out = new Float32Array(position.count * 3);
  const mixed = new Color();
  for (let i = 0; i < position.count; i++) {
    const near = 1 - smoothstep(FAT_CORE_MM, FAT_REACH_MM, nearestVessel(grid, position.getX(i), position.getY(i), position.getZ(i)));
    const base = smoothstep(BASE_FAT_FROM, 1, (heights[i] - low) / (high - low)) * BASE_FAT_STRENGTH;
    mixed.copy(MUSCLE).lerp(FAT, Math.max(near * VESSEL_FAT_STRENGTH, base));
    mixed.toArray(out, i * 3);
  }
  return out;
}

const wall = weld(load(HEART_FILE));
const baked = colours(wall, vesselGrid());
writeFileSync(`${ANATOMY}heartwall-colors.bin`, Buffer.from(baked.buffer));
console.log(`Wrote ${wall.attributes.position.count} vertex colours (${baked.byteLength} bytes)`);
