import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { mapAlert } from '@/lib/server/mappers';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const alertas = await prisma.alerta.findMany({
      where: { resolvido: false },
      include: { contribuinte: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return ok({ alertas: alertas.map(mapAlert) });
  } catch (error) {
    console.error('Erro ao listar alertas:', error);
    return fail('Erro interno do servidor', 500);
  }
}
