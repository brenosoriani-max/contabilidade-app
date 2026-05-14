import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok, toNumber } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { mapAlert } from '@/lib/server/mappers';
import type { DashboardMetrics } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth) {
      return fail('Nao autenticado', 401);
    }

    const [
      totalContribuintes,
      totalDeclaracoes,
      declaracoes,
      declaracoesPorAno,
      alertas,
    ] = await prisma.$transaction([
      prisma.contribuinte.count(),
      prisma.declaracao.count(),
      prisma.declaracao.findMany({
        include: {
          bensDireitos: true,
          rendimentosTributaveis: true,
        },
        orderBy: { anoExercicio: 'desc' },
      }),
      prisma.declaracao.groupBy({
        by: ['anoExercicio'],
        _count: { _all: true },
        orderBy: { anoExercicio: 'desc' },
        take: 5,
      }),
      prisma.alerta.findMany({
        where: { resolvido: false },
        include: { contribuinte: true },
        orderBy: [{ prioridade: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      }),
    ]);

    const totalRendimentosPJ = declaracoes.reduce(
      (sum, item) => sum + toNumber(item.totalRendimentosTributaveis),
      0
    );
    const totalRendimentosIsentos = declaracoes.reduce(
      (sum, item) => sum + toNumber(item.totalRendimentosIsentos),
      0
    );
    const totalTributacaoExclusiva = declaracoes.reduce(
      (sum, item) => sum + toNumber(item.totalRendimentosExclusivos),
      0
    );
    const totalIRRF = declaracoes.reduce(
      (sum, item) =>
        sum +
        item.rendimentosTributaveis.reduce(
          (inner, rendimento) => inner + toNumber(rendimento.valorIrrf),
          0
        ),
      0
    );
    const totalPatrimonio = declaracoes.reduce(
      (sum, item) => sum + toNumber(item.totalBens),
      0
    );
    const totalBensAnterior = declaracoes.reduce(
      (sum, item) =>
        sum +
        item.bensDireitos.reduce(
          (inner, bem) => inner + toNumber(bem.valorAnterior),
          0
        ),
      0
    );
    const totalImpostoDevido = declaracoes.reduce(
      (sum, item) => sum + toNumber(item.impostoDevido),
      0
    );
    const totalRestituir = declaracoes.reduce(
      (sum, item) => sum + toNumber(item.impostoRestituir),
      0
    );
    const totalPagar = declaracoes.reduce(
      (sum, item) => sum + toNumber(item.impostoPagar),
      0
    );

    const declaracoesRestituir = declaracoes.filter(
      (item) => toNumber(item.impostoRestituir) > 0
    ).length;
    const declaracoesPagar = declaracoes.filter(
      (item) => toNumber(item.impostoPagar) > 0
    ).length;
    const declaracoesZero =
      totalDeclaracoes - declaracoesRestituir - declaracoesPagar;

    const metrics: DashboardMetrics = {
      totalContribuintes,
      totalDeclaracoes,
      exercicioAtual:
        declaracoes[0]?.anoExercicio?.toString() ||
        new Date().getFullYear().toString(),
      totalRendimentosPJ,
      totalRendimentosIsentos,
      totalTributacaoExclusiva,
      totalIRRF,
      totalPatrimonio,
      variacaoPatrimonial: totalPatrimonio - totalBensAnterior,
      totalImpostoDevido,
      totalRestituir,
      totalPagar,
      declaracoesRestituir,
      declaracoesPagar,
      declaracoesZero,
      alertas: alertas.map(mapAlert),
      rendimentosPorFonte: [
        { fonte: 'Rendimentos PJ', valor: totalRendimentosPJ },
        { fonte: 'Isentos', valor: totalRendimentosIsentos },
        { fonte: 'Tributacao Exclusiva', valor: totalTributacaoExclusiva },
      ],
      distribuicaoResultado: [
        { tipo: 'A Restituir', count: declaracoesRestituir, valor: totalRestituir },
        { tipo: 'A Pagar', count: declaracoesPagar, valor: totalPagar },
        { tipo: 'Zero', count: declaracoesZero, valor: 0 },
      ],
      evolucaoPatrimonial: declaracoesPorAno
        .map((grupo) => {
          const doAno = declaracoes.filter(
            (item) => item.anoExercicio === grupo.anoExercicio
          );
          const atual = doAno.reduce(
            (sum, item) => sum + toNumber(item.totalBens),
            0
          );
          const anterior = doAno.reduce(
            (sum, item) =>
              sum +
              item.bensDireitos.reduce(
                (inner, bem) => inner + toNumber(bem.valorAnterior),
                0
              ),
            0
          );

          return {
            ano: String(grupo.anoExercicio),
            anterior,
            atual,
          };
        })
        .reverse(),
    };

    return ok(metrics);
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    return fail('Erro interno do servidor', 500);
  }
}
