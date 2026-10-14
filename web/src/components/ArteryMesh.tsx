import { Html, useCursor } from "@react-three/drei";
import { type ThreeEvent, useLoader } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { type BufferGeometry, BackSide, Box3, type WebGLProgramParametersWithUniforms, Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { UNSCORED_COLOUR, UNSELECTED_COLOUR, percent, riskColour, stlUrl, type VesselSpec } from "../data/vessels";
import { smooth } from "./geometry";

const CLICK_DRAG_TOLERANCE_PX = 4;
const OUTLINE_MM = 0.45;
const OUTLINE_INK = "#2a2320";

// Inverted-hull outline: the back faces are pushed out along their normals so a thin dark edge frames each
// vessel, keeping any risk colour legible against the muscle and fat behind it.
function inflate(shader: WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>\ntransformed += normalize(objectNormal) * ${OUTLINE_MM.toFixed(2)};`,
  );
}

interface ArteryMeshProps {
  vessel: VesselSpec;
  probability: number | null;
  selected: boolean;
  anySelected: boolean;
  onSelect: (id: VesselSpec["id"]) => void;
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

  const recessed = anySelected && !selected && !hovered;
  const riskTint = probability === null ? UNSCORED_COLOUR : riskColour(probability);
  const colour = recessed ? UNSELECTED_COLOUR : riskTint;
  const emphasis = recessed ? 0 : selected ? 0.3 : hovered ? 0.2 : 0.05;
  const opacity = recessed ? 0.55 : 1;

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
        <group key={vessel.files[index]}>
          <mesh geometry={geometry} renderOrder={1}>
            <meshStandardMaterial
              color={OUTLINE_INK}
              roughness={1}
              side={BackSide}
              transparent={opacity < 1}
              opacity={opacity}
              onBeforeCompile={inflate}
            />
          </mesh>
          <mesh geometry={geometry} renderOrder={2}>
            <meshStandardMaterial
              color={colour}
              emissive={colour}
              emissiveIntensity={emphasis}
              roughness={0.5}
              metalness={0.05}
              transparent={opacity < 1}
              opacity={opacity}
            />
          </mesh>
        </group>
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
