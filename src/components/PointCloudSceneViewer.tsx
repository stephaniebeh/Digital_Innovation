"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import {
  applySceneTransform,
  sceneTransformFromObject,
  type GizmoMode,
  type SceneId,
  type SceneTransform,
} from "@/lib/scene-alignment";
import {
  configureExplorationControls,
  frameCameraOnObject,
} from "@/lib/viewer-controls";

type Props = {
  primaryUrl: string;
  secondaryUrl: string;
  blend: number;
  primaryTransform: SceneTransform;
  secondaryTransform: SceneTransform;
  overlayBoth?: boolean;
  onCameraQuaternion?: (q: THREE.Quaternion) => void;
  /** 3D gumball — active while align panel is open */
  alignGizmoActive?: boolean;
  editingScene?: SceneId;
  gizmoMode?: GizmoMode;
  onGizmoTransformChange?: (id: SceneId, transform: SceneTransform) => void;
  onGizmoDragStart?: () => void;
  onLoadError?: (message: string | null) => void;
};

function loadPointCloud(url: string): Promise<THREE.Points> {
  const loader = new PLYLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (geometry) => {
        geometry.center();
        const hasColors = geometry.hasAttribute("color");
        const positions = geometry.getAttribute("position");
        const count = positions?.count ?? 0;

        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const size = box.getSize(new THREE.Vector3()).length();
        const pointSize = Math.max((size / Math.sqrt(count)) * 1.8, size / 800);

        const material = new THREE.PointsMaterial({
          size: pointSize,
          vertexColors: hasColors,
          color: hasColors ? undefined : 0xd4c4b0,
          sizeAttenuation: true,
          transparent: false,
        });

        resolve(new THREE.Points(geometry, material));
      },
      undefined,
      reject
    );
  });
}

