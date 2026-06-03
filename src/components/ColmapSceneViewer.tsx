"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

type Props = {
  primaryUrl: string;
  secondaryUrl: string;
  /** 0 = primary only, 1 = secondary only */
  blend: number;
};

function loadPlyMesh(url: string): Promise<THREE.Mesh> {
  const loader = new PLYLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals();
        const hasColors = geometry.hasAttribute("color");
        const material = new THREE.MeshStandardMaterial({
          vertexColors: hasColors,
          color: hasColors ? undefined : 0xc9b8a8,
          roughness: 0.85,
          metalness: 0.05,
          transparent: true,
          opacity: 1,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        geometry.center();
        mesh.rotation.x = -Math.PI / 2;
        resolve(mesh);
      },
      undefined,
      reject
    );
  });
}

export default function ColmapSceneViewer({
  primaryUrl,
  secondaryUrl,
  blend,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blendRef = useRef(blend);
  const materialsRef = useRef<{
    primary: THREE.MeshStandardMaterial | null;
    secondary: THREE.MeshStandardMaterial | null;
  }>({ primary: null, secondary: null });

  blendRef.current = blend;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 500);
    camera.position.set(1.8, 1.2, 1.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff5e6, 0.9);
    key.position.set(4, 6, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8899ff, 0.25);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    let primaryMesh: THREE.Mesh | null = null;
    let secondaryMesh: THREE.Mesh | null = null;
    let frameId = 0;
    let cancelled = false;

    async function init() {
      try {
        const [primary, secondary] = await Promise.all([
          loadPlyMesh(primaryUrl),
          loadPlyMesh(secondaryUrl),
        ]);

        if (cancelled) {
          primary.geometry.dispose();
          secondary.geometry.dispose();
          return;
        }

        primaryMesh = primary;
        secondaryMesh = secondary;
        scene.add(primary);
        scene.add(secondary);

        materialsRef.current = {
          primary: primary.material as THREE.MeshStandardMaterial,
          secondary: secondary.material as THREE.MeshStandardMaterial,
        };

        applyBlend(blendRef.current);

        const box = new THREE.Box3().setFromObject(primary);
        const size = box.getSize(new THREE.Vector3()).length();
        const dist = size * 1.1;
        camera.position.set(dist * 0.9, dist * 0.55, dist * 0.9);
        controls.target.set(0, 0, 0);
        controls.update();
      } catch (err) {
        console.error("COLMAP scene load failed:", err);
      }
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    init();
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (primaryMesh) {
        primaryMesh.geometry.dispose();
        (primaryMesh.material as THREE.Material).dispose();
      }
      if (secondaryMesh) {
        secondaryMesh.geometry.dispose();
        (secondaryMesh.material as THREE.Material).dispose();
      }
      renderer.domElement.remove();
    };
  }, [primaryUrl, secondaryUrl]);

  useEffect(() => {
    applyBlend(blend);
  }, [blend]);

  function applyBlend(t: number) {
    const clamped = Math.max(0, Math.min(1, t));
    const { primary, secondary } = materialsRef.current;
    if (primary) primary.opacity = 1 - clamped;
    if (secondary) secondary.opacity = clamped;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-zinc-950"
      aria-label="3D COLMAP reconstruction viewer"
    />
  );
}
