import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import {
  ensureSchedulingChecklist,
  recordSchedulingHistory,
  storeUploadedFile,
  validateUploadFile,
} from '@/lib/server/scheduling-details';

import { mapSchedulingChecklistItem, mapSchedulingDocument } from '@/lib/server/mappers';
import type { SchedulingChecklistItem, SchedulingDocument } from '@/types';

const TAG_FIELD_MAP: Record<
  string,
  { formKey: string; dbKey: string; parse?: 'date' }[]
> = {
  'RG / CNH': [{ formKey: 'dataNascimento', dbKey: 'dataNascimento', parse: 'date' }],
  'Título de Eleitor': [{ formKey: 'tituloEleitor', dbKey: 'tituloEleitor' }],
  'Titulo de Eleitor': [{ formKey: 'tituloEleitor', dbKey: 'tituloEleitor' }],
  CPF: [{ formKey: 'dataNascimento', dbKey: 'dataNascimento', parse: 'date' }],
  'Comprovante de residência': [
    { formKey: 'enderecoCep', dbKey: 'enderecoCep' },
    { formKey: 'enderecoUf', dbKey: 'enderecoUf' },
    { formKey: 'enderecoMunicipio', dbKey: 'enderecoMunicipio' },
    { formKey: 'enderecoBairro', dbKey: 'enderecoBairro' },
    { formKey: 'enderecoLogradouro', dbKey: 'enderecoLogradouro' },
    { formKey: 'enderecoNumero', dbKey: 'enderecoNumero' },
    { formKey: 'enderecoComplemento', dbKey: 'enderecoComplemento' },
  ],
  'Comprovante de residencia': [
    { formKey: 'enderecoCep', dbKey: 'enderecoCep' },
    { formKey: 'enderecoUf', dbKey: 'enderecoUf' },
    { formKey: 'enderecoMunicipio', dbKey: 'enderecoMunicipio' },
    { formKey: 'enderecoBairro', dbKey: 'enderecoBairro' },
    { formKey: 'enderecoLogradouro', dbKey: 'enderecoLogradouro' },
    { formKey: 'enderecoNumero', dbKey: 'enderecoNumero' },
    { formKey: 'enderecoComplemento', dbKey: 'enderecoComplemento' },
  ],
  'Informe de rendimentos': [
    { formKey: 'ocupacaoPrincipal', dbKey: 'ocupacaoPrincipal' },
    { formKey: 'naturezaOcupacao', dbKey: 'naturezaOcupacao' },
  ],
  'Extrato bancário': [
    { formKey: 'telefone', dbKey: 'telefone' },
    { formKey: 'email', dbKey: 'email' },
  ],
  'Carnê-leão / Recibo autônomo': [
    { formKey: 'ocupacaoPrincipal', dbKey: 'ocupacaoPrincipal' },
    { formKey: 'naturezaOcupacao', dbKey: 'naturezaOcupacao' },
  ],
};

function normalizeTag(tagRaw: string) {
  const t = tagRaw.trim().toLowerCase();
  const map: Record<string, string> = {
    cpf: 'CPF',
    'rg / cnh': 'RG / CNH',
    'rg/cnh': 'RG / CNH',
    'rg /cnh': 'RG / CNH',

    'título de eleitor': 'Título de Eleitor',
    'titulo de eleitor': 'Titulo de Eleitor',

    'comprovante de residencia': 'Comprovante de residencia',
    'comprovante de residência': 'Comprovante de residência',

    'informe de rendimentos': 'Informe de rendimentos',
    'informe de rendimentos (empregador)': 'Informe de rendimentos',
    'informe de rendimentos bancario': 'Informe de rendimentos bancarios',
    'informe de rendimentos bancarios': 'Informe de rendimentos bancarios',
    'informe de rendimentos bancarios de contribuinte': 'Informe de rendimentos bancarios',
    'informe de rendimentos bancario ': 'Informe de rendimentos bancarios',
    'informe de rendimentos (empregador) ': 'Informe de rendimentos',

    'extrato bancário': 'Extrato bancário',
    'extrato bancario': 'Extrato bancário',

    'carnê-leão / recibo autônomo': 'Carnê-leão / Recibo autônomo',
    'carne-leao / recibo autonomo': 'Carnê-leão / Recibo autônomo',
    'carnê leão / recibo autônomo': 'Carnê-leão / Recibo autônomo',
  };
  return map[t] ?? tagRaw;
}

