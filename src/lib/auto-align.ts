import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import {
  DEFAULT_TRANSFORM,
  type SceneTransform,
} from "./scene-alignment";

type Vec3 = { x: number; y: number; z: number };

/** Same loader as the point-cloud viewer — handles ASCII/binary and COLMAP normals. */
export function loadCenteredPointCloud(url: string): Promise<Vec3[]> {
  return new Promise((resolve, reject) => {
    const loader = new PLYLoader();
    loader.load(
      url,
      (geometry) => {
        const position = geometry.getAttribute("position");
        if (!position || position.count === 0) {
          reject(new Error(`No vertices in ${url}`));
          return;
        }
        const points: Vec3[] = [];
        for (let i = 0; i < position.count; i++) {
          points.push({
            x: position.getX(i),
            y: position.getY(i),
            z: position.getZ(i),
          });
        }
        resolve(centerPoints(points));
      },
      undefined,
      (err) => {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err && "message" in err
              ? String((err as { message: unknown }).message)
              : `Failed to load ${url}`;
        reject(
          new Error(
            msg.includes("404") || msg.includes("<!DOCTYPE")
              ? `Could not load ${url} — is scene.ply in public/scenes/?`
              : msg
          )
        );
      }
    );
  });
}

function centerPoints(points: Vec3[]): Vec3[] {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
    cz += p.z;
  }
  const n = points.length;
  cx /= n;
  cy /= n;
  cz /= n;
  return points.map((p) => ({
    x: p.x - cx,
    y: p.y - cy,
    z: p.z - cz,
  }));
}

function subsample(points: Vec3[], target: number): Vec3[] {
  if (points.length <= target) return points;
  const step = points.length / target;
  const out: Vec3[] = [];
  for (let i = 0; i < target; i++) {
    out.push(points[Math.floor(i * step)]);
  }
  return out;
}

function nearestIndex(p: Vec3, list: Vec3[]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < list.length; i++) {
    const q = list[i];
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const dz = p.z - q.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function meanSquaredError(source: Vec3[], target: Vec3[]): number {
  let sum = 0;
  for (const p of source) {
    const j = nearestIndex(p, target);
    const q = target[j];
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const dz = p.z - q.z;
    sum += dx * dx + dy * dy + dz * dz;
  }
  return sum / source.length;
}

/** Horn / Kabsch: least-squares rigid transform mapping A → B. */
function kabsch(A: Vec3[], B: Vec3[]): THREE.Matrix4 {
  const n = A.length;
  const ca = new THREE.Vector3();
  const cb = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    ca.add(new THREE.Vector3(A[i].x, A[i].y, A[i].z));
    cb.add(new THREE.Vector3(B[i].x, B[i].y, B[i].z));
  }
  ca.divideScalar(n);
  cb.divideScalar(n);

  let sxx = 0;
  let sxy = 0;
  let sxz = 0;
  let syx = 0;
  let syy = 0;
  let syz = 0;
  let szx = 0;
  let szy = 0;
  let szz = 0;

  for (let i = 0; i < n; i++) {
    const ax = A[i].x - ca.x;
    const ay = A[i].y - ca.y;
    const az = A[i].z - ca.z;
    const bx = B[i].x - cb.x;
    const by = B[i].y - cb.y;
    const bz = B[i].z - cb.z;
    sxx += ax * bx;
    sxy += ax * by;
    sxz += ax * bz;
    syx += ay * bx;
    syy += ay * by;
    syz += ay * bz;
    szx += az * bx;
    szy += az * by;
    szz += az * bz;
  }

  const N = [
    [sxx + syy + szz, syz - szy, szx - sxz, sxy - syx],
    [syz - szy, sxx - syy - szz, sxy + syx, szx + sxz],
    [szx - sxz, sxy + syx, -sxx + syy - szz, syz + szy],
    [sxy - syx, szx + sxz, syz + szy, -sxx - syy + szz],
  ];

  const q = [1, 0, 0, 0];
  for (let iter = 0; iter < 24; iter++) {
    const M = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        M[i][j] = N[i][j];
        for (let k = 0; k < 4; k++) {
          if (k !== i) M[i][j] += 2 * q[k] * N[k][j];
        }
      }
    }
    let max = M[0][0];
    let idx = 0;
    for (let i = 1; i < 4; i++) {
      if (M[i][i] > max) {
        max = M[i][i];
        idx = i;
      }
    }
    const v = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) v[i] = M[idx][i];
    const norm = Math.hypot(v[0], v[1], v[2], v[3]) || 1;
    for (let i = 0; i < 4; i++) q[i] = v[i] / norm;
  }

  const quat = new THREE.Quaternion(q[1], q[2], q[3], q[0]);
  const R = new THREE.Matrix3().setFromMatrix4(
    new THREE.Matrix4().makeRotationFromQuaternion(quat)
  );

  const t = cb.clone().sub(ca.applyMatrix3(R));
  const m = new THREE.Matrix4();
  m.makeRotationFromQuaternion(quat);
  m.setPosition(t);
  return m;
}

