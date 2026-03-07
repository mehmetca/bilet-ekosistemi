import { NextRequest, NextResponse } from "next/server";
import bwipjs from "bwip-js";

/**
 * Bilet kodu için Code128 barkod PNG döner.
 * GET /api/barcode?code=XXX
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code || typeof code !== "string" || code.length > 64) {
    return new NextResponse("Invalid code", { status: 400 });
  }

  try {
    const buffer = await bwipjs.toBuffer({
      bcid: "code128",
      text: code,
      scale: 2,
      height: 18,
      rotate: "R",
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: "FFFFFF",
    });

    const bytes = new Uint8Array(buffer.length);
    bytes.set(buffer as Uint8Array);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Barcode generation failed", { status: 500 });
  }
}
