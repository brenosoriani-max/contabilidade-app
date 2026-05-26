import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bid: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Não autenticado', 401);

    const { id, bid } = await params;
    const body = await request.json();

    const { grupo, codigo, descricao, valorAnterior, valorAtual, detalhes } = body;

    const bem = await prisma.bemDireito.update({
      where: { 
        id: Number.parseInt(bid, 10),
        declaracaoId: Number.parseInt(id, 10)
      },
      data: {
        grupo: Number(grupo),
        codigo: Number(codigo),
        descricao,
        valorAnterior: Number(valorAnterior || 0),
        valorAtual: Number(valorAtual || 0),
        detalhes: detalhes || {},
      },
    });

    return ok({ bem, message: 'Bem atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar bem:', error);
    return fail('Erro interno do servidor', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bid: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Não autenticado', 401);

    const { id, bid } = await params;

    await prisma.bemDireito.delete({
      where: { 
        id: Number.parseInt(bid, 10),
        declaracaoId: Number.parseInt(id, 10)
      },
    });

    return ok({ message: 'Bem excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir bem:', error);
    return fail('Erro interno do servidor', 500);
  }
}
