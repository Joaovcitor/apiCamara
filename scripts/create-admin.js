// Cria/atualiza usuário admin diretamente no banco
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  const email = 'joao@joao.com';
  const password = '123456';
  const name = 'João';
  const role = 'admin';

  try {
    await prisma.$connect();
    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await prisma.user.findUnique({ where: { email } });
    let user;
    if (existing) {
      user = await prisma.user.update({
        where: { email },
        data: { name, role, passwordHash },
      });
      console.log('Admin atualizado:', { id: user.id, email: user.email, role: user.role });
    } else {
      user = await prisma.user.create({
        data: { email, name, role, passwordHash },
      });
      console.log('Admin criado:', { id: user.id, email: user.email, role: user.role });
    }
  } catch (err) {
    console.error('Falha ao criar/atualizar admin:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();