import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { mergeDocumentoArquivado } from '@/lib/server/irpf-declaracao-local';
import {
  loadModeloForDeclaracao,
  persistModeloEnvelope,
} from '@/lib/server/declaracao-modelo';
import { applyFieldEdit } from '@/lib/server/irpf-model-utils';
import { storeDeclaracaoBuffer } from '@/lib/server/declaracao-uploads';
import {
  ensureSchedulingChecklist,
  storeUploadedFile,
  validateUploadFile,
} from '@/lib/server/scheduling-details';
import { parseDocument } from '@/lib/server/anchor-parser';
import type { DadosJsonEnvelopeV2 } from '@/lib/server/dados-json-declaracao';



interface BemDireito {
  codigo_irpf: string;         // ex: "61" (conta corrente), "41" (poupança)
  grupo: string;               // ex: "G6"
  discriminacao: string;
  valor_anterior: number | null;
  valor_atual: number | null;
  cnpj?: string | null;
  fonte: string;               // "ocr_extrato", "ocr_corretora", "ocr_iptu" …
  status: 'sugerido' | 'confirmado' | 'pendente';
  confianca: number;
}

interface RendimentoPJ {
  cnpj_fonte: string;
  razao_social: string;
  valor_bruto: number;
  irrf_retido: number;
  contribuicao_previdenciaria: number;
  decimo_terceiro: number;
  irrf_decimo_terceiro: number;
  rendimentos_isentos: number;
  ano_calendario: number;
  fonte: string;
  status: 'sugerido' | 'confirmado';
  confianca: number;
}

interface RendimentoPFMes {
  mes: string;            // "01" … "12"
  carne_leao: number;
  alugueis: number;
  pessoa_fisica: number;
  darf_pago: number;
  irrf_retido: number;
}

interface ExtractionResult {
  // ── Campos simples (mapeados 1:1 para o contribuinte / modelo) ──
  dataNascimento?: string;
  tituloEleitor?: string;
  enderecoCep?: string;
  enderecoUf?: string;
  enderecoMunicipio?: string;
  enderecoBairro?: string;
  enderecoLogradouro?: string;
  enderecoNumero?: string;
  enderecoComplemento?: string;
  ocupacaoPrincipal?: string;
  naturezaOcupacao?: string;
  telefone?: string;
  email?: string;

  // ── Bens e Direitos (array — extrato, corretora, IPTU, CRLV) ──
  bens?: BemDireito[];

  // ── Rendimentos PJ (array — cada informe é uma entrada) ──
  rendimentos_pj?: RendimentoPJ[];

  // ── Rendimentos PF autônomo (carnê-leão mensal) ──
  rendimentos_pf_mensal?: RendimentoPFMes[];

  // ── Confiança geral da extração ──
  confianca: number;
}

// ─── Mapeamento campo-simples → path no modelo canônico ──────────────────────

const DB_TO_MODELO_PATH: Record<string, string> = {
  dataNascimento:       'identificacao.data_nascimento',
  tituloEleitor:        'identificacao.titulo_eleitor',
  ocupacaoPrincipal:    'identificacao.ocupacao_principal',
  naturezaOcupacao:     'identificacao.natureza_ocupacao',
  enderecoCep:          'endereco.cep',
  enderecoUf:           'endereco.uf',
  enderecoMunicipio:    'endereco.codigo_municipio_ibge',
  enderecoBairro:       'endereco.bairro',
  enderecoLogradouro:   'endereco.logradouro',
  enderecoNumero:       'endereco.numero',
  enderecoComplemento:  'endereco.complemento',
  email:                'contato.email',
  telefone:             'contato.celular',
};

