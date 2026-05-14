const { PrismaClient } = require('@prisma/client');

(async () => {
  const url = process.env.DATABASE_URL;
  console.log('DATABASE_URL:', url);

  const prisma = new PrismaClient();
  try {
    const u = await prisma.usuario.findFirst({ where: { ativo: true } });
    console.log('ok user:', u);
  } finally {
    await prisma.$disconnect();
  }
})();

