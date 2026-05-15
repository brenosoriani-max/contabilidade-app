import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import {
  ensureSchedulingChecklist,
  recordSchedulingHistory,
  storeUploadedFile,
  validateUploadFile,
} from '@/lib/server/scheduling-details';
import { loadModeloForDeclaracao, persistModeloEnvelope } from '@/lib/server/declaracao-modelo';
import { applyFieldEdit } from '@/lib/server/irpf-model-utils';
import { storeDeclaracaoBuffer } from '@/lib/server/declaracao-uploads';
import { mapScheduling } from '@/lib/server/mappers';

const TAG_FIELD_MAP: Record<string, { formKey: string; dbKey: string; parse?: 'date' }[]> = {
  'RG / CNH': [
    { formKey: 'dataNascimento', dbKey: 'dataNascimento', parse: 'date' },
  ],
  'Título de Eleitor': [
    { formKey: 'tituloEleitor', dbKey: 'tituloEleitor' },
  ],
  'Titulo de Eleitor': [
    { formKey: 'tituloEleitor', dbKey: 'tituloEleitor' },
  ],
  CPF: [
    { formKey: 'dataNascimento', dbKey: 'dataNascimento', parse: 'date' },
  ],
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

async function simulateAIExtraction(tag: string, fileName: string): Promise<Record<string, string>> {
  const res: Record<string, string> = {};
  const slug = fileName.toUpperCase();

  if (tag === 'Título de Eleitor' || tag === 'Titulo de Eleitor') {
    const match = slug.match(/\d{12}/);
    res['tituloEleitor'] = match ? match[0] : '4590 1283 0192';
  }

  const tagNorm = tag.trim().toLowerCase();

  if (tagNorm === 'cpf' || tagNorm === 'rg / cnh' || tagNorm === 'rg/cnh' || tagNorm === 'rg /cnh') {
    res['dataNascimento'] = '1985-05-15';
  }

  if (
    tagNorm === 'comprovante de residência' ||
    tagNorm === 'comprovante de residencia'
  ) {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const { id } = await params;
    const agendamentoId = Number.parseInt(id, 10);
    const formData = await request.formData();
    const files = formData.getAll('files').filter((file): file is File => file instanceof File);
    const checklistItemIdValue = formData.get('checklistItemId');
    const checklistItemId =
      typeof checklistItemIdValue === 'string' && checklistItemIdValue
        ? Number(checklistItemIdValue)
        : null;

    if (!files.length) {
      return fail('Nenhum arquivo enviado', 400);
    }

    for (const file of files) {
      const validationError = validateUploadFile(file);
      if (validationError) return fail(validationError, 400);
    }

    const scheduling = await prisma.agendamento.findUnique({
      where: { id: agendamentoId },
    });

    if (!scheduling) {
      return fail('Agendamento nao encontrado', 404);
    }

    await ensureSchedulingChecklist(prisma, agendamentoId, scheduling.contribuinteId);

    const checklistItem = checklistItemId
      ? await prisma.checklistAgendamento.findFirst({
          where: {
            id: checklistItemId,
            agendamentoId,
          },
        })
      : null;

    if (checklistItemId && !checklistItem) {
      return fail('Item de checklist nao encontrado', 404);
    }

    const declaracao = scheduling.contribuinteId
      ? await prisma.declaracao.findFirst({
          where: { contribuinteId: scheduling.contribuinteId },
          orderBy: { anoExercicio: 'desc' },
        })
      : null;

    const tagRaw = checklistItem?.nome || 'Outros';
    const tagNormalized = tagRaw.trim().toLowerCase();

    // normaliza o nome do checklist para reduzir falhas por caixa/espaços.
    // (mantemos mapeamento pequeno e seguro; se não bater, usa o valor original)
    const tag = (() => {
      const map: Record<string, string> = {
        'cpf': 'CPF',
        'rg / cnh': 'RG / CNH',
        'rg /cnh': 'RG / CNH',
        'rg/cnh': 'RG / CNH',
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
        'titulo de eleitor ': 'Titulo de Eleitor',
      };

      return map[tagNormalized] ?? tagRaw;
    })();

    const declaracaoId = declaracao?.id ?? null;

    for (const file of files) {
      const stored = await storeUploadedFile(agendamentoId, file);

      await prisma.$transaction(async (tx) => {
        await tx.documentoAgendamento.create({
          data: {
            agendamentoId,
            checklistItemId: checklistItem?.id ?? null,
            checklistItemKey: checklistItem?.chave ?? null,
            nomeArquivo: file.name,
            tipoArquivo: file.type || null,
            tamanhoBytes: file.size,
            caminhoArquivo: stored.absolutePath,
            urlArquivo: stored.publicUrl,
          },
        });

        if (checklistItem) {
          await tx.checklistAgendamento.update({
            where: { id: checklistItem.id },
            data: { status: 'recebido' },
          });
        }
      });

      if (declaracaoId) {
        const buffer = Buffer.from(await file.arrayBuffer());
        await storeDeclaracaoBuffer(declaracaoId, `[${tag}] ${file.name}`, buffer);

        const { envelope, modelo } = await loadModeloForDeclaracao(declaracaoId);
        const aiData = await simulateAIExtraction(tag, file.name);
        const updatedModelo = Object.entries(aiData).reduce((currentModelo, [key, value]) => {
          if (key.startsWith('_')) return currentModelo;
          const path = DB_TO_MODELO_PATH[key];
          return path
            ? applyFieldEdit(currentModelo, path, value, 'inteligencia_artificial')
            : currentModelo;
        }, modelo as any);

        const nextEnvelope = {
          ...envelope,
          _meta: {
            ...envelope._meta,
            documentos_arquivados: [
              ...(envelope._meta?.documentos_arquivados ?? []),
              {
                tag,
                nome_arquivo: file.name,
                tamanho_bytes: buffer.length,
                media_type: file.type || 'application/octet-stream',
                url: stored.publicUrl,
                origem: 'contador',
                recebido_em: new Date().toISOString(),
              },
            ],
          },
        };

        await persistModeloEnvelope(declaracaoId, updatedModelo, nextEnvelope);

        if (scheduling.contribuinteId) {
          await updateContribuinteFromDocument(scheduling.contribuinteId, tag, aiData);
          await createAssetsFromDocument(declaracaoId, tag, aiData);
        }
      }
    }

    await recordSchedulingHistory(
      prisma,
      auth.user.id,
      agendamentoId,
      'documentos_enviados',
      `${files.length} arquivo(s) anexado(s)`
    );

    const updated = await prisma.agendamento.findUniqueOrThrow({
      where: { id: agendamentoId },
      include: {
        contribuinte: true,
        usuario: true,
        checklist: true,
        documentos: true,
        envioLink: true,
      },
    });

    return ok({
      message: 'Documento(s) enviado(s) com sucesso',
      agendamento: mapScheduling(updated),
    });
  } catch (error) {
    console.error('Erro ao enviar documentos:', error);
    return fail('Erro interno do servidor', 500);
  }
}
