import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await req.json();
  const { id } = await params;
  const updated = await prisma.inspection.update({ where: { id }, data: body });
  return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.inspection.delete({ where: { id } });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
