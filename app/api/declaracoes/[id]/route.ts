import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Não autenticado', 401);

    const id = Number(params.id);
    if (Number.isNaN(id)) return fail('ID inválido', 400);

    const declaracao = await prisma.declaracao.findUnique({
      where: { id },
    });

    if (!declaracao) return fail('Declaração não encontrada', 404);

    return ok({ declaracao });
  } catch (error) {
    console.error('[API_DECLARACAO_GET] Erro:', error);
    return fail('Erro interno', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Não autenticado', 401);

    const id = Number(params.id);
    if (Number.isNaN(id)) return fail('ID inválido', 400);

    const body = await request.json();
    const { situacao } = body;

    const updated = await prisma.declaracao.update({
      where: { id },
      data: { situacao },
    });

    return ok({ declaracao: updated, message: 'Status atualizado com sucesso' });
  } catch (error) {
    console.error('[API_DECLARACAO_PATCH] Erro:', error);
    return fail('Erro ao atualizar status', 500);
  }
}
