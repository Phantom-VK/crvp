import type { BufferGeometry } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Weld coincident STL vertices and recompute normals so curved surfaces shade smoothly. */
export function smooth(geometry: BufferGeometry): BufferGeometry {
  const unindexed = geometry.clone();
  unindexed.deleteAttribute("normal");
  const merged = mergeVertices(unindexed, 0.01);
  merged.computeVertexNormals();
  return merged;
}
