/**
 * IRPF Positional Engine
 * 
 * Converte o modelo canônico de tributação para o formato textual posicional (fixed-width)
 * utilizado pela Receita Federal para importação em lote/integração.
 * 
 * Regras:
 * - Sem acentos (ASCII Puro)
 * - Valores em centavos sem separadores (Zeros à esquerda)
 * - Texto com espaços à direita (Padding Right)
 * - Datas DDMMAAAA sem separadores
 */

import { getModeloPath } from './irpf-model-utils';

/** Remove acentos e caracteres especiais para compatibilidade ASCII. */
function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s.,\-/()]/g, '')
    .toUpperCase();
}

/** Formata campo de acordo com o tamanho e tipo. */
function formatField(
  value: any,
  length: number,
  type: 'X' | 'N' | 'D' | 'V',
  options: { align?: 'L' | 'R'; padding?: string } = {}
): string {
  let result = '';

  if (type === 'V') {
    // Valor monetário em centavos
    const val = typeof value === 'number' ? value : parseFloat(String(value || 0));
    const cents = Math.round(val * 100);
    result = String(cents).replace(/\D/g, '');
  } else if (type === 'D') {
    // Data DDMMAAAA
    if (value && typeof value === 'string') {
      const parts = value.split('T')[0].split('-');
      if (parts.length === 3) {
        // YYYY-MM-DD -> DDMMAAAA
        result = `${parts[2]}${parts[1]}${parts[0]}`;
      } else {
        result = value.replace(/\D/g, '').slice(0, 8);
      }
    }
  } else if (type === 'N') {
    // Numérico simples
    result = String(value || '').replace(/\D/g, '');
  } else {
    // Texto (X)
    result = normalizeText(value);
  }

  // Padding e Truncate
  if (type === 'N' || type === 'V' || options.align === 'R') {
    // Alinhamento à direita (zeros por padrão para N/V)
    const pad = options.padding ?? (type === 'X' ? ' ' : '0');
    return result.padStart(length, pad).slice(-length);
  } else {
    // Alinhamento à esquerda (espaços por padrão)
    const pad = options.padding ?? ' ';
    return result.padEnd(length, pad).slice(0, length);
  }
}

interface FieldDef {
  key: string;
  size: number;
  type: 'X' | 'N' | 'D' | 'V';
  val?: any; // Valor fixo se presente
}

/** Renderiza um registro posicional baseado em um layout. */
function renderRecord(typeId: string, fields: FieldDef[], data: Record<string, any>): string {
  let record = formatField(typeId, 2, 'N'); // Tipo de registro sempre inicia

  for (const f of fields) {
    const val = f.val !== undefined ? f.val : (data[f.key] ?? '');
    record += formatField(val, f.size, f.type);
  }

  return record;
}

