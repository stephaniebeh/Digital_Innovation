import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://api.aholo3d.cn/world/v1/asset/token",
      {
        method: "GET",
        headers: {
          Authorization: process.env.AHOLO_API_KEY || "",
        },
      }
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Something failed" },
      { status: 500 }
    );
  }
}