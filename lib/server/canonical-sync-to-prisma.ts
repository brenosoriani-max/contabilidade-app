import type { Prisma } from '@prisma/client';

import { getModeloPath } from '@/lib/server/irpf-model-utils';

type Tx = Prisma.TransactionClient;

function digits(v: unknown): string | undefined {
  const s = v == null ? '' : String(v).replace(/\D/g, '');
  return s.length ? s : undefined;
}

function str(v: unknown): string | null | undefined {
  if (v == null) return undefined;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function num(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseBrDate(v: unknown): Date | undefined {
  const s = str(v);
  if (!s) return undefined;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return undefined;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const y = Number(m[3]);
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

/**
 * Atualiza `Contribuinte` e totais principais de `Declaracao` a partir de caminhos
 * conhecidos do modelo canônico (objetos com `.valor` ou valor escalar).
 */
export async function syncCanonicalModelToPrisma(
  tx: Tx,
  declaracaoId: number,
  modelo: Record<string, unknown>
): Promise<void> {
  const decl = await tx.declaracao.findUnique({
    where: { id: declaracaoId },
    include: { contribuinte: true },
  });

  if (!decl?.contribuinte) return;

  const cpfRaw = getModeloPath(modelo, 'identificacao.cpf');
  const nomeRaw = getModeloPath(modelo, 'identificacao.nome_completo');
  const cpf = digits(cpfRaw);
  const nome = str(nomeRaw);

  const contribUpdate: Prisma.ContribuinteUpdateInput = {};

  if (cpf && cpf.length === 11) contribUpdate.cpf = cpf;
  if (nome) contribUpdate.nome = nome;

  const nasc = parseBrDate(getModeloPath(modelo, 'identificacao.data_nascimento'));
  if (nasc) contribUpdate.dataNascimento = nasc;

  const te = str(getModeloPath(modelo, 'identificacao.titulo_eleitor'));
  if (te != null) contribUpdate.tituloEleitor = te;

  const nat = str(getModeloPath(modelo, 'identificacao.natureza_ocupacao'));
  if (nat != null) contribUpdate.naturezaOcupacao = nat;

  const email = str(getModeloPath(modelo, 'contato.email'));
  if (email != null) contribUpdate.email = email;

  const tel = str(getModeloPath(modelo, 'contato.telefone_fixo'));
  if (tel != null) contribUpdate.telefone = tel;

  const uf = str(getModeloPath(modelo, 'endereco.uf'));
  if (uf != null) contribUpdate.enderecoUf = uf;

  const mun = str(getModeloPath(modelo, 'endereco.codigo_municipio_ibge'));
  if (mun != null) contribUpdate.enderecoMunicipio = mun;

  const cep = str(getModeloPath(modelo, 'endereco.cep'));
  if (cep != null) contribUpdate.enderecoCep = cep;

  const bairro = str(getModeloPath(modelo, 'endereco.bairro'));
  if (bairro != null) contribUpdate.enderecoBairro = bairro;

  const tipoLog = str(getModeloPath(modelo, 'endereco.tipo_logradouro'));
  const logr = str(getModeloPath(modelo, 'endereco.logradouro'));
  const parts = [tipoLog, logr].filter(Boolean);
  if (parts.length) contribUpdate.enderecoLogradouro = parts.join(' ').trim();

  const numero = str(getModeloPath(modelo, 'endereco.numero'));
  if (numero != null) contribUpdate.enderecoNumero = numero;

  const comp = str(getModeloPath(modelo, 'endereco.complemento'));
  if (comp != null) contribUpdate.enderecoComplemento = comp;

  if (Object.keys(contribUpdate).length) {
    await tx.contribuinte.update({
      where: { id: decl.contribuinteId },
      data: contribUpdate,
    });
  }

  const declUpdate: Prisma.DeclaracaoUpdateInput = {};

  const totalBruto = num(getModeloPath(modelo, 'rendimentos.pj.total_bruto'));
  if (totalBruto != null) declUpdate.totalRendimentosTributaveis = totalBruto;

  const base = num(getModeloPath(modelo, 'calculo.base_calculo'));
  if (base != null) declUpdate.baseCalculo = base;

  const impDev = num(getModeloPath(modelo, 'calculo.imposto_devido'));
  if (impDev != null) declUpdate.impostoDevido = impDev;

  const impPago = num(getModeloPath(modelo, 'calculo.imposto_pago'));
  if (impPago != null) declUpdate.impostoPago = impPago;

  const rest = num(getModeloPath(modelo, 'calculo.valor_restituicao'));
  if (rest != null) declUpdate.impostoRestituir = rest;

  const pagar = num(getModeloPath(modelo, 'calculo.valor_a_pagar'));
  if (pagar != null) declUpdate.impostoPagar = pagar;

  if (Object.keys(declUpdate).length) {
    await tx.declaracao.update({
      where: { id: declaracaoId },
      data: declUpdate,
    });
  }
}

export function buildSkeletonModeloFromDeclaracaoRow(row: {
  contribuinte: {
    cpf: string;
    nome: string;
    dataNascimento: Date | null;
    tituloEleitor: string | null;
    naturezaOcupacao: string | null;
    email: string | null;
    telefone: string | null;
    enderecoUf: string | null;
    enderecoMunicipio: string | null;
    enderecoCep: string | null;
    enderecoBairro: string | null;
    enderecoLogradouro: string | null;
    enderecoNumero: string | null;
    enderecoComplemento: string | null;
  };
  anoExercicio: number;
  baseCalculo: unknown;
  impostoDevido: unknown;
  impostoPago: unknown;
  impostoRestituir: unknown;
  impostoPagar: unknown;
  totalRendimentosTributaveis: unknown;
}): Record<string, unknown> {
  const field = (valor: unknown, fonte = 'xml_pgd') =>
    valor == null || valor === ''
      ? { valor: null, fonte, status: 'pendente', confianca: 1 }
      : { valor, fonte, status: 'confirmado', confianca: 1 };

  const c = row.contribuinte;
  const fmtDate = (d: Date | null) =>
    d
      ? `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
      : null;

  return {
    identificacao: {
      cpf: field(c.cpf),
      nome_completo: field(c.nome),
      data_nascimento: field(fmtDate(c.dataNascimento)),
      titulo_eleitor: field(c.tituloEleitor),
      natureza_ocupacao: field(c.naturezaOcupacao),
    },
    contato: {
      email: field(c.email),
      telefone_fixo: field(c.telefone),
    },
    endereco: {
      uf: field(c.enderecoUf),
      codigo_municipio_ibge: field(c.enderecoMunicipio),
      cep: field(c.enderecoCep),
      bairro: field(c.enderecoBairro),
      logradouro: field(c.enderecoLogradouro),
      numero: field(c.enderecoNumero),
      complemento: field(c.enderecoComplemento),
    },
    declaracao: {
      ano_exercicio: field(row.anoExercicio),
    },
    rendimentos: {
      pj: {
        total_bruto: field(Number(row.totalRendimentosTributaveis)),
      },
    },
    calculo: {
      base_calculo: field(Number(row.baseCalculo)),
      imposto_devido: field(Number(row.impostoDevido)),
      imposto_pago: field(Number(row.impostoPago)),
      valor_restituicao: field(Number(row.impostoRestituir)),
      valor_a_pagar: field(Number(row.impostoPagar)),
    },
  };
}