function logRoute(message: string, meta?: Record<string, unknown>) {
  const prefix = '[envio-documentos/token]';
  if (meta) console.log(prefix, message, JSON.stringify(meta));
  else console.log(prefix, message);
}

function isExpired(date: Date) {
  return date.getTime() < Date.now();
}

async function getPublicScheduling(token: string) {
  const link = await prisma.linkEnvioAgendamento.findUnique({
    where: { token },
    include: {
      agendamento: {
        include: {
          contribuinte: true,
          checklist: true,
          documentos: true,
        },
      },
    },
  });

  if (!link) return null;
  if (isExpired(link.expiresAt)) return { expired: true as const, link };

  await ensureSchedulingChecklist(prisma, link.agendamento.id, link.agendamento.contribuinteId);

  const freshLink = await prisma.linkEnvioAgendamento.findUniqueOrThrow({
    where: { token },
    include: {
      agendamento: {
        include: {
          contribuinte: true,
          checklist: true,
          documentos: true,
        },
      },
    },
  });

  return { expired: false as const, link: freshLink };
}

function mapPublicPayload(link: any) {
  const agendamento = link.agendamento;

  return {
    token: link.token,
    expiresAt: link.expiresAt.toISOString(),
    agendamento: {
      id: agendamento.id,
      titulo: agendamento.titulo,
      nome: agendamento.contribuinte?.nome ?? agendamento.titulo,
      dataAgendamento: agendamento.dataAgendamento.toISOString().slice(0, 10),
      checklist: agendamento.checklist
        .map(mapSchedulingChecklistItem)
        .sort(
          (a: SchedulingChecklistItem, b: SchedulingChecklistItem) =>
            a.ordem - b.ordem
        ),
      documents: agendamento.documentos.map(mapSchedulingDocument) as SchedulingDocument[],
    },
  };
}

async function updateContribuinteFromExtraction(
  contribuinteId: number,
  tag: string,
  extracted: any
) {
  const fieldDefs = TAG_FIELD_MAP[tag];
  if (!fieldDefs || fieldDefs.length === 0) return { updated: false, fields: [] as string[] };

  const updates: Record<string, unknown> = {};

  for (const def of fieldDefs) {
    const raw = extracted?.[def.formKey];
    if (typeof raw !== 'string' || !raw.trim()) continue;

    if (def.parse === 'date') {
      const parsed = new Date(raw.trim());
      if (!isNaN(parsed.getTime())) updates[def.dbKey] = parsed;
    } else {
      updates[def.dbKey] = raw.trim();
    }
  }

  if (Object.keys(updates).length === 0) return { updated: false, fields: [] as string[] };

  await prisma.contribuinte.update({ where: { id: contribuinteId }, data: updates });
  return { updated: true, fields: Object.keys(updates) };
}

