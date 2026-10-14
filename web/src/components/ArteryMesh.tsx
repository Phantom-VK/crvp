import { Html, useCursor } from "@react-three/drei";
import { type ThreeEvent, useLoader } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { type BufferGeometry, Box3, Vector3 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { UNSCORED_COLOUR, percent, riskColour, stlUrl, type VesselSpec } from "../data/vessels";

const CLICK_DRAG_TOLERANCE_PX = 4;

interface ArteryMeshProps {
  vessel: VesselSpec;
  probability: number | null;
  selected: boolean;
  anySelected: boolean;
  onSelect: (id: VesselSpec["id"]) => void;
}

function smooth(geometry: BufferGeometry): BufferGeometry {
  const unindexed = geometry.clone();
  unindexed.deleteAttribute("normal");
  const merged = mergeVertices(unindexed, 0.01);
  merged.computeVertexNormals();
  return merged;
}

function labelAnchor(geometries: BufferGeometry[]): Vector3 {
  const box = new Box3();
  geometries.forEach((geometry) => box.union(new Box3().setFromBufferAttribute(geometry.attributes.position as never)));
  return box.getCenter(new Vector3());
}

export function ArteryMesh({ vessel, probability, selected, anySelected, onSelect }: ArteryMeshProps) {
  const raw = useLoader(STLLoader, vessel.files.map(stlUrl));
  const geometries = useMemo(() => raw.map(smooth), [raw]);
  const anchor = useMemo(() => labelAnchor(geometries), [geometries]);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const colour = probability === null ? UNSCORED_COLOUR : riskColour(probability);
  const emphasis = selected ? 0.55 : hovered ? 0.3 : 0.08;
  const opacity = anySelected && !selected && !hovered ? 0.55 : 1;

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_DRAG_TOLERANCE_PX) return;
    event.stopPropagation();
    onSelect(vessel.id);
  };

  return (
    <group
      onClick={handleClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {geometries.map((geometry, index) => (
        <mesh key={vessel.files[index]} geometry={geometry}>
          <meshStandardMaterial
            color={colour}
            emissive={colour}
            emissiveIntensity={emphasis}
            roughness={0.45}
            metalness={0.05}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
      ))}
      <Html position={anchor} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <span className={`vessel-tag${selected ? " vessel-tag--selected" : ""}`}>
          {vessel.id}
          {probability !== null && <strong>{percent(probability)}</strong>}
        </span>
      </Html>
    </group>
  );
}
