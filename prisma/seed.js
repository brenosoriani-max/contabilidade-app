const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const bcrypt = require('bcryptjs');
require('dotenv/config');

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL || ''),
});

async function main() {
  const adminCount = await prisma.usuario.count({
    where: { role: 'admin' },
  });

  if (adminCount > 0) {
    return;
  }

  const senha = await bcrypt.hash('admin123', 10);

  await prisma.usuario.create({
    data: {
      nome: 'Administrador',
      email: 'admin@contec.com.br',
      senha,
      role: 'admin',
      cargo: 'Administrador do Sistema',
      ativo: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