// ─── System prompt do agente ─────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `Você é um agente especialista em leitura de documentos para declaração do IRPF brasileiro.
Analise a imagem e retorne APENAS um JSON válido, sem markdown, sem explicações.
Null para campos ausentes. Valores monetários como número float (sem R$ ou pontos).
Datas no formato DD/MM/AAAA.`;
}

// ─── Prompts por tag ──────────────────────────────────────────────────────────

const TAG_PROMPTS: Record<string, string> = {

  'RG / CNH': `Extraia do documento de identidade (RG ou CNH):
{
  "dataNascimento": "DD/MM/AAAA",
  "tituloEleitor": null,
  "confianca": 0.0
}`,

  'Título de Eleitor': `Extraia do título de eleitor:
{
  "tituloEleitor": "0000000000000",
  "confianca": 0.0
}`,

  'Titulo de Eleitor': `Extraia do título de eleitor:
{
  "tituloEleitor": "0000000000000",
  "confianca": 0.0
}`,

  'CPF': `Extraia do cartão CPF:
{
  "dataNascimento": "DD/MM/AAAA",
  "confianca": 0.0
}`,

  'Comprovante de residência': `Extraia do comprovante de residência:
{
  "enderecoCep": "00000-000",
  "enderecoUf": "XX",
  "enderecoMunicipio": "Nome da cidade",
  "enderecoBairro": "Nome do bairro",
  "enderecoLogradouro": "Tipo e nome da rua",
  "enderecoNumero": "000",
  "enderecoComplemento": null,
  "confianca": 0.0
}`,

  'Comprovante de residencia': `Extraia do comprovante de residência:
{
  "enderecoCep": "00000-000",
  "enderecoUf": "XX",
  "enderecoMunicipio": "Nome da cidade",
  "enderecoBairro": "Nome do bairro",
  "enderecoLogradouro": "Tipo e nome da rua",
  "enderecoNumero": "000",
  "enderecoComplemento": null,
  "confianca": 0.0
}`,

  // ── INFORME DE RENDIMENTOS → rendimentos_pj[] ──────────────────
  'Informe de rendimentos': `Extraia do informe de rendimentos:
{
  "ocupacaoPrincipal": null,
  "naturezaOcupacao": null,
  "rendimentos_pj": [
    {
      "cnpj_fonte": "00.000.000/0000-00",
      "razao_social": "NOME DA EMPRESA",
      "valor_bruto": 0.00,
      "irrf_retido": 0.00,
      "contribuicao_previdenciaria": 0.00,
      "decimo_terceiro": 0.00,
      "irrf_decimo_terceiro": 0.00,
      "rendimentos_isentos": 0.00,
      "ano_calendario": 2025,
      "fonte": "ocr_informe",
      "status": "sugerido",
      "confianca": 0.0
    }
  ],
  "confianca": 0.0
}`,

  // ── EXTRATO BANCÁRIO → bens[] (conta corrente e poupança) ──────
  'Extrato bancário': `Extraia do extrato bancário ou informe de saldo.
Para cada conta encontrada, crie um item em bens[].
Códigos IRPF: conta corrente = "61", poupança = "41", outro = "99".
Grupos: conta corrente = "G6", poupança/outros = "G4".
{
  "email": null,
  "telefone": null,
  "bens": [
    {
      "codigo_irpf": "61",
      "grupo": "G6",
      "discriminacao": "SALDO EM CONTA CORRENTE - BANCO X - AG 0000 - CONTA 00000-0",
      "valor_anterior": null,
      "valor_atual": 0.00,
      "cnpj": "00.000.000/0000-00",
      "fonte": "ocr_extrato",
      "status": "sugerido",
      "confianca": 0.0
    }
  ],
  "confianca": 0.0
}`,

  // ── CARNÊ-LEÃO / RECIBO AUTÔNOMO → rendimentos_pf_mensal[] ────
  'Carnê-leão / Recibo autônomo': `Extraia do carnê-leão ou recibo de autônomo.
Para cada mês encontrado, crie um item em rendimentos_pf_mensal[].
{
  "ocupacaoPrincipal": null,
  "naturezaOcupacao": null,
  "rendimentos_pf_mensal": [
    {
      "mes": "01",
      "carne_leao": 0.00,
      "alugueis": 0.00,
      "pessoa_fisica": 0.00,
      "darf_pago": 0.00,
      "irrf_retido": 0.00
    }
  ],
  "confianca": 0.0
}`,

  // ── NOTA DE CORRETAGEM / INFORME DE INVESTIMENTOS → bens[] ────
  'Nota de corretagem / Informe de investimentos': `Extraia do informe de investimentos ou nota de corretagem.
