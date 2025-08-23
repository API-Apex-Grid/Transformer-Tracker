import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await req.json();
  const { id } = await params;
  const updated = await prisma.transformer.update({ where: { id }, data: body });
  return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
}

// Delete transformer and cascade delete related inspections by transformerNumber
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Find transformer to get its transformerNumber
  const { id } = await params;
  const transformer = await prisma.transformer.findUnique({ where: { id } });
  if (!transformer) {
    return NextResponse.json({ error: "Transformer not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.inspection.deleteMany({ where: { transformerNumber: transformer.transformerNumber } }),
    prisma.transformer.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
