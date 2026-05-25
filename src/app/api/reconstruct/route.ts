import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json(
        { error: "No files uploaded" },
        { status: 400 }
      );
    }

    // STEP 1 — GET OUS TOKEN

    const tokenResponse = await fetch(
      "https://api.aholo3d.cn/world/v1/asset/token",
      {
        headers: {
          Authorization: process.env.AHOLO_API_KEY || "",
        },
      }
    );

    const tokenData = await tokenResponse.json();

    console.log("TOKEN DATA:", tokenData);

    return NextResponse.json({
      success: true,
      uploadedFiles: files.length,
      tokenData,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Something failed" },
      { status: 500 }
    );
  }
}