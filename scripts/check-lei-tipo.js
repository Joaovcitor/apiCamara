const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const total = await prisma.lei.count();
    const complementar = await prisma.lei.count({ where: { tipo: 'COMPLEMENTAR' } });
    const sample = await prisma.lei.findMany({
      take: 5,
      orderBy: { criadoEm: 'desc' },
      select: { id: true, titulo: true, numero: true, tipo: true },
    });
    console.log('Total leis:', total);
    console.log('Complementares:', complementar);
    console.log('Sample:', sample);
  } catch (err) {
    console.error('Error querying leis:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();