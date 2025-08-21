import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(_: Request, { params }: { params: { id: string } }) {
  const body = await _.json();
  const updated = await prisma.transformer.update({ where: { id: params.id }, data: body });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.transformer.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
