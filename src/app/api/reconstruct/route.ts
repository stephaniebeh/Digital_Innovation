import { NextResponse } from "next/server";
import { MIN_RECONSTRUCTION_IMAGES } from "@/lib/aholo/config";
import { uploadFileToOus } from "@/lib/aholo/upload";
import { createReconstruction } from "@/lib/aholo/world";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files received" }, { status: 400 });
    }

    if (files.length < MIN_RECONSTRUCTION_IMAGES) {
      return NextResponse.json(
        {
          error: `At least ${MIN_RECONSTRUCTION_IMAGES} images are required for reconstruction`,
          imageCount: files.length,
        },
        { status: 400 }
      );
    }

    const scene =
      (formData.get("scene") as "model" | "space" | null) ?? "space";
    const taskQuality =
      (formData.get("taskQuality") as "low" | "normal" | "high" | null) ??
      "high";
    const name = (formData.get("name") as string | null) ?? undefined;

    const uploads = files.map((file, index) => {
      const mime = file.type.toLowerCase();
      if (mime && !mime.startsWith("image/")) {
        throw new Error(
          `File "${file.name}" is not an image (${mime || "unknown type"})`
        );
      }
      const ext = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf("."))
        : ".jpg";
      return {
        index,
        file,
        filename: `frame_${String(index).padStart(5, "0")}${ext}`,
      };
    });

    const urls: string[] = [];
    for (const item of uploads) {
      const bytes = await item.file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      if (buffer.length < 1024) {
        throw new Error(
          `File "${item.file.name}" is too small — use real JPEG/PNG photos`
        );
      }
      urls.push(await uploadFileToOus(buffer, item.filename));
    }

    const { worldId } = await createReconstruction({
      name,
      scene,
      taskQuality,
      cover: urls[0],
      resources: urls.map((url) => ({ url, type: "image" as const })),
    });

    return NextResponse.json({
      success: true,
      worldId,
      imageCount: files.length,
      status: "PENDING",
    });
  } catch (err) {
    console.error("RECONSTRUCTION ERROR:", err);
    return NextResponse.json(
      {
        error: "Reconstruction failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
