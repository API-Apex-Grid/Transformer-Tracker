import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const res = await fetch(apiUrl(`/api/inspections/${id}/boxes`), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(req.headers.get("authorization")
        ? { authorization: req.headers.get("authorization") as string }
        : {}),
      ...(req.headers.get("x-username")
        ? { "x-username": req.headers.get("x-username") as string }
        : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "Upstream error", details: text || undefined },
      { status: res.status }
    );
  }
  const data = await res.json();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

// Allow CORS preflight if ever triggered in edge cases
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, authorization",
      "Cache-Control": "no-store",
    },
  });
}
