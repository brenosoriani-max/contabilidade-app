import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import {
  ensureSchedulingChecklist,
  recordSchedulingHistory,
  storeUploadedFile,
  validateUploadFile,
} from '@/lib/server/scheduling-details';
import {
  mapSchedulingChecklistItem,
  mapSchedulingDocument,
} from '@/lib/server/mappers';
import type { SchedulingChecklistItem } from '@/types';
import { loadModeloForDeclaracao, persistModeloEnvelope } from '@/lib/server/declaracao-modelo';
import { applyFieldEdit } from '@/lib/server/irpf-model-utils';
import { storeDeclaracaoBuffer } from '@/lib/server/declaracao-uploads';

const TAG_FIELD_MAP: Record<string, { formKey: string; dbKey: string; parse?: 'date' }[]> = {
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

const DB_TO_MODELO_PATH: Record<string, string> = {
  nome: 'identificacao.nome_completo',
  cpf: 'identificacao.cpf',
  dataNascimento: 'identificacao.data_nascimento',
  tituloEleitor: 'identificacao.titulo_eleitor',
  ocupacaoPrincipal: 'identificacao.ocupacao_principal',
  naturezaOcupacao: 'identificacao.natureza_ocupacao',
  enderecoCep: 'endereco.cep',
  enderecoUf: 'endereco.uf',
  enderecoMunicipio: 'endereco.codigo_municipio_ibge',
  enderecoBairro: 'endereco.bairro',
  enderecoLogradouro: 'endereco.logradouro',
  enderecoNumero: 'endereco.numero',
  email: 'contato.email',
  telefone: 'contato.celular',
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
    'extrato bancário': 'Extrato bancário',
    'extrato bancario': 'Extrato bancário',
    'carnê-leão / recibo autônomo': 'Carnê-leão / Recibo autônomo',
    'carne-leao / recibo autonomo': 'Carnê-leão / Recibo autônomo',
    'carnê leão / recibo autônomo': 'Carnê-leão / Recibo autônomo',
  };
  return map[t] ?? tagRaw;
}

async function simulateAIExtraction(tag: string, fileName: string): Promise<Record<string, string>> {
  const res: Record<string, string> = {};
  const slug = fileName.toUpperCase();

  const tagNorm = tag.trim().toLowerCase();

  if (tagNorm === 'título de eleitor' || tagNorm === 'titulo de eleitor') {
    const match = slug.match(/\d{12}/);
    res['tituloEleitor'] = match ? match[0] : '4590 1283 0192';
  }

  if (tagNorm === 'cpf' || tagNorm === 'rg / cnh' || tagNorm === 'rg/cnh' || tagNorm === 'rg/cnh') {
    res['dataNascimento'] = '1985-05-15';
  }

  if (tagNorm === 'comprovante de residência' || tagNorm === 'comprovante de residencia') {
    res['enderecoCep'] = '01310-100';
    res['enderecoUf'] = 'SP';
    res['enderecoMunicipio'] = 'São Paulo';
    res['enderecoLogradouro'] = 'Avenida Paulista';
    res['enderecoNumero'] = '1000';
  }

  if (tagNorm === 'extrato bancário' || tagNorm === 'extrato bancario') {
    res['telefone'] = '(11) 99999-9999';
    res['email'] = 'cliente@example.com';
    res['_bem_tipo'] = 'bankAccount';
    res['_bem_valor'] = '50000.00';
  }

  if (tagNorm === 'informe de rendimentos' || tagNorm === 'informe de rendimentos (empregador)') {
    res['ocupacaoPrincipal'] = 'Executivo';
    res['naturezaOcupacao'] = 'Pessoa Física';
  }

  return res;
}

