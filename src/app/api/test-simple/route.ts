import { NextResponse } from "next/server";

export async function GET() {
  console.log("Simple test endpoint called");
  return NextResponse.json({ 
    success: true, 
    message: "Simple test endpoint çalışıyor",
    timestamp: new Date().toISOString()
  });
}