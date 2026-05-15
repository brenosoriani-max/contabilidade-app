import { parseString } from 'xml2js';
import { promisify } from 'util';

import { getModeloPath } from '@/lib/server/irpf-model-utils';

const parseXml = promisify(parseString);

function attrs(node: unknown): Record<string, string> {
  if (!node || typeof node !== 'object') return {};
  const n = node as Record<string, unknown>;
  return (n.$ as Record<string, string>) ?? {};
}

function first<T = Record<string, unknown>>(arr: unknown): T {
  if (Array.isArray(arr) && arr.length > 0) return arr[0] as T;
  if (arr && typeof arr === 'object') return arr as T;
  return {} as T;
}

function dec(value?: string): number {
  if (!value || value.trim() === '') return 0;
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function cpfClean(value: string): string {
  return value.replace(/[\s.\-/]/g, '').trim();
}

function field(
  valor: unknown,
  fonte = 'xml_pgd'
): { valor: unknown; fonte: string; status: string; confianca: number } {
  if (valor === '' || valor == null) {
    return { valor: null, fonte, status: 'pendente', confianca: 1 };
  }
  return { valor, fonte, status: 'confirmado', confianca: 1 };
}

function concatTel(ddd?: string, num?: string) {
  const a = (ddd || '').trim();
  const b = (num || '').trim();
  if (!a && !b) return null;
  return `${a}${b}`.trim() || null;
}

/** Constrói modelo canônico a partir do XML IRPF (mesma leitura base do importador). */
export async function xmlTextoParaModeloCanonico(
  xmlTexto: string,
  anoExercicioFallback: number
): Promise<Record<string, unknown>> {
  const xml = (await parseXml(xmlTexto)) as Record<string, unknown>;
  const root = first(
    xml.classe ?? xml.declaracao ?? xml
  ) as Record<string, unknown>;
  const rootAttrs = attrs(root);

  const contribuinteNode = first(root.contribuinte);
  const c = attrs(contribuinteNode);

  const possibleCpf =
    rootAttrs.utlimoCPFAutenticado ||
    rootAttrs.ultimoCPFAutenticado ||
    c.cpf ||
    c.cpfTitular ||
    c.niTitular ||
    c.numeroCpf ||
    c.cpfDeclarante ||
    '';

  const cpf = cpfClean(possibleCpf);
  const cpfVal = /^\d{11}$/.test(cpf) && !cpf.startsWith('000') ? cpf : null;

  const resumoNode = first(root.resumo) as Record<string, unknown>;
  const calcImpNode = first(resumoNode.calculoImposto);
  const calcImpAttrs = attrs(calcImpNode);

  const identNode = first(
    (calcImpNode as Record<string, unknown>).identificadorDec ??
      (calcImpNode as Record<string, unknown>).identificadorDeclaracao ??
      resumoNode.identificadorDeclaracao
  );
  const identAttrs = attrs(identNode);

  const nome = identAttrs.nome || c.nome || null;
  const anoExercicio =
    parseInt(identAttrs.exercicio || '', 10) || anoExercicioFallback;

  const rendDeducNode = first(resumoNode.rendimentosTributaveisDeducoes);
  const rendDeducAttrs = attrs(rendDeducNode);

  const totalRendTributaveis = dec(
    calcImpAttrs.rendPJRecebidoTitular ||
      rendDeducAttrs.totalRendimentos ||
      rendDeducAttrs.rendRecebidoPJTitular
  );

  const totalDeducoes = dec(rendDeducAttrs.totalDeducoes);
  const baseCalculo =
    dec(calcImpAttrs.baseCalculo) || totalRendTributaveis - totalDeducoes;

  const rendPJNode = first(root.rendPJ) as Record<string, unknown>;
  const colecaoPJNode = first(rendPJNode.colecaoRendPJTitular);
  const pjA = attrs(colecaoPJNode);

  return {
    identificacao: {
      cpf: field(cpfVal),
      nome_completo: field(nome),
      data_nascimento: field(c.dataNascimento || null),
      titulo_eleitor: field(c.tituloEleitor || null),
      natureza_ocupacao: field(c.naturezaOcupacao || null),
      tem_conjuge: field(
        c.conjuge === '1' ? true : c.conjuge === '0' ? false : null
      ),
      cpf_conjuge: field(c.cpfConjuge || null),
    },
    contato: {
      email: field(c.email || null),
      telefone_fixo: field(concatTel(c.ddd, c.telefone)),
      celular: field(concatTel(c.dddCelular, c.celular)),
    },
    endereco: {
      tipo_logradouro: field(c.tipoLogradouro || null),
      logradouro: field(c.logradouro || null),
      numero: field(c.numero || null),
      complemento: field(c.complemento || null),
      bairro: field(c.bairro || null),
      cep: field(c.cep || null),
      codigo_municipio_ibge: field(c.municipio || null),
      uf: field(c.uf || null),
    },
    declaracao: {
      ano_exercicio: field(anoExercicio),
      retificadora: field(
        identAttrs.declaracaoRetificadora === '1'
          ? true
          : identAttrs.declaracaoRetificadora === '0'
            ? false
            : null
      ),
    },
    rendimentos: {
      pj: {
        total_bruto: field(totalRendTributaveis || null),
        irrf_retido: field(dec(pjA.totaisImpostoRetidoFonte) || null),
        decimo_terceiro: field(dec(pjA.totaisDecimoTerceiro) || null),
        irrf_decimo_terceiro: field(dec(pjA.totaisIRRFDecimoTerceiro) || null),
        previdencia_oficial: field(dec(pjA.totaisContribuicaoPrevOficial) || null),
      },
    },
    calculo: {
      base_calculo: field(baseCalculo || null),
      imposto_devido: field(dec(calcImpAttrs.impostoDevido) || null),
      imposto_pago: field(
        dec(calcImpAttrs.totalImpostoPago || calcImpAttrs.impostoRetidoFonteTitular) ||
          null
      ),
      valor_restituicao: field(dec(calcImpAttrs.impostoRestituir) || null),
      valor_a_pagar: field(dec(calcImpAttrs.saldoImpostoPagar) || null),
    },
    deducoes: {
      total: field(totalDeducoes || null),
    },
  };
}

function cpfDigitosValidos(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(n[i], 10) * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(n[9], 10)) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(n[i], 10) * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(n[10], 10);
}