Crie um item em bens[] para cada ativo identificado.
Códigos IRPF: ações = "31", fundos de investimento = "74", FII = "73", renda fixa = "45".
{
  "bens": [
    {
      "codigo_irpf": "31",
      "grupo": "G3",
      "discriminacao": "AÇÕES - TICKER - CORRETORA X CNPJ 00.000.000/0000-00",
      "valor_anterior": null,
      "valor_atual": 0.00,
      "cnpj": "00.000.000/0000-00",
      "fonte": "ocr_corretora",
      "status": "sugerido",
      "confianca": 0.0
    }
  ],
  "confianca": 0.0
}`,

  // ── IPTU / ESCRITURA → bens[] (imóvel) ────────────────────────
  'IPTU / Escritura': `Extraia do IPTU ou escritura do imóvel.
Código IRPF para imóvel urbano = "11", rural = "15".
{
  "bens": [
    {
      "codigo_irpf": "11",
      "grupo": "G1",
      "discriminacao": "IMÓVEL - ENDEREÇO COMPLETO - INSCRIÇÃO 000000",
      "valor_anterior": null,
      "valor_atual": 0.00,
      "cnpj": null,
      "fonte": "ocr_iptu",
      "status": "sugerido",
      "confianca": 0.0
    }
  ],
  "confianca": 0.0
}`,

  // ── CRLV / DOCUMENTO DO VEÍCULO → bens[] ──────────────────────
  'CRLV / Documento do veículo': `Extraia do CRLV ou documento do veículo.