export function generatePositionalIRPF(modelo: Record<string, unknown>): string {
  const lines: string[] = [];
  const ctx = modelo;

  // --- HEADER / REGISTRO 10 (Identificação Geral) ---
  const reg10 = [
    { key: 'cpf', size: 11, type: 'N' as const },
    { key: 'nome', size: 60, type: 'X' as const },
    { key: 'exercicio', size: 4, type: 'N' as const },
    { key: 'calendario', size: 4, type: 'N' as const },
    { key: 'retificadora', size: 1, type: 'N' as const, val: getModeloPath(ctx, 'declaracao.retificadora') ? '1' : '0' },
    { key: 'nRecibo', size: 10, type: 'X' as const, val: '' }, // Opcional
  ];
  
  lines.push(renderRecord('10', reg10, {
    cpf: getModeloPath(ctx, 'identificacao.cpf'),
    nome: getModeloPath(ctx, 'identificacao.nome_completo'),
    exercicio: getModeloPath(ctx, 'declaracao.ano_exercicio'),
    calendario: Number(getModeloPath(ctx, 'declaracao.ano_exercicio') || 0) - 1,
  }));

  // --- REGISTRO 11 (Endereço) ---
  const reg11 = [
    { key: 'tipoLogr', size: 3, type: 'X' as const },
    { key: 'logradouro', size: 40, type: 'X' as const },
    { key: 'numero', size: 6, type: 'X' as const },
    { key: 'complemento', size: 20, type: 'X' as const },
    { key: 'bairro', size: 20, type: 'X' as const },
    { key: 'cep', size: 8, type: 'N' as const },
    { key: 'municipio', size: 4, type: 'N' as const }, // Código IBGE ou RFB
    { key: 'uf', size: 2, type: 'X' as const },
  ];

  lines.push(renderRecord('11', reg11, {
    tipoLogr: getModeloPath(ctx, 'endereco.tipo_logradouro'),
    logradouro: getModeloPath(ctx, 'endereco.logradouro'),
    numero: getModeloPath(ctx, 'endereco.numero'),
    complemento: getModeloPath(ctx, 'endereco.complemento'),
    bairro: getModeloPath(ctx, 'endereco.bairro'),
    cep: String(getModeloPath(ctx, 'endereco.cep') || '').replace(/\D/g, ''),
    municipio: getModeloPath(ctx, 'endereco.codigo_municipio_ibge'),
    uf: getModeloPath(ctx, 'endereco.uf'),
  }));

  // --- REGISTRO 12 (Cônjuge) ---
  const cpfConjuge = getModeloPath(ctx, 'identificacao.cpf_conjuge');
  if (cpfConjuge) {
    const layout12 = [{ key: 'cpf', size: 11, type: 'N' as const }];
    lines.push(renderRecord('12', layout12, { cpf: cpfConjuge }));
  }

  // --- REGISTRO 16 (Dados Adicionais Contribuinte) ---
  const reg16 = [
    { key: 'titulo', size: 13, type: 'N' as const },
    { key: 'dataNasc', size: 8, type: 'D' as const },
    { key: 'natureza', size: 2, type: 'N' as const },
    { key: 'ocupacao', size: 3, type: 'N' as const },
  ];
  lines.push(renderRecord('16', reg16, {
    titulo: getModeloPath(ctx, 'identificacao.titulo_eleitor'),
    dataNasc: getModeloPath(ctx, 'identificacao.data_nascimento'),
    natureza: getModeloPath(ctx, 'identificacao.natureza_ocupacao'),
    ocupacao: getModeloPath(ctx, 'identificacao.ocupacao_principal'),
  }));

  // --- REGISTRO 19 (Rendimentos PJ) ---
  const rawPjs = getModeloPath(ctx, 'rendimentos.pj');
  const pjs = Array.isArray(rawPjs) ? rawPjs : rawPjs ? [rawPjs] : [];
  for (const r of pjs) {
    const layout19 = [
      { key: 'cnpj', size: 14, type: 'N' as const },
      { key: 'nomeFonte', size: 60, type: 'X' as const },
      { key: 'valor', size: 13, type: 'V' as const },
      { key: 'previdencia', size: 13, type: 'V' as const },
      { key: 'irrf', size: 13, type: 'V' as const },
      { key: 'decimo', size: 13, type: 'V' as const },
      { key: 'irrfDecimo', size: 13, type: 'V' as const },
    ];
    lines.push(renderRecord('19', layout19, {
      cnpj: getModeloPath(r, 'cnpj') || '00000000000000',
      nomeFonte: getModeloPath(r, 'nomeFonte') || 'FONTE PAGADORA',
      valor: getModeloPath(r, 'total_bruto'),
      previdencia: getModeloPath(r, 'previdencia_oficial'),
      irrf: getModeloPath(r, 'irrf_retido'),
      decimo: getModeloPath(r, 'decimo_terceiro'),
      irrfDecimo: getModeloPath(r, 'irrf_decimo_terceiro'),
    }));
  }

  // --- REGISTRO 21 (Rendimentos Isentos) ---
  const rawIsentos = getModeloPath(ctx, 'rendimentos.isentos');
  const isentos = Array.isArray(rawIsentos) ? rawIsentos : rawIsentos ? [rawIsentos] : [];
  for (const r of isentos) {
    const layout21 = [
      { key: 'codigo', size: 2, type: 'N' as const },
      { key: 'tipo', size: 1, type: 'N' as const }, // 1-Titular, 2-Dependente
      { key: 'cpfDep', size: 11, type: 'N' as const },
      { key: 'cnpjFonte', size: 14, type: 'N' as const },
      { key: 'nomeFonte', size: 60, type: 'X' as const },
      { key: 'valor', size: 13, type: 'V' as const },
    ];
    lines.push(renderRecord('21', layout21, {
      codigo: getModeloPath(r, 'codigo') || '99',
      tipo: '1',
      cpfDep: '00000000000',
      cnpjFonte: getModeloPath(r, 'cnpjFonte') || '00000000000000',
      nomeFonte: getModeloPath(r, 'nomeFonte') || getModeloPath(r, 'descricao'),
      valor: getModeloPath(r, 'valor'),
    }));
  }

  // --- REGISTRO 22 (Rendimentos Exclusivos) ---
  const rawExclusivos = getModeloPath(ctx, 'exclusivos');
  const exclusivos = Array.isArray(rawExclusivos) ? rawExclusivos : rawExclusivos ? [rawExclusivos] : [];
  for (const r of exclusivos) {
    const layout22 = [
      { key: 'codigo', size: 2, type: 'N' as const },
      { key: 'tipo', size: 1, type: 'N' as const },
      { key: 'cpfDep', size: 11, type: 'N' as const },
      { key: 'cnpjFonte', size: 14, type: 'N' as const },
      { key: 'nomeFonte', size: 60, type: 'X' as const },
      { key: 'valor', size: 13, type: 'V' as const },
    ];
    lines.push(renderRecord('22', layout22, {
      codigo: getModeloPath(r, 'codigo') || '99',
      tipo: '1',
      cpfDep: '00000000000',
      cnpjFonte: getModeloPath(r, 'cnpjFonte') || '00000000000000',
      nomeFonte: getModeloPath(r, 'nomeFonte') || getModeloPath(r, 'descricao'),
      valor: getModeloPath(r, 'valor'),
    }));
  }

  // --- REGISTRO 27 (Bens e Direitos) ---
  const rawBens = modelo.bens;
  const bens = Array.isArray(rawBens) ? rawBens : rawBens ? [rawBens] : [];
  for (const bem of bens) {
    const layout27 = [
      { key: 'codigo', size: 2, type: 'N' as const },
      { key: 'pais', size: 3, type: 'N' as const },
      { key: 'discriminacao', size: 255, type: 'X' as const },
      { key: 'valorAnt', size: 13, type: 'V' as const },
      { key: 'valorAtu', size: 13, type: 'V' as const },
    ];
    lines.push(renderRecord('27', layout27, {
      codigo: bem.codigo,
      pais: bem.pais || '105',
      discriminacao: bem.descricao,
      valorAnt: bem.valorAnterior,
      valorAtu: bem.valorAtual,
    }));
  }

  // --- REGISTRO 28 (Dívidas e Ônus) ---
  const rawDividas = modelo.dividas;
  const dividas = Array.isArray(rawDividas) ? rawDividas : rawDividas ? [rawDividas] : [];
  for (const div of dividas) {
    const layout28 = [
      { key: 'codigo', size: 2, type: 'N' as const },
      { key: 'discriminacao', size: 255, type: 'X' as const },
      { key: 'valorAnt', size: 13, type: 'V' as const },
      { key: 'valorAtu', size: 13, type: 'V' as const },
      { key: 'valorPago', size: 13, type: 'V' as const },
    ];
    lines.push(renderRecord('28', layout28, {
      codigo: div.codigo,
      discriminacao: div.descricao,
      valorAnt: div.valorAnterior,
      valorAtu: div.valorAtual,
      valorPago: div.valorPago,
    }));
  }

  // --- REGISTRO 30 (Dependentes) ---
  const rawDependentes = modelo.dependentes;
  const dependentes = Array.isArray(rawDependentes) ? rawDependentes : rawDependentes ? [rawDependentes] : [];
  for (const dep of dependentes) {
    const layout30 = [
      { key: 'tipo', size: 2, type: 'N' as const },
      { key: 'cpf', size: 11, type: 'N' as const },
      { key: 'nome', size: 60, type: 'X' as const },
      { key: 'dataNasc', size: 8, type: 'D' as const },
    ];
    lines.push(renderRecord('30', layout30, {
      tipo: dep.codigo_dependente || '11',
      cpf: dep.cpf,
      nome: dep.nome_completo,
      dataNasc: dep.data_nascimento,
    }));
  }

  // --- REGISTRO 31 (Alimentandos) ---
  const rawAlimentandos = getModeloPath(ctx, 'alimentandos');
  const alimentandos = Array.isArray(rawAlimentandos) ? rawAlimentandos : rawAlimentandos ? [rawAlimentandos] : [];
  for (const a of alimentandos) {
    const layout31 = [
      { key: 'cpf', size: 11, type: 'N' as const },
      { key: 'nome', size: 60, type: 'X' as const },
      { key: 'dataNasc', size: 8, type: 'D' as const },
    ];
    lines.push(renderRecord('31', layout31, {
      cpf: getModeloPath(a, 'cpf'),
      nome: getModeloPath(a, 'nome_completo'),
      dataNasc: getModeloPath(a, 'data_nascimento'),
    }));
  }

  // --- REGISTRO 51 (Pagamentos Efetuados) ---
  const rawPagamentos = getModeloPath(ctx, 'pagamentos');
  const pagamentos = Array.isArray(rawPagamentos) ? rawPagamentos : rawPagamentos ? [rawPagamentos] : [];
  for (const p of pagamentos) {
    const layout51 = [
      { key: 'codigo', size: 2, type: 'N' as const },
      { key: 'tipoBenefic', size: 1, type: 'N' as const },
      { key: 'cpfCnpj', size: 14, type: 'N' as const },
      { key: 'nome', size: 60, type: 'X' as const },
      { key: 'valor', size: 13, type: 'V' as const },
      { key: 'reembolso', size: 13, type: 'V' as const },
    ];
    lines.push(renderRecord('51', layout51, {
      codigo: getModeloPath(p, 'codigo') || '99',
      tipoBenefic: '1', // Default to Titular
      cpfCnpj: getModeloPath(p, 'cpfCnpj'),
      nome: getModeloPath(p, 'nomeBeneficiario'),
      valor: getModeloPath(p, 'valor'),
      reembolso: getModeloPath(p, 'valorReembolso'),
    }));
  }

  // --- TRAILERS ---
  lines.push(formatField('99', 2, 'N') + formatField(lines.length + 1, 10, 'N'));

  return lines.join('\n');
}
