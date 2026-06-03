"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  cameraQuaternion: THREE.Quaternion | null;
};

function makeLabelTexture(label: string, color: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(12,12,12,0.92)";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.fillStyle = color;
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, size / 2, size / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function labeledBoxMaterials(): THREE.MeshBasicMaterial[] {
  const faces: { label: string; color: string }[] = [
    { label: "R", color: "#f4a4a4" },
    { label: "L", color: "#a4c8f4" },
    { label: "T", color: "#b8f4b8" },
    { label: "B", color: "#c8b8f4" },
    { label: "F", color: "#f4e4a4" },
    { label: "K", color: "#f4c4a4" },
  ];
  return faces.map(
    ({ label, color }) =>
      new THREE.MeshBasicMaterial({
        map: makeLabelTexture(label, color),
        transparent: true,
        depthTest: false,
      })
  );
}

export default function ViewOrientationGizmo({ cameraQuaternion }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const cameraRef = useRef(cameraQuaternion);

  cameraRef.current = cameraQuaternion;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const size = 72;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    camera.position.set(0, 0, 2.8);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.85, 0.85),
      labeledBoxMaterials()
    );
    scene.add(cube);
    cubeRef.current = cube;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.86, 0.86, 0.86)),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
      })
    );
    scene.add(edges);

    let frameId = 0;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const q = cameraRef.current;
      if (q && cube) {
        cube.quaternion.copy(q).invert();
        edges.quaternion.copy(cube.quaternion);
      }
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      cube.geometry.dispose();
      (cube.material as THREE.MeshBasicMaterial[]).forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      edges.geometry.dispose();
      (edges.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      cubeRef.current = null;
    };
  }, []);

  return (
    <div
      className="absolute bottom-3 right-3 z-50 pointer-events-none flex flex-col items-end gap-0.5"
      aria-hidden
    >
      <div ref={hostRef} className="rounded-md bg-black/40 border border-white/10 p-0.5" />
      <p className="text-[8px] text-zinc-600 tracking-wide pr-0.5">T B L R</p>
    </div>
  );
}