Código IRPF para veículo = "21".
{
  "bens": [
    {
      "codigo_irpf": "21",
      "grupo": "G2",
      "discriminacao": "VEÍCULO - MARCA MODELO ANO - PLACA XXX0000 - RENAVAM 000000",
      "valor_anterior": null,
      "valor_atual": 0.00,
      "cnpj": null,
      "fonte": "ocr_crlv",
      "status": "sugerido",
      "confianca": 0.0
    }
  ],
  "confianca": 0.0
}`,
};

// ─── Chamada real à Claude API ────────────────────────────────────────────────


// ─── Aplica bens[] ao modelo canônico ─────────────────────────────────────────

function applyBensToModelo(
  modelo: Record<string, unknown>,
  novos: BemDireito[],
): Record<string, unknown> {
  if (!novos || novos.length === 0) return modelo;

  const copy = JSON.parse(JSON.stringify(modelo)) as Record<string, unknown>;
  const existentes = (copy.bens as BemDireito[] | undefined) ?? [];

  for (const novo of novos) {
    // Evita duplicata: mesmo codigo_irpf + mesma discriminação (case-insensitive)
    const duplicado = existentes.findIndex(
      (b) =>
        b.codigo_irpf === novo.codigo_irpf &&
        b.discriminacao?.toUpperCase().trim() === novo.discriminacao?.toUpperCase().trim(),
    );

    if (duplicado >= 0) {
      // Só atualiza se o existente não estiver confirmado
      if (existentes[duplicado].status !== 'confirmado') {
        existentes[duplicado] = { ...existentes[duplicado], ...novo };
      }
    } else {
      existentes.push(novo);
    }
  }

  copy.bens = existentes;
  return copy;
}

// ─── Aplica rendimentos_pj[] ao modelo canônico ───────────────────────────────

function applyRendimentosPJToModelo(
  modelo: Record<string, unknown>,
  novos: RendimentoPJ[],
): Record<string, unknown> {
  if (!novos || novos.length === 0) return modelo;

  const copy = JSON.parse(JSON.stringify(modelo)) as Record<string, unknown>;

  const rends = (copy.rendimentos as Record<string, unknown> | undefined) ?? {};
  const pjExistentes = (rends.pj_lista as RendimentoPJ[] | undefined) ?? [];

  for (const novo of novos) {
    const dup = pjExistentes.findIndex((r) => r.cnpj_fonte === novo.cnpj_fonte);
    if (dup >= 0) {
      if (pjExistentes[dup].status !== 'confirmado') {
        pjExistentes[dup] = { ...pjExistentes[dup], ...novo };
      }
    } else {
      pjExistentes.push(novo);
    }
  }

  copy.rendimentos = {
    ...rends,
    pj_lista: pjExistentes,
    // Recalcula totais
    pj: {
      ...(rends.pj as Record<string, unknown> | undefined),
      total_bruto: {
        valor: pjExistentes.reduce((s, r) => s + (r.valor_bruto ?? 0), 0),
        fonte: 'ocr_informe',
        status: 'sugerido',
        confianca: novos[0]?.confianca ?? 0,
      },
      irrf_retido: {
        valor: pjExistentes.reduce((s, r) => s + (r.irrf_retido ?? 0), 0),
        fonte: 'ocr_informe',
        status: 'sugerido',
        confianca: novos[0]?.confianca ?? 0,
      },
    },
  };

  return copy;
}

// ─── Aplica rendimentos_pf_mensal[] ao modelo canônico ────────────────────────

function applyRendimentosPFToModelo(
  modelo: Record<string, unknown>,
  meses: RendimentoPFMes[],
  confianca: number,
): Record<string, unknown> {
  if (!meses || meses.length === 0) return modelo;

  const copy = JSON.parse(JSON.stringify(modelo)) as Record<string, unknown>;
  const rends = (copy.rendimentos as Record<string, unknown> | undefined) ?? {};
  const pfExistente = (rends.pf as Record<string, unknown> | undefined) ?? {};
  const mensal = (pfExistente.mensal as Record<string, unknown> | undefined) ?? {};

  for (const m of meses) {
    mensal[m.mes] = {
      carne_leao:    { valor: m.carne_leao,    fonte: 'ocr_carne_leao', status: 'sugerido', confianca },
      alugueis:      { valor: m.alugueis,      fonte: 'ocr_carne_leao', status: 'sugerido', confianca },
      pessoa_fisica: { valor: m.pessoa_fisica, fonte: 'ocr_carne_leao', status: 'sugerido', confianca },
      darf_pago:     { valor: m.darf_pago,     fonte: 'ocr_carne_leao', status: 'sugerido', confianca },
      irrf_retido:   { valor: m.irrf_retido,   fonte: 'ocr_carne_leao', status: 'sugerido', confianca },
    };
  }

  copy.rendimentos = { ...rends, pf: { ...pfExistente, mensal } };
  return copy;
}

// ─── Atualiza tabela Contribuinte (campos simples) ─────────────────────────────

const TAG_DB_FIELDS: Record<string, Array<{ key: string; parse?: 'date' }>> = {
  'RG / CNH':                   [{ key: 'dataNascimento', parse: 'date' }],
  'Título de Eleitor':          [{ key: 'tituloEleitor' }],
  'Titulo de Eleitor':          [{ key: 'tituloEleitor' }],
  'CPF':                        [{ key: 'dataNascimento', parse: 'date' }],
  'Comprovante de residência':  ['enderecoCep','enderecoUf','enderecoMunicipio','enderecoBairro','enderecoLogradouro','enderecoNumero','enderecoComplemento'].map(k => ({ key: k })),
  'Comprovante de residencia':  ['enderecoCep','enderecoUf','enderecoMunicipio','enderecoBairro','enderecoLogradouro','enderecoNumero','enderecoComplemento'].map(k => ({ key: k })),
  'Informe de rendimentos':     [{ key: 'ocupacaoPrincipal' }, { key: 'naturezaOcupacao' }],
  'Carnê-leão / Recibo autônomo': [{ key: 'ocupacaoPrincipal' }, { key: 'naturezaOcupacao' }],
  'Extrato bancário':           [{ key: 'telefone' }, { key: 'email' }],
};

async function syncContribuinteFromExtraction(
  contribuinteId: number,
  tag: string,
  extracted: ExtractionResult,
) {
  const fieldDefs = TAG_DB_FIELDS[tag];
  if (!fieldDefs) return { updated: false, fields: [] };

  const updates: Record<string, unknown> = {};

  for (const def of fieldDefs) {
    const val = (extracted as unknown as Record<string, unknown>)[def.key];
    if (typeof val !== 'string' || !val.trim()) continue;

    if (def.parse === 'date') {
      // Aceita "DD/MM/AAAA" ou "AAAA-MM-DD"
      let parsed: Date | null = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        parsed = new Date(val);
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        const [d, m, y] = val.split('/');
        parsed = new Date(`${y}-${m}-${d}`);
      }
      if (parsed && !isNaN(parsed.getTime())) {
        updates[def.key] = parsed;
      }
    } else {
      updates[def.key] = val.trim();
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.contribuinte.update({ where: { id: contribuinteId }, data: updates });
    return { updated: true, fields: Object.keys(updates) };
  }

  return { updated: false, fields: [] };
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const { id } = await params;
    const declaracaoId = Number.parseInt(id, 10);
    if (!Number.isFinite(declaracaoId)) return fail('ID invalido', 400);

    const formData = await request.formData();
    const file = formData.get('arquivo');
    const tagVal = formData.get('tag');
    const tag = typeof tagVal === 'string' ? tagVal.trim() : '';
    const agendamentoRaw = formData.get('agendamentoId');
    const agendamentoId =
      typeof agendamentoRaw === 'string' && agendamentoRaw
        ? Number.parseInt(agendamentoRaw, 10)
        : null;
    const origemRaw = formData.get('origem');
    const origem = origemRaw === 'cliente_link' ? 'cliente_link' : 'contador';

    if (!(file instanceof File) || !file.size) return fail('Envie o arquivo no campo "arquivo"', 400);
    if (!tag) return fail('Informe a tag do documento (campo "tag")', 400);

    const validationError = validateUploadFile(file);
    if (validationError) return fail(validationError, 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const mediaType = file.type || 'application/octet-stream';

    if (!mediaType.startsWith('image/') && mediaType !== 'application/pdf') {
      return fail('Formato nao suportado. Envie imagem (JPEG/PNG) ou PDF.', 400);
    }

    const decl = await prisma.declaracao.findUnique({
      where: { id: declaracaoId },
      select: { contribuinteId: true },
    });
    if (!decl) return fail('Declaracao nao encontrada', 404);

    const { envelope, modelo } = await loadModeloForDeclaracao(declaracaoId);

    // ── 1. Armazena o arquivo ──────────────────────────────────────
    let storedUrl: string | null = null;
    if (agendamentoId && Number.isFinite(agendamentoId)) {
      const ag = await prisma.agendamento.findUnique({ where: { id: agendamentoId } });
      if (!ag) return fail('Agendamento nao encontrado', 404);
      await ensureSchedulingChecklist(prisma, agendamentoId, ag.contribuinteId);
      const fileCopy = new File([new Uint8Array(buffer)], `[${tag}] ${file.name}`, { type: mediaType });
      const stored = await storeUploadedFile(agendamentoId, fileCopy);
      storedUrl = stored.publicUrl;
      await prisma.documentoAgendamento.create({
        data: {
          agendamentoId,
          nomeArquivo: fileCopy.name,
          tipoArquivo: mediaType,
          tamanhoBytes: buffer.length,
          caminhoArquivo: stored.absolutePath,
          urlArquivo: stored.publicUrl,
        },
      });
    }
    const decUpload = await storeDeclaracaoBuffer(declaracaoId, `[${tag}] ${file.name}`, buffer);
    if (!storedUrl) {
      storedUrl = decUpload.publicUrl;
    }

    // ── 2. Tenta OCR com anchor parser (sem IA) ──────────────────
    let extracted: any = await parseDocument(tag, buffer, mediaType);
    
  
    
    const confianca = extracted.confianca ?? 0;

    // ── 3. Aplica campos simples ao modelo canônico ───────────────
    let updatedModelo: Record<string, unknown> = modelo as Record<string, unknown>;

    const simpleKeys = Object.keys(DB_TO_MODELO_PATH) as Array<keyof typeof DB_TO_MODELO_PATH>;
    for (const key of simpleKeys) {
      const val = (extracted as unknown as Record<string, unknown>)[key];
      if (typeof val === 'string' && val.trim()) {
        const path = DB_TO_MODELO_PATH[key];
        updatedModelo = applyFieldEdit(
          updatedModelo as any,
          path,
          val.trim(),
          confianca >= 0.7 ? 'ocr_ia' : 'ocr_ia_baixa_confianca',
        ) as Record<string, unknown>;
      }
    }

    // ── 4. Aplica bens[] ao modelo canônico ───────────────────────
    if (extracted.bens && extracted.bens.length > 0) {
      updatedModelo = applyBensToModelo(updatedModelo, extracted.bens);
    }

    // ── 5. Aplica rendimentos PJ[] ao modelo canônico ─────────────
    if (extracted.rendimentos_pj && extracted.rendimentos_pj.length > 0) {
      updatedModelo = applyRendimentosPJToModelo(updatedModelo, extracted.rendimentos_pj);
    }

    // ── 6. Aplica rendimentos PF mensais ao modelo canônico ───────
    if (extracted.rendimentos_pf_mensal && extracted.rendimentos_pf_mensal.length > 0) {
      updatedModelo = applyRendimentosPFToModelo(updatedModelo, extracted.rendimentos_pf_mensal, confianca);
    }

    // ── 7. Atualiza envelope com o novo documento ─────────────────
    const prevDocs = envelope._meta?.documentos_arquivados ?? [];
    const nextEnvelope: DadosJsonEnvelopeV2 = {
      ...envelope,
      _meta: {
        ...envelope._meta,
        documentos_arquivados: [
          ...prevDocs,
          {
            tag,
            nome_arquivo: file.name,
            tamanho_bytes: buffer.length,
            media_type: mediaType,
            url: storedUrl,
            origem,
            recebido_em: new Date().toISOString(),
            confianca_extracao: confianca,
          },
        ],
      },
    };

    const { resumo } = mergeDocumentoArquivado(updatedModelo as any, {
      tag,
      nomeArquivo: file.name,
      tamanhoBytes: buffer.length,
      mediaType,
      url: storedUrl,
      origem,
    });

    // ── 8. Persiste modelo + envelope ─────────────────────────────
    await persistModeloEnvelope(declaracaoId, updatedModelo as any, nextEnvelope);

    // ── 9. Sincroniza tabela Contribuinte (campos simples DB) ─────
    const contribuinteUpdate = await syncContribuinteFromExtraction(
      decl.contribuinteId,
      tag,
      extracted as ExtractionResult,
    );

    // ── 10. Resumo do que foi extraído ────────────────────────────
    const extractionSummary = {
      campos_simples_atualizados: Object.keys(DB_TO_MODELO_PATH).filter(
        (k) => typeof (extracted as unknown as Record<string, unknown>)[k] === 'string',
      ).length,
      bens_criados: extracted.bens?.length ?? 0,
      rendimentos_pj_criados: extracted.rendimentos_pj?.length ?? 0,
      meses_pf_criados: extracted.rendimentos_pf_mensal?.length ?? 0,
      confianca,
      alertas_revisao:
        confianca < 0.7
          ? ['Confiança da extração abaixo de 70% — revisar campos manualmente']
          : [],
    };

    return ok({
      sucesso: true,
      resumo,
      extractionSummary,
      modelo: updatedModelo,
      contribuinteAtualizado: contribuinteUpdate,
    });
  } catch (e) {
    console.error('documento declaracao:', e);
    return fail(e instanceof Error ? e.message : 'Erro interno', 500);
  }
}