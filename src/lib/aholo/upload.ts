import crypto from "crypto";
import { AHOLO_API_BASE, getAholoHeaders } from "./config";
import { normalizeGlobalDomain, readResponseJson } from "./http";

export type OusCredentials = {
  ousToken: string;
  globalDomain: string;
  blockSize: number;
};

type OusResponse<T> = {
  c: string;
  m: string;
  d: T;
};

type UploadStatusResult = {
  status: number;
  url?: string;
  uploadKey?: string;
  md5?: string;
};

const UPLOAD_SUCCESS_STATUS = 5;
const POLL_INTERVAL_MS = 400;
const POLL_TIMEOUT_MS = 120_000;

function md5Hex(buffer: Buffer): string {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

function parseBlockRanges(ranges: string[]): number[] {
  const blocks = new Set<number>();

  for (const range of ranges) {
    if (range.includes("-")) {
      const [startStr, endStr] = range.split("-");
      const start = Number(startStr);
      const end = Number(endStr);
      for (let i = start; i <= end; i++) {
        blocks.add(i);
      }
    } else {
      blocks.add(Number(range));
    }
  }

  return [...blocks].sort((a, b) => a - b);
}

async function parseOusJson<T>(res: Response, context: string): Promise<T> {
  const json = await readResponseJson<OusResponse<T>>(res, context);
  if (json.c !== "0") {
    throw new Error(json.m || `${context}: OUS error (${res.status})`);
  }
  return json.d;
}

export async function getOusCredentials(): Promise<OusCredentials> {
  const res = await fetch(`${AHOLO_API_BASE}/asset/v1/token`, {
    headers: getAholoHeaders(),
  });

  const body = await readResponseJson<
    OusCredentials & { c?: string; m?: string; d?: OusCredentials }
  >(res, "GET /asset/v1/token");

  if (body.c !== undefined && body.c !== "0") {
    throw new Error(body.m || "GET /asset/v1/token failed");
  }

  // Gateway may return flat fields or { c, d: { ... } } style payloads.
  const raw = (body.d ?? body) as OusCredentials;

  if (!raw.ousToken || !raw.globalDomain) {
    throw new Error(
      `GET /asset/v1/token: missing ousToken or globalDomain. Body: ${JSON.stringify(body).slice(0, 300)}`
    );
  }

  const blockSize = Number(raw.blockSize);
  if (!Number.isFinite(blockSize) || blockSize <= 0) {
    throw new Error(
      `GET /asset/v1/token: invalid blockSize (${String(raw.blockSize)})`
    );
  }

  return {
    ousToken: raw.ousToken,
    globalDomain: normalizeGlobalDomain(raw.globalDomain),
    blockSize,
  };
}

async function pollUploadStatus(
  globalDomain: string,
  ousToken: string
): Promise<string> {
  const started = Date.now();

  while (Date.now() - started < POLL_TIMEOUT_MS) {
    const res = await fetch(`${globalDomain}/ous/api/v2/upload/status`, {
      headers: { "ous-token-v2": ousToken },
    });

    const data = await parseOusJson<UploadStatusResult>(
      res,
      `GET ${globalDomain}/ous/api/v2/upload/status`
    );

    if (data.status === UPLOAD_SUCCESS_STATUS && data.url) {
      return data.url;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error("Upload timed out waiting for OUS status");
}

async function uploadSingle(
  buffer: Buffer,
  filename: string,
  credentials: OusCredentials
): Promise<string> {
  const { globalDomain, ousToken } = credentials;
  const md5 = md5Hex(buffer);

  const form = new FormData();
  form.append("md5", md5);
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/octet-stream" }),
    filename
  );

  const res = await fetch(`${globalDomain}/ous/api/v2/single/upload`, {
    method: "POST",
    headers: { "ous-token-v2": ousToken },
    body: form,
  });

  await parseOusJson<{ taskId: string }>(
    res,
    `POST ${globalDomain}/ous/api/v2/single/upload`
  );
  return pollUploadStatus(globalDomain, ousToken);
}

async function uploadMultipart(
  buffer: Buffer,
  filename: string,
  credentials: OusCredentials
): Promise<string> {
  const { globalDomain, ousToken, blockSize } = credentials;
  const md5 = md5Hex(buffer);
  const blocks = Math.ceil(buffer.length / blockSize);

  const initUrl = new URL(`${globalDomain}/ous/api/v2/block/upload/init`);
  initUrl.searchParams.set("md5", md5);
  initUrl.searchParams.set("blocks", String(blocks));
  initUrl.searchParams.set("size", String(buffer.length));
  initUrl.searchParams.set("name", filename);

  const initRes = await fetch(initUrl, {
    method: "POST",
    headers: { "ous-token-v2": ousToken },
  });

  const initData = await parseOusJson<{
    taskId: number;
    lackBlocks: string[];
  }>(initRes, `POST ${globalDomain}/ous/api/v2/block/upload/init`);

  const blockNumbers =
    initData.lackBlocks.length > 0
      ? parseBlockRanges(initData.lackBlocks)
      : Array.from({ length: blocks }, (_, i) => i + 1);

  for (const blockNum of blockNumbers) {
    const start = (blockNum - 1) * blockSize;
    const end = Math.min(start + blockSize, buffer.length);
    const chunk = buffer.subarray(start, end);

    const form = new FormData();
    form.append("block", String(blockNum));
    form.append(
      "file",
      new Blob([new Uint8Array(chunk)], { type: "application/octet-stream" }),
      `${filename}.part${blockNum}`
    );

    const partRes = await fetch(`${globalDomain}/ous/api/v2/block/upload/part`, {
      method: "POST",
      headers: { "ous-token-v2": ousToken },
      body: form,
    });

    await parseOusJson<null>(
      partRes,
      `POST ${globalDomain}/ous/api/v2/block/upload/part`
    );
  }

  return pollUploadStatus(globalDomain, ousToken);
}

export async function uploadFileToOus(
  buffer: Buffer,
  filename: string,
  credentials?: OusCredentials
): Promise<string> {
  const creds = credentials ?? (await getOusCredentials());

  if (buffer.length <= creds.blockSize) {
    return uploadSingle(buffer, filename, creds);
  }

  return uploadMultipart(buffer, filename, creds);
}

export async function uploadFilesToOus(
  files: { buffer: Buffer; filename: string }[]
): Promise<string[]> {
  // OUS tokens are single-use — fetch a new token per file, upload sequentially.
  const urls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    urls.push(await uploadFileToOus(file.buffer, file.filename));
  }

  return urls;
}
