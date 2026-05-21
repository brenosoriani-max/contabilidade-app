import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { serializeEnvelope } from '@/lib/server/dados-json-declaracao';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth) {
      return fail('Não autenticado', 401);
    }

    const { contribuinteId, anoExercicio } = await request.json();

    if (!contribuinteId || !anoExercicio) {
      return fail('Campos obrigatórios ausentes: contribuinteId e anoExercicio', 400);
    }

    const cId = Number(contribuinteId);
    const ano = Number(anoExercicio);

    if (Number.isNaN(cId) || Number.isNaN(ano)) {
      return fail('Campos inválidos', 400);
    }

    // Verifica se o contribuinte existe
    const contribuinte = await prisma.contribuinte.findUnique({
      where: { id: cId },
    });

    if (!contribuinte) {
      return fail('Contribuinte não encontrado', 404);
    }

    // Verifica se já existe uma declaração para o mesmo ano
    const existing = await prisma.declaracao.findFirst({
      where: {
        contribuinteId: cId,
        anoExercicio: ano,
        tipoDeclaracao: 'original',
      },
    });

    if (existing) {
      return fail(`A declaração para o exercício ${ano} já existe para este contribuinte`, 400);
    }

    const defaultDadosJson = serializeEnvelope({
      _v: 2,
      modelo: {},
      _meta: {
        status_pipeline: 'pendente',
        percentual_completo: 0,
      },
    });

    const declaracao = await prisma.declaracao.create({
      data: {
        contribuinteId: cId,
        anoExercicio: ano,
        anoCalendario: ano - 1,
        tipoDeclaracao: 'original',
        modelo: 'completo',
        situacao: 'em_preenchimento',
        totalRendimentosTributaveis: 0,
        totalDeducoes: 0,
        baseCalculo: 0,
        impostoDevido: 0,
        impostoPago: 0,
        impostoRestituir: 0,
        impostoPagar: 0,
        totalBens: 0,
        dadosJson: defaultDadosJson,
      },
    });

    return ok({ declaracao, message: 'Declaração iniciada com sucesso' });
  } catch (error) {
    console.error('[API_DECLARACOES_CREATE] Erro:', error);
    return fail('Erro interno do servidor ao criar declaração', 500);
  }
}
