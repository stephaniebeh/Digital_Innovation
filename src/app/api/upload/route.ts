import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Convert file to buffer (for logging / later storage)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log("Received file:", file.name, buffer.length);

    // TODO: upload to S3 / Cloudinary / your backend storage here

    return NextResponse.json({
      success: true,
      filename: file.name,
      size: buffer.length,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}