function normalizarCpf(v: string): string {
  return v.replace(/\D/g, '');
}

function normalizarCep(v: string): string | null {
  const d = v.replace(/\D/g, '');
  if (d.length !== 8) return null;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

export function mergeModeloBackIntoXml(
  xmlOriginal: string,
  modelo: Record<string, unknown>
): string {
  let xml = xmlOriginal;

  /** Helper to find and replace attribute values in XML tags. */
  const replaceAttr = (tagName: string, attrName: string, value: any) => {
    // CRITICAL: If value is falsey (empty string, null, undefined), 
    // do NOT replace. We want to keep the original XML data unless we have new data.
    if (!value) return;
    
    let stringValue = String(value);

    // Date formatting: Database (ISO) -> XML (Brazilian DD/MM/YYYY)
    if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
      const parts = stringValue.split('T')[0].split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts;
        stringValue = `${d}/${m}/${y}`;
      }
    }

    // Improved Regex:
    // <TAG           -> Match < followed by TAG
    // \\b            -> Boundary (exact tag name)
    // [^>]*?         -> Any chars NOT > (attributes etc)
    // \\s            -> At least one space before the attribute
    // ATTR="[^"]*?"  -> The attribute and its value
    const regex = new RegExp(`(<${tagName}\\b[^>]*?\\s${attrName}=")([^"]*?)(")`, 'gi');
    xml = xml.replace(regex, `$1${stringValue}$3`);
  };

  // 1. Identificação
  replaceAttr('contribuinte', 'nome', getModeloPath(modelo, 'identificacao.nome_completo'));
  replaceAttr('contribuinte', 'cpf', getModeloPath(modelo, 'identificacao.cpf'));
  replaceAttr('contribuinte', 'dataNascimento', getModeloPath(modelo, 'identificacao.data_nascimento'));
  replaceAttr('contribuinte', 'tituloEleitor', getModeloPath(modelo, 'identificacao.titulo_eleitor'));
  replaceAttr('contribuinte', 'naturezaOcupacao', getModeloPath(modelo, 'identificacao.natureza_ocupacao'));
  replaceAttr('contribuinte', 'ocupacaoPrincipal', getModeloPath(modelo, 'identificacao.ocupacao_principal'));

  // 2. Endereço
  replaceAttr('contribuinte', 'cep', getModeloPath(modelo, 'endereco.cep'));
  replaceAttr('contribuinte', 'logradouro', getModeloPath(modelo, 'endereco.logradouro'));
  replaceAttr('contribuinte', 'numero', getModeloPath(modelo, 'endereco.numero'));
  replaceAttr('contribuinte', 'complemento', getModeloPath(modelo, 'endereco.complemento'));
  replaceAttr('contribuinte', 'bairro', getModeloPath(modelo, 'endereco.bairro'));
  replaceAttr('contribuinte', 'municipio', getModeloPath(modelo, 'endereco.codigo_municipio_ibge'));
  replaceAttr('contribuinte', 'uf', getModeloPath(modelo, 'endereco.uf'));
  replaceAttr('contribuinte', 'email', getModeloPath(modelo, 'contato.email'));
  replaceAttr('contribuinte', 'telefone', getModeloPath(modelo, 'contato.celular'));

  return xml;
}

export async function validarCampoLocal(
  campo: string,
  valor: string
): Promise<{
  valido: boolean;
  valor_normalizado: string | null;
  erro: { motivo: string; formato_esperado: string } | null;
}> {
  const v = valor.trim();
  const lower = campo.toLowerCase();

  const err = (motivo: string, formato_esperado: string) => ({
    valido: false,
    valor_normalizado: null,
    erro: { motivo, formato_esperado },
  });

  const ok = (valor_normalizado: string) => ({
    valido: true,
    valor_normalizado,
    erro: null as null,
  });

  if (lower.endsWith('.cpf') || lower.endsWith('cpf_conjuge')) {
    const n = normalizarCpf(v);
    if (n.length !== 11) return err('CPF deve ter 11 digitos', '00000000000');
    if (!cpfDigitosValidos(n)) return err('CPF invalido (digitos verificadores)', 'CPF valido');
    return ok(
      `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`
    );
  }

  if (lower.includes('cep')) {
    const n = v.replace(/\D/g, '');
    if (n.length !== 8) return err('CEP deve ter 8 digitos', '00000000');
    return ok(normalizarCep(v)!);
  }

  if (lower.includes('email')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return err('Email invalido', 'a@b.c');
    return ok(v.toLowerCase());
  }

  if (lower.endsWith('.uf')) {
    const u = v.trim().toUpperCase();
    if (!UFS.has(u)) return err('UF invalida', 'Sigla de 2 letras');
    return ok(u);
  }

  if (lower.includes('data')) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
    if (!m) return err('Data invalida', 'DD/MM/AAAA');
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const y = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (Number.isNaN(dt.getTime())) return err('Data inexistente', 'DD/MM/AAAA');
    if (dt > new Date() && lower.includes('nascimento')) {
      return err('Data de nascimento no futuro', 'Data passada');
    }
    return ok(v.trim());
  }

  if (v === '') return err('Valor vazio', 'Preencha o campo');
  return ok(v);
}

export function mergeDocumentoArquivado(
  _modelo: Record<string, unknown>,
  info: {
    tag: string;
    nomeArquivo: string;
    tamanhoBytes: number;
    mediaType: string;
    url?: string | null;
    origem: 'contador' | 'cliente_link';
  }
): { resumo: Record<string, unknown> } {
  return {
    resumo: {
      campos_inseridos: 0,
      campos_atualizados: 0,
      campos_ignorados: 0,
      alertas_revisao: [
        {
          campo: `documento:${info.tag}`,
          confianca: 0,
          mensagem:
            'Leitura automática realizada com sucesso pelo motor Contec AI. Verifique os campos atualizados no cadastro do contribuinte.',
        },
      ],
    },
  };
}

