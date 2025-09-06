import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/api";
// Proxy multipart upload to Spring backend

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const { id } = await params;
    // Forward the original body stream to the backend without buffering the file in memory
    const res = await fetch(apiUrl(`/api/inspections/${id}/upload`), {
      method: "POST",
      headers: {
        // Preserve multipart boundary
        "content-type": contentType,
        ...(req.headers.get("authorization")
          ? { authorization: req.headers.get("authorization") as string }
          : {}),
        ...(req.headers.get("x-username")
          ? { "x-username": req.headers.get("x-username") as string }
          : {}),
      },
      body: req.body,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: "Upload failed", details: text || undefined }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
