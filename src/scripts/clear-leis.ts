import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const before = await prisma.lei.count();
    const res = await prisma.lei.deleteMany({});
    const after = await prisma.lei.count();
    console.log(`Leis removidas: ${res.count}. Antes: ${before}, Depois: ${after}`);
  } catch (e) {
    console.error('Erro ao limpar leis:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
