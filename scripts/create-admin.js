// Cria/atualiza usuário admin diretamente no banco
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function upsertUser(prisma, { email, password, name, role }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const user = await prisma.user.update({
      where: { email },
      data: { name, role, passwordHash },
    });
    console.log('Usuário atualizado:', { id: user.id, email: user.email, role: user.role });
    return user;
  } else {
    const user = await prisma.user.create({
      data: { email, name, role, passwordHash },
    });
    console.log('Usuário criado:', { id: user.id, email: user.email, role: user.role });
    return user;
  }
}

async function main() {
  const prisma = new PrismaClient();
  const users = [
    { email: 'admin@camara.gov.br', password: '123456', name: 'Admin', role: 'admin' },
    { email: 'funcionario@camara.gov.br', password: '123456', name: 'Funcionario', role: 'funcionario' },
  ];
  try {
    await prisma.$connect();
    for (const u of users) {
      await upsertUser(prisma, u);
    }
  } catch (err) {
    console.error('Falha ao criar/atualizar usuários:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();