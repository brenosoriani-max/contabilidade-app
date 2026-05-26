import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { loadModeloForDeclaracao, persistModeloEnvelope } from '@/lib/server/declaracao-modelo';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Não autenticado', 401);

    const { id } = await params;
    const declaracaoId = Number.parseInt(id, 10);

    const bens = await prisma.bemDireito.findMany({
      where: { declaracaoId },
      orderBy: { id: 'asc' },
    });

    return ok({ bens });
  } catch (error) {
    console.error('Erro ao listar bens:', error);
    return fail('Erro interno do servidor', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Não autenticado', 401);

    const { id } = await params;
    const declaracaoId = Number.parseInt(id, 10);
    const body = await request.json();

    const { grupo, codigo, descricao, valorAnterior, valorAtual, detalhes } = body;

    const bem = await prisma.bemDireito.create({
      data: {
        declaracaoId,
        grupo: Number(grupo),
        codigo: Number(codigo),
        descricao,
        valorAnterior: Number(valorAnterior || 0),
        valorAtual: Number(valorAtual || 0),
     
      },
    });

    // Sincronizar com o JSON de Auditoria (opcional mas recomendado)
    const { envelope, modelo } = await loadModeloForDeclaracao(declaracaoId);
    // Aqui poderíamos adicionar ao modelo se houver uma coleção de bens no canônico
    // Por enquanto, o sistema parece ler bens do DB para a lista, então o DB é a fonte da verdade.

    return ok({ bem, message: 'Bem criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar bem:', error);
    return fail('Erro interno do servidor', 500);
  }
}