function applyMatrix(points: Vec3[], m: THREE.Matrix4): Vec3[] {
  const v = new THREE.Vector3();
  return points.map((p) => {
    v.set(p.x, p.y, p.z).applyMatrix4(m);
    return { x: v.x, y: v.y, z: v.z };
  });
}

function runIcp(
  source: Vec3[],
  target: Vec3[],
  iterations: number
): THREE.Matrix4 {
  let cumulative = new THREE.Matrix4().identity();
  let moved = source.map((p) => ({ ...p }));

  for (let iter = 0; iter < iterations; iter++) {
    const pairsA: Vec3[] = [];
    const pairsB: Vec3[] = [];
    for (const p of moved) {
      const j = nearestIndex(p, target);
      pairsA.push(p);
      pairsB.push(target[j]);
    }
    const step = kabsch(pairsA, pairsB);
    moved = applyMatrix(moved, step);
    cumulative = step.clone().multiply(cumulative);
  }

  return cumulative;
}

function transformToScene(
  delta: THREE.Matrix4,
  base: SceneTransform
): SceneTransform {
  const baseM = new THREE.Matrix4().compose(
    new THREE.Vector3(base.x, base.y, base.z),
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(base.rotationX, base.rotationY, base.rotationZ, "XYZ")
    ),
    new THREE.Vector3(
      base.scale * base.flipX,
      base.scale * base.flipY,
      base.scale * base.flipZ
    )
  );

  const combined = baseM.clone().multiply(delta);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  combined.decompose(pos, quat, scl);

  const euler = new THREE.Euler().setFromQuaternion(quat, "XYZ");
  const avgScale = (Math.abs(scl.x) + Math.abs(scl.y) + Math.abs(scl.z)) / 3;

  return {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    rotationX: euler.x,
    rotationY: euler.y,
    rotationZ: euler.z,
    scale: avgScale,
    flipX: Math.sign(scl.x) || 1,
    flipY: Math.sign(scl.y) || 1,
    flipZ: Math.sign(scl.z) || 1,
  };
}

/**
 * Align source scan to target using ICP on centered COLMAP point clouds.
 * Tries several yaw guesses to handle symmetric ambiguity.
 */
export async function computeAutoAlignTransform(
  sourceUrl: string,
  targetUrl: string,
  referenceTransform: SceneTransform = DEFAULT_TRANSFORM
): Promise<SceneTransform> {
  const [sourcePts, targetPts] = await Promise.all([
    loadCenteredPointCloud(sourceUrl),
    loadCenteredPointCloud(targetUrl),
  ]);

  const source = subsample(sourcePts, 3500);
  const target = subsample(targetPts, 3500);

  const yawCandidates = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  let bestMatrix = new THREE.Matrix4().identity();
  let bestError = Infinity;

  for (const yaw of yawCandidates) {
    const init = new THREE.Matrix4().makeRotationY(yaw);
    const seeded = applyMatrix(source, init);
    const delta = runIcp(seeded, target, 18);
    const combined = init.clone().multiply(delta);
    const aligned = applyMatrix(source, combined);
    const err = meanSquaredError(aligned, target);
    if (err < bestError) {
      bestError = err;
      bestMatrix = combined;
    }
  }

  return transformToScene(bestMatrix, { ...referenceTransform });
}

export const AUTO_ALIGN_HINT =
  "Matches desk2 to desk1 by point-cloud shape (ICP). Works best when layout is similar; small manual tweaks may still help.";