export default function PointCloudSceneViewer({
  primaryUrl,
  secondaryUrl,
  blend,
  primaryTransform,
  secondaryTransform,
  overlayBoth = false,
  onCameraQuaternion,
  alignGizmoActive = false,
  editingScene = "desk2",
  gizmoMode = "rotate",
  onGizmoTransformChange,
  onGizmoDragStart,
  onLoadError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blendRef = useRef(blend);
  const overlayRef = useRef(overlayBoth);
  const transformsRef = useRef({ primaryTransform, secondaryTransform });
  const onCameraRef = useRef(onCameraQuaternion);
  const gizmoActiveRef = useRef(alignGizmoActive);
  const editingSceneRef = useRef(editingScene);
  const gizmoModeRef = useRef(gizmoMode);
  const onGizmoChangeRef = useRef(onGizmoTransformChange);
  const onGizmoDragStartRef = useRef(onGizmoDragStart);
  const onLoadErrorRef = useRef(onLoadError);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const objectsRef = useRef<{
    primary: THREE.Points | null;
    secondary: THREE.Points | null;
  }>({ primary: null, secondary: null });

  blendRef.current = blend;
  overlayRef.current = overlayBoth;
  transformsRef.current = { primaryTransform, secondaryTransform };
  onCameraRef.current = onCameraQuaternion;
  gizmoActiveRef.current = alignGizmoActive;
  editingSceneRef.current = editingScene;
  gizmoModeRef.current = gizmoMode;
  onGizmoChangeRef.current = onGizmoTransformChange;
  onGizmoDragStartRef.current = onGizmoDragStart;
  onLoadErrorRef.current = onLoadError;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.001, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    configureExplorationControls(controls, camera);
    orbitControlsRef.current = controls;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setSize(1.15);
    transformControls.space = "local";
    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;

    transformControls.addEventListener("mouseDown", () => {
      onGizmoDragStartRef.current?.();
      controls.enabled = false;
    });
    transformControls.addEventListener("mouseUp", () => {
      controls.enabled = true;
    });

    transformControls.addEventListener("objectChange", () => {
      const obj = transformControls.object;
      const onChange = onGizmoChangeRef.current;
      if (!obj || !onChange) return;
      onChange(editingSceneRef.current, sceneTransformFromObject(obj));
    });

    let primaryPoints: THREE.Points | null = null;
    let focusRoot: THREE.Object3D | null = null;
    let secondaryPoints: THREE.Points | null = null;
    let frameId = 0;
    let cancelled = false;

    async function init() {
      try {
        const [primary, secondary] = await Promise.all([
          loadPointCloud(primaryUrl),
          loadPointCloud(secondaryUrl),
        ]);

        if (cancelled) {
          primary.geometry.dispose();
          secondary.geometry.dispose();
          return;
        }

        primaryPoints = primary;
        secondaryPoints = secondary;

        const focus = new THREE.Group();
        focus.add(primary);
        focus.add(secondary);
        scene.add(focus);
        focusRoot = focus;

        objectsRef.current = { primary, secondary };
        syncTransforms();
        applyBlend(blendRef.current);
        syncGizmoAttachment();
        frameCameraOnObject(camera, controls, focus);
        onLoadErrorRef.current?.(null);
      } catch (err) {
        console.error("Point cloud load failed:", err);
        const msg =
          err instanceof Error
            ? err.message
            : `Failed to load point clouds (${primaryUrl}, ${secondaryUrl})`;
        onLoadErrorRef.current?.(msg);
      }
    }

    function syncTransforms() {
      const { primary, secondary } = objectsRef.current;
      const { primaryTransform: pt, secondaryTransform: st } =
        transformsRef.current;
      if (primary) applySceneTransform(primary, pt);
      if (secondary) applySceneTransform(secondary, st);
    }

    function syncGizmoAttachment() {
      const tc = transformControlsRef.current;
      if (!tc) return;
      const { primary, secondary } = objectsRef.current;
      const active = gizmoActiveRef.current;
      const editing = editingSceneRef.current;
      const target = editing === "desk1" ? primary : secondary;

      if (active && target) {
        tc.enabled = true;
        tc.setMode(gizmoModeRef.current);
        if (tc.object !== target) {
          tc.attach(target);
        }
      } else {
        tc.detach();
        tc.enabled = false;
      }
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      onCameraRef.current?.(camera.quaternion.clone());
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

    const onDoubleClick = () => {
      if (focusRoot) frameCameraOnObject(camera, controls, focusRoot);
    };
    renderer.domElement.addEventListener("dblclick", onDoubleClick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      transformControls.detach();
      transformControls.dispose();
      transformControlsRef.current = null;
      orbitControlsRef.current = null;
      controls.dispose();
      renderer.dispose();
      [primaryPoints, secondaryPoints].forEach((pts) => {
        if (!pts) return;
        pts.geometry.dispose();
        (pts.material as THREE.Material).dispose();
      });
      renderer.domElement.remove();
    };
  }, [primaryUrl, secondaryUrl]);

  useEffect(() => {
    const { primary, secondary } = objectsRef.current;
    if (primary) applySceneTransform(primary, primaryTransform);
    if (secondary) applySceneTransform(secondary, secondaryTransform);
    applyBlend(blend);

    const tc = transformControlsRef.current;
    if (!tc) return;
    const active = alignGizmoActive;
    const target = editingScene === "desk1" ? primary : secondary;
    if (active && target) {
      tc.enabled = true;
      tc.setMode(gizmoMode);
      if (tc.object !== target) {
        tc.attach(target);
      }
    } else {
      tc.detach();
      tc.enabled = false;
    }
  }, [
    blend,
    overlayBoth,
    primaryTransform,
    secondaryTransform,
    alignGizmoActive,
    editingScene,
    gizmoMode,
  ]);

  function applyBlend(t: number) {
    const clamped = Math.max(0, Math.min(1, t));
    const { primary, secondary } = objectsRef.current;
    if (!primary || !secondary) return;

    if (overlayRef.current) {
      primary.visible = true;
      secondary.visible = true;
      const matA = primary.material as THREE.PointsMaterial;
      const matB = secondary.material as THREE.PointsMaterial;
      matA.opacity = 0.5;
      matB.opacity = 0.5;
      matA.transparent = true;
      matB.transparent = true;
      return;
    }

    if (clamped <= 0.04) {
      primary.visible = true;
      secondary.visible = false;
      resetMaterial(primary);
      return;
    }
    if (clamped >= 0.96) {
      primary.visible = false;
      secondary.visible = true;
      resetMaterial(secondary);
      return;
    }

    primary.visible = true;
    secondary.visible = true;
    const matA = primary.material as THREE.PointsMaterial;
    const matB = secondary.material as THREE.PointsMaterial;
    matA.opacity = 1 - clamped;
    matB.opacity = clamped;
    matA.transparent = true;
    matB.transparent = true;
  }

  function resetMaterial(points: THREE.Points) {
    const mat = points.material as THREE.PointsMaterial;
    mat.opacity = 1;
    mat.transparent = false;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-zinc-950"
      aria-label="COLMAP point cloud viewer"
    >
      <p className="absolute bottom-3 left-3 z-10 pointer-events-none text-[10px] text-zinc-600 select-none max-w-[min(100%,280px)]">
        {alignGizmoActive
          ? "Gumball: drag handles · 1/2/3 = move/rotate/scale · orbit when not dragging"
          : "Drag orbit · Right-drag pan · Scroll zoom · Double-click reset"}
      </p>
    </div>
  );
}