async function createAssetsFromAnchorExtraction(
  declaracaoId: number,
  extracted: any
) {
  const bens = Array.isArray(extracted?.bens) ? (extracted.bens as any[]) : [];
  if (bens.length === 0) return { created: 0, existing: 0, skipped: 0 };

  let created = 0;
  let existing = 0;
  let skipped = 0;

  for (const b of bens) {
    const grupo = toIrpfCode(b.grupo);
    const codigo = toIrpfCode(b.codigo_irpf);
    if (grupo === null || codigo === null) {
      skipped++;
      continue;
    }

    const descricao = String(b.discriminacao ?? '').slice(0, 255);
    if (!descricao.trim()) {
      skipped++;
      continue;
    }

    const alreadyExists = await prisma.bemDireito.findFirst({
      where: { declaracaoId, grupo, codigo, descricao },
      select: { id: true },
    });

    if (alreadyExists) {
      existing++;
      continue;
    }

    const valorAnterior = toMoneyNumber(b.valor_anterior) ?? 0;
    const valorAtual = toMoneyNumber(b.valor_atual) ?? valorAnterior;

    await prisma.bemDireito.create({
      data: {
        declaracaoId,
        grupo,
        codigo,
        descricao,
        localizacao: 'BR',
        valorAnterior,
        valorAtual,
      } as any,
    });

    created++;
  }

  return { created, existing, skipped };
}

function toIrpfCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value ?? '').match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMoneyNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;

  const parsed = Number(
    value
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : null;
}

