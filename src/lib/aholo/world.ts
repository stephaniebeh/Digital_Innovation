import { AHOLO_API_BASE, getAholoHeaders } from "./config";

import {

  extractSplatUrls,

  extractWorldId,

  parseApiError,

  unwrapGatewayBody,
  type NormalizedSplatUrls,
} from "./gateway";

import { readResponseJson } from "./http";



export type WorldResource = {

  url: string;

  type?: "image" | "video";

};



export type CreateReconstructionInput = {

  name?: string;

  resources: WorldResource[];

  scene: "model" | "space";

  taskQuality: "low" | "normal" | "high";

  cover?: string;

};



export type WorldStatus =

  | "PENDING"

  | "RUNNING"

  | "SUCCEEDED"

  | "FAILED"

  | "CANCELED";



export type WorldDetail = {

  worldId: string;

  name?: string;

  cover?: string;

  scene?: string;

  createTime?: number;

  updateTime?: number;

  status: WorldStatus;

  assets?: {

    splats?: {

      urls?: NormalizedSplatUrls;

    };

  };

};

function normalizeWorldDetail(

  raw: Record<string, unknown>,

  worldId: string

): WorldDetail {

  const body = unwrapGatewayBody(raw);

  const splatUrls = extractSplatUrls(body.assets);



  return {

    worldId: (body.worldId as string) ?? worldId,

    name: body.name as string | undefined,

    cover: body.cover as string | undefined,

    scene: body.scene as string | undefined,

    createTime: body.createTime as number | undefined,

    updateTime: body.updateTime as number | undefined,

    status: (body.status as WorldStatus) ?? "PENDING",

    assets: splatUrls ? { splats: { urls: splatUrls } } : undefined,

  };

}



export async function createReconstruction(

  input: CreateReconstructionInput

): Promise<{ worldId: string }> {

  const imageResources = input.resources.map((r) => ({

    url: r.url,

    type: (r.type ?? "image") as "image" | "video",

  }));



  const payload = {

    name: input.name ?? "Afterimage reconstruction",

    resources: imageResources,

    scene: input.scene,

    taskQuality: input.taskQuality,

    cover: input.cover ?? imageResources[0]?.url,

  };



  const res = await fetch(`${AHOLO_API_BASE}/world/v1/reconstructions`, {

    method: "POST",

    headers: {

      ...getAholoHeaders(),

      "Content-Type": "application/json",

    },

    body: JSON.stringify(payload),

  });



  const data = await readResponseJson<Record<string, unknown>>(

    res,

    "POST /world/v1/reconstructions"

  );



  if (!res.ok) {

    throw new Error(

      `Failed to create reconstruction (${res.status}): ${parseApiError(data, res.status)}`

    );

  }



  const worldId = extractWorldId(data);

  if (!worldId) {

    throw new Error(

      `Aholo did not return a worldId. Response: ${JSON.stringify(data).slice(0, 400)}`

    );

  }



  return { worldId };

}



export async function getWorldDetail(worldId: string): Promise<WorldDetail> {

  const res = await fetch(`${AHOLO_API_BASE}/world/v1/${worldId}`, {

    headers: getAholoHeaders(),

  });



  const data = await readResponseJson<Record<string, unknown>>(

    res,

    `GET /world/v1/${worldId}`

  );



  if (!res.ok) {

    throw new Error(

      `Failed to get world (${res.status}): ${parseApiError(data, res.status)}`

    );

  }



  return normalizeWorldDetail(data, worldId);

}