async function updateContribuinteFromDocument(
  contribuinteId: number,
  tag: string,
  extractedData: Record<string, string>
) {
  const fieldDefs = TAG_FIELD_MAP[tag];
  if (!fieldDefs || fieldDefs.length === 0) {
    return { updated: false, fields: [] };
  }

  const updates: Record<string, unknown> = {};

  for (const def of fieldDefs) {
    const raw = extractedData[def.formKey];
    if (typeof raw !== 'string' || !raw.trim()) continue;

    if (def.parse === 'date') {
      const parsed = new Date(raw.trim());
      if (!isNaN(parsed.getTime())) {
        updates[def.dbKey] = parsed;
      }
    } else {
      updates[def.dbKey] = raw.trim();
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.contribuinte.update({
      where: { id: contribuinteId },
      data: updates,
    });
    return { updated: true, fields: Object.keys(updates) };
  }

  return { updated: false, fields: [] };
}

async function createAssetsFromDocument(
  declaracaoId: number,
  tag: string,
  extractedData: Record<string, string>
) {
  const updates: Array<{ type: 'bem' | 'divida'; data: any }> = [];

  if (tag === 'Extrato bancário' && extractedData['_bem_tipo']) {
    const valor = parseFloat(extractedData['_bem_valor'] || '0');
    if (valor > 0) {
      updates.push({
        type: 'bem',
        data: {
          declaracaoId,
          grupo: 6,
          codigo: 1,
          descricao: 'Depósito bancário - Conta poupança',
          localizacao: 'SP',
          valorAnterior: valor,
          valorAtual: valor,
        },
      });
    }
  }

  if (tag === 'Extrato de previdencia privada') {
    updates.push({
      type: 'bem',
      data: {
        declaracaoId,
        grupo: 4,
        codigo: 1,
        descricao: 'Fundo de previdência privada',
        localizacao: 'BR',
        valorAnterior: 100000,
        valorAtual: 105000,
      },
    });
  }

  if (tag === 'Recibos medicos / odontologicos') {
    updates.push({
      type: 'bem',
      data: {
        declaracaoId,
        grupo: 9,
        codigo: 5,
        descricao: 'Despesas médicas e odontológicas do ano',
        localizacao: 'BR',
        valorAnterior: 25000,
        valorAtual: 25000,
      },
    });
  }

  if (updates.length > 0) {
    for (const update of updates) {
      if (update.type === 'bem') {
        await prisma.bemDireito.create({
          data: update.data,
        });
      }
    }
  }

  return updates.length > 0;
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

  await ensureSchedulingChecklist(
    prisma,
    link.agendamento.id,
    link.agendamento.contribuinteId
  );

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
      documents: agendamento.documentos.map(mapSchedulingDocument),
    },
  };
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
    const result = await getPublicScheduling(token);

    if (!result) return fail('Link nao encontrado', 404);
    if (result.expired) return fail('Link expirado', 410);

    const formData = await request.formData();
    const files = formData.getAll('files').filter((file): file is File => file instanceof File);
    const checklistItemIdValue = formData.get('checklistItemId');
    const checklistItemId =
      typeof checklistItemIdValue === 'string' && checklistItemIdValue
        ? Number(checklistItemIdValue)
        : null;

    if (!checklistItemId) {
      return fail('Selecione o documento da checklist', 400);
    }

    if (!files.length) {
      return fail('Nenhum arquivo enviado', 400);
    }

    for (const file of files) {
      const validationError = validateUploadFile(file);
      if (validationError) return fail(validationError, 400);
    }

    const agendamentoId = result.link.agendamento.id;
    const checklistItem = await prisma.checklistAgendamento.findFirst({
      where: {
        id: checklistItemId,
        agendamentoId,
      },
    });

    if (!checklistItem) {
      return fail('Item de checklist nao encontrado', 404);
    }

    if (checklistItem.status === 'nao_aplica') {
      return fail('Este item nao aceita envio de documentos', 400);
    }

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
    }

    await recordSchedulingHistory(
      prisma,
      null,
      agendamentoId,
      'documentos_enviados_cliente',
      `${files.length} arquivo(s) enviado(s) pelo cliente`
    );

    const refreshed = await getPublicScheduling(token);
    if (!refreshed || refreshed.expired) {
      return fail('Link expirado', 410);
    }

    return ok({
      message: 'Documento enviado com sucesso',
      ...mapPublicPayload(refreshed.link),
    });
  } catch (error) {
    console.error('Erro ao receber documentos do cliente:', error);
    return fail('Erro interno do servidor', 500);
  }
}


