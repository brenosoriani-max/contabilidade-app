import { prisma } from '@/lib/prisma';
import {
  DADOS_JSON_VERSION,
  parseDadosJson,
  serializeEnvelope,
  wrapLegacyXmlAsEnvelope,
  type DadosJsonEnvelopeV2,
} from '@/lib/server/dados-json-declaracao';
import {
  calcularProgresso,
  calcularStatusPipeline,
} from '@/lib/server/irpf-model-utils';
import {
  buildSkeletonModeloFromDeclaracaoRow,
  syncCanonicalModelToPrisma,
} from '@/lib/server/canonical-sync-to-prisma';

export async function loadModeloForDeclaracao(declaracaoId: number) {
  const declaracao = await prisma.declaracao.findUnique({
    where: { id: declaracaoId },
    include: { 
      contribuinte: true,
      bensDireitos: true,
      dependentes: true,
      dividasOnus: true,
      rendimentosTributaveis: true,
      rendimentosIsentos: true,
      deducoes: true
    },
  });

  if (!declaracao?.contribuinte) {
    throw new Error('Declaracao nao encontrada');
  }

  const { envelope: envParsed, legacyXmlTree } = parseDadosJson(declaracao.dadosJson);

  let envelope: DadosJsonEnvelopeV2;

  if (envParsed?._v === DADOS_JSON_VERSION) {
    envelope = {
      ...envParsed,
      legacyParsedXml:
        envParsed.legacyParsedXml ??
        (legacyXmlTree ?? undefined),
    };
  } else if (legacyXmlTree) {
    envelope = wrapLegacyXmlAsEnvelope(legacyXmlTree, undefined, {});
  } else {
    envelope = {
      _v: DADOS_JSON_VERSION,
      modelo: buildSkeletonModeloFromDeclaracaoRow(declaracao),
      _meta: {},
    };
  }

  const modelo =
    envelope.modelo && Object.keys(envelope.modelo).length
      ? (envelope.modelo as Record<string, unknown>)
      : buildSkeletonModeloFromDeclaracaoRow(declaracao);

  return { declaracao, envelope, modelo };
}

export async function persistModeloEnvelope(
  declaracaoId: number,
  modelo: Record<string, unknown>,
  envelope: DadosJsonEnvelopeV2
): Promise<void> {
  const pct = calcularProgresso(modelo);
  const pipe = calcularStatusPipeline(modelo);

  const next: DadosJsonEnvelopeV2 = {
    ...envelope,
    modelo,
    _meta: {
      ...envelope._meta,
      percentual_completo: pct,
      status_pipeline: pipe,
    },
  };

  await prisma.$transaction(async (tx) => {
    await tx.declaracao.update({
      where: { id: declaracaoId },
      data: { dadosJson: serializeEnvelope(next) },
    });
    await syncCanonicalModelToPrisma(tx, declaracaoId, modelo);
  });
}
