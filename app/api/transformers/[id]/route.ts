import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(_: Request, { params }: { params: { id: string } }) {
  const body = await _.json();
  const updated = await prisma.transformer.update({ where: { id: params.id }, data: body });
  return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
}

// Delete transformer and cascade delete related inspections by transformerNumber
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  // Find transformer to get its transformerNumber
  const transformer = await prisma.transformer.findUnique({ where: { id: params.id } });
  if (!transformer) {
    return NextResponse.json({ error: "Transformer not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.inspection.deleteMany({ where: { transformerNumber: transformer.transformerNumber } }),
    prisma.transformer.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
