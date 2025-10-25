import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authHeader = req.headers.get("authorization");
  const res = await fetch(apiUrl(`/api/inspections/${id}`), {
    cache: "no-store",
    headers: authHeader ? { authorization: authHeader } : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: "Upstream error", details: text || undefined }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await req.json();
  const { id } = await params;
  const res = await fetch(apiUrl(`/api/inspections/${id}`), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(req.headers.get("authorization")
        ? { authorization: req.headers.get("authorization") as string }
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(apiUrl(`/api/inspections/${id}`), {
    method: "DELETE",
    headers: {
      ...( _req.headers.get("authorization")
        ? { authorization: _req.headers.get("authorization") as string }
        : {}),
      ...( _req.headers.get("x-username")
        ? { "x-username": _req.headers.get("x-username") as string }
        : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "Upstream error", details: text || undefined },
      { status: res.status }
    );
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
