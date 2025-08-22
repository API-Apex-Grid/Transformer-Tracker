import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(_: Request, { params }: { params: { id: string } }) {
  const body = await _.json();
  const updated = await prisma.inspection.update({ where: { id: params.id }, data: body });
  return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.inspection.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
