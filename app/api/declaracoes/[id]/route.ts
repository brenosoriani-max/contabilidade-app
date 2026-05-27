import { NextRequest } from 'next/server';
import type { SituacaoDeclaracao } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const SITUACOES_VALIDAS = new Set<SituacaoDeclaracao>([
  'em_preenchimento',
  'transmitida',
  'processada',
  'pendente',
  'malha',
]);

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Não autenticado', 401);

    const { id: idParam } = await params;
    const id = Number(idParam);
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
  { params }: RouteContext
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Não autenticado', 401);

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (Number.isNaN(id)) return fail('ID inválido', 400);

    const body = await request.json();
    const { situacao } = body;
    if (typeof situacao !== 'string' || !SITUACOES_VALIDAS.has(situacao as SituacaoDeclaracao)) {
      return fail('Status invalido', 400);
    }
    const nextSituacao = situacao as SituacaoDeclaracao;

    const updated = await prisma.declaracao.update({
      where: { id },
      data: { situacao: nextSituacao },
    });

    return ok({ declaracao: updated, message: 'Status atualizado com sucesso' });
  } catch (error) {
    console.error('[API_DECLARACAO_PATCH] Erro:', error);
    return fail('Erro ao atualizar status', 500);
  }
}
