import { NextResponse } from "next/server";
import { getOusCredentials } from "@/lib/aholo/upload";

export const runtime = "nodejs";

export async function GET() {
  try {
    const credentials = await getOusCredentials();
    return NextResponse.json({
      ok: true,
      message: "Aholo API key and OUS token OK (Quick Start step 1)",
      globalDomain: credentials.globalDomain,
      blockSize: credentials.blockSize,
      hasOusToken: Boolean(credentials.ousToken),
      diagnostics: "/api/aholo/diagnostics",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
