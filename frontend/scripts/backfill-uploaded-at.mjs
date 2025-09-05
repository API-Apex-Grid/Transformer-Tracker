#!/usr/bin/env node
// Backfill uploadedAt fields for existing images with random datetimes between Aug 21 and Aug 26, 2025
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randomDateInRange(start, end) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const randMs = startMs + Math.random() * (endMs - startMs);
  return new Date(randMs);
}

async function main() {
  const start = new Date('2025-08-21T00:00:00Z');
  const end = new Date('2025-08-26T23:59:59Z');

  // Transformers baseline images
  const transformers = await prisma.transformer.findMany();
  for (const t of transformers) {
    const data = {};
    if (t.sunnyImage && !t.sunnyImageUploadedAt) data.sunnyImageUploadedAt = randomDateInRange(start, end);
    if (t.cloudyImage && !t.cloudyImageUploadedAt) data.cloudyImageUploadedAt = randomDateInRange(start, end);
    if (t.windyImage && !t.windyImageUploadedAt) data.windyImageUploadedAt = randomDateInRange(start, end);
    if (Object.keys(data).length) {
      await prisma.transformer.update({ where: { id: t.id }, data });
    }
  }

  // Inspection maintenance images
  const inspections = await prisma.inspection.findMany();
  for (const i of inspections) {
    if (i.imageUrl && !i.imageUploadedAt) {
      await prisma.inspection.update({ where: { id: i.id }, data: { imageUploadedAt: randomDateInRange(start, end) } });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Backfill complete.');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