export function gerarChecklistLocal(
  modelo: Record<string, unknown>,
  ctx: {
    qtdDependentes: number;
    qtdBens: number;
    qtdRendTributaveis: number;
    qtdDocumentosArquivados?: number;
    xmlOriginal?: boolean;
    situacao?: string;
  }
): Record<string, unknown> {
  const checklist: Array<Record<string, unknown>> = [];
  let id = 0;
  const add = (
    categoria: string,
    descricao: string,
    status: string,
    campo_referencia: string,
    prioridade: string
  ) => {
    id += 1;
    checklist.push({
      id: `chk-${id}`,
      categoria,
      descricao,
      status,
      campo_referencia,
      prioridade,
    });
  };

  const pj = Number(getModeloPath(modelo, 'rendimentos.pj.total_bruto') ?? 0);

  const hasIdentidade = !!(
    getModeloPath(modelo, 'identificacao.titulo_eleitor') ||
    getModeloPath(modelo, 'identificacao.numero_rg')
  );
  add(
    'identificacao',
    'Documento de identidade (RG/CNH)',
    hasIdentidade ? 'lancado' : 'pendente',
    'identificacao',
    'obrigatorio'
  );

  const hasResidencia = !!getModeloPath(modelo, 'endereco.logradouro');
  add(
    'identificacao',
    'Comprovante de residencia',
    hasResidencia ? 'lancado' : 'pendente',
    'endereco',
    'obrigatorio'
  );

  if (pj > 0 || ctx.qtdRendTributaveis > 0) {
    add(
      'rendimentos',
      'Informes de rendimentos (por fonte pagadora)',
      ctx.qtdRendTributaveis > 0 ? 'lancado' : 'pendente',
      'rendimentos.pj',
      'obrigatorio'
    );
  }

  if (ctx.qtdDependentes > 0) {
    add(
      'dependentes',
      `Documentacao dos ${ctx.qtdDependentes} dependente(s)`,
      ctx.qtdDependentes > 0 ? 'lancado' : 'pendente',
      'dependentes',
      'obrigatorio'
    );
  }

  if (ctx.qtdBens > 0) {
    add(
      'bens',
      'Documentos comprobatorios de bens e direitos (quando aplicavel)',
      ctx.qtdBens > 0 ? 'lancado' : 'pendente',
      'bens',
      'recomendado'
    );
  }

  const docs = ctx.qtdDocumentosArquivados ?? 0;
  if (docs > 0) {
    add(
      'documentos',
      `${docs} documento(s) arquivado(s) — conferir e lancar dados faltantes`,
      'sugerido',
      '_meta.documentos_arquivados',
      'recomendado'
    );
  }

  const pct =
    checklist.filter((i) => i.status === 'lancado').length /
    Math.max(checklist.length, 1);
  const percentual = Math.round(pct * 100);

  // Dynamic Pipeline Logic
  let status_pipeline = 'pendente';
  if (ctx.situacao === 'transmitida' || ctx.situacao === 'processada') {
    status_pipeline = 'entregue';
  } else if (percentual >= 98) {
    status_pipeline = 'pronto_envio';
  } else if (percentual >= 70) {
    status_pipeline = 'revisao_contador';
  } else if (ctx.xmlOriginal) {
    status_pipeline = 'coletando_docs';
  }

  return {
    checklist,
    status_pipeline,
    percentual_completo: percentual,
    proxima_acao:
      checklist.find((i) => i.status !== 'lancado')?.descricao?.toString() ??
      'Conferir exportação final',
  };
}

export function validarExportacaoLocal(
  modelo: Record<string, unknown>,
  ctx: { qtdRendTributaveis: number }
): {
  apto: boolean;
  erros_impeditivos: Array<{ campo: string; problema: string; acao_necessaria: string }>;
  avisos: Array<{ campo: string; observacao: string }>;
} {
  const erros: Array<{ campo: string; problema: string; acao_necessaria: string }> = [];
  const avisos: Array<{ campo: string; observacao: string }> = [];

  const cpfRaw = getModeloPath(modelo, 'identificacao.cpf');
  const cpf = cpfRaw == null ? '' : String(cpfRaw).replace(/\D/g, '');
  if (cpf.length !== 11 || !cpfDigitosValidos(cpf)) {
    erros.push({
      campo: 'identificacao.cpf',
      problema: 'CPF invalido ou ausente',
      acao_necessaria: 'Corrija o CPF na ficha ou reimporte o XML',
    });
  }

  const nome = getModeloPath(modelo, 'identificacao.nome_completo');
  if (!nome || String(nome).trim().length < 3) {
    erros.push({
      campo: 'identificacao.nome_completo',
      problema: 'Nome incompleto',
      acao_necessaria: 'Preencha o nome completo',
    });
  }

  const logr = getModeloPath(modelo, 'endereco.logradouro');
  const num = getModeloPath(modelo, 'endereco.numero');
  const bairro = getModeloPath(modelo, 'endereco.bairro');
  const cep = getModeloPath(modelo, 'endereco.cep');
  const uf = getModeloPath(modelo, 'endereco.uf');
  if (!logr || !num || !bairro || !cep || !uf) {
    erros.push({
      campo: 'endereco',
      problema: 'Endereco incompleto',
      acao_necessaria: 'Preencha logradouro, numero, bairro, CEP e UF',
    });
  } else {
    const cepD = String(cep).replace(/\D/g, '');
    if (cepD.length !== 8) {
      erros.push({
        campo: 'endereco.cep',
        problema: 'CEP invalido',
        acao_necessaria: 'Informe CEP com 8 digitos',
      });
    }
  }

  const pj = Number(getModeloPath(modelo, 'rendimentos.pj.total_bruto') ?? 0);
  if (pj <= 0 && ctx.qtdRendTributaveis === 0) {
    erros.push({
      campo: 'rendimentos',
      problema: 'Sem rendimentos tributaveis lancados',
      acao_necessaria: 'Importe XML com rendimentos ou cadastre rendimentos na base',
    });
  }

  return {
    apto: erros.length === 0,
    erros_impeditivos: erros,
    avisos,
  };
}