async function createTaxableIncomeFromAnchorExtraction(
  declaracaoId: number,
  extracted: any
) {
  const rendimentos = Array.isArray(extracted?.rendimentos_pj)
    ? (extracted.rendimentos_pj as any[])
    : [];
  if (rendimentos.length === 0) return { created: 0, updated: 0, skipped: 0 };

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of rendimentos) {
    const cnpjFonte = String(r.cnpj_fonte ?? '').trim() || null;
    const nomeFonte = String(r.razao_social ?? '').trim() || null;
    const valorRendimento = toMoneyNumber(r.valor_bruto) ?? 0;
    const valorPrevidencia = toMoneyNumber(r.contribuicao_previdenciaria) ?? 0;
    const valorIrrf = toMoneyNumber(r.irrf_retido) ?? 0;
    const valor13o = toMoneyNumber(r.decimo_terceiro) ?? 0;
    const irrf13o = toMoneyNumber(r.irrf_decimo_terceiro) ?? 0;

    if (!cnpjFonte && !nomeFonte) {
      skipped++;
      continue;
    }

    const existingIncome = await prisma.rendimentoTributavel.findFirst({
      where: {
        declaracaoId,
        tipo: 'PJ',
        ...(cnpjFonte ? { cnpjFonte } : { nomeFonte }),
      },
      select: { id: true },
    });

    if (existingIncome) {
      await prisma.rendimentoTributavel.update({
        where: { id: existingIncome.id },
        data: {
          nomeFonte,
          valorRendimento,
          valorPrevidencia,
          valorIrrf,
          valor13o,
          irrf13o,
        },
      });
      updated++;
      continue;
    }

    await prisma.rendimentoTributavel.create({
      data: {
        declaracaoId,
        tipo: 'PJ',
        cnpjFonte,
        nomeFonte,
        valorRendimento,
        valorPrevidencia,
        valorIrrf,
        valor13o,
        irrf13o,
      },
    });

    created++;
  }

  return { created, updated, skipped };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await getPublicScheduling(token);

    if (!result) return fail('Link nao encontrado', 404);
    if (result.expired) return fail('Link expirado', 410);

    return ok(mapPublicPayload(result.link));
  } catch (error) {
    console.error('Erro ao buscar link de envio:', error);
    return fail('Erro interno do servidor', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    logRoute('POST start', { token });

    const result = await getPublicScheduling(token);
    if (!result) return fail('Link nao encontrado', 404);
    if (result.expired) return fail('Link expirado', 410);

    const formData = await request.formData();
    const files = formData
      .getAll('files')
      .filter((file): file is File => file instanceof File);

    const checklistItemIdValue = formData.get('checklistItemId');
    const checklistItemId =
      typeof checklistItemIdValue === 'string' && checklistItemIdValue
        ? Number(checklistItemIdValue)
        : null;

    if (!checklistItemId) return fail('Selecione o documento da checklist', 400);
    if (!files.length) return fail('Nenhum arquivo enviado', 400);

    for (const file of files) {
      const validationError = validateUploadFile(file);
      if (validationError) return fail(validationError, 400);
    }

    const agendamentoId = result.link.agendamento.id;
    const checklistItem = await prisma.checklistAgendamento.findFirst({
      where: { id: checklistItemId, agendamentoId },
    });

    if (!checklistItem) return fail('Item de checklist nao encontrado', 404);
    if (checklistItem.status === 'nao_aplica')
      return fail('Este item nao aceita envio de documentos', 400);

    const ag = await prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      select: { contribuinteId: true },
    });

    for (const file of files) {
      const stored = await storeUploadedFile(agendamentoId, file);

      await prisma.$transaction(async (tx) => {
        await tx.documentoAgendamento.create({
          data: {
            agendamentoId,
            checklistItemId: checklistItem.id,
            checklistItemKey: checklistItem.chave,
            nomeArquivo: file.name,
            tipoArquivo: file.type || null,
            tamanhoBytes: file.size,
            caminhoArquivo: stored.absolutePath,
            urlArquivo: stored.publicUrl,
          },
        });

        await tx.checklistAgendamento.update({
          where: { id: checklistItem.id },
          data: { status: 'recebido' },
        });
      });

      if (!ag?.contribuinteId) continue;

      const tagRaw = checklistItem.nome;
      const tag = normalizeTag(tagRaw);

      const buffer = Buffer.from(await file.arrayBuffer());
      const mediaType = file.type || 'application/octet-stream';

      const extracted = await (async () => {
        try {
          const { parseDocument } = await import('@/lib/server/anchor-parser');
          return await parseDocument(tag, buffer, mediaType);
        } catch (e) {
          logRoute('anchor-parser parseDocument erro', {
            tag,
            tagRaw,
            error: e instanceof Error ? e.message : String(e),
          });
          return { confianca: 0 };
        }
      })();

      logRoute('extracted (anchor-parser)', {
        tagRaw,
        tag,
        tipoDocumento: extracted?.tipoDocumento,
        confianca: extracted?.confianca,
        bensCount: Array.isArray(extracted?.bens) ? extracted.bens.length : 0,
        rendimentosPjCount: Array.isArray(extracted?.rendimentos_pj)
          ? extracted.rendimentos_pj.length
          : 0,
        avisos: extracted?.avisos,
      });

      await updateContribuinteFromExtraction(ag.contribuinteId, tag, extracted);

      const declaracao = await prisma.declaracao.findFirst({
        where: { contribuinteId: ag.contribuinteId },
        orderBy: { anoExercicio: 'desc' },
        select: { id: true },
      });

      if (declaracao?.id) {
        const assetResult = await createAssetsFromAnchorExtraction(declaracao.id, extracted);
        const incomeResult = await createTaxableIncomeFromAnchorExtraction(declaracao.id, extracted);

        logRoute('persisted extraction', {
          declaracaoId: declaracao.id,
          bensCriados: assetResult.created,
          bensExistentes: assetResult.existing,
          bensIgnorados: assetResult.skipped,
          rendimentosCriados: incomeResult.created,
          rendimentosAtualizados: incomeResult.updated,
          rendimentosIgnorados: incomeResult.skipped,
        });
      }
    }

    await recordSchedulingHistory(
      prisma,
      null,
      agendamentoId,
      'documentos_enviados_cliente',
      `${files.length} arquivo(s) enviado(s) pelo cliente`
    );

    const refreshed = await getPublicScheduling(token);
    if (!refreshed || refreshed.expired) return fail('Link expirado', 410);

    return ok({
      message: 'Documento enviado com sucesso',
      ...mapPublicPayload(refreshed.link),
    });
  } catch (error) {
    console.error('Erro ao receber documentos do cliente:', error);
    return fail('Erro interno do servidor', 500);
  }
}

