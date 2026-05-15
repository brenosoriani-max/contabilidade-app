/**
 * IRPF DIRP Positional Engine (.DEC Import Layout)
 * 
 * Converte o modelo canônico de tributação para o formato textual DIRP
 * (Declaração de Importação) compatível com o software da Receita Federal.
 */

import { getModeloPath } from './irpf-model-utils';

function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s.,\-/()]/g, '')
    .toUpperCase();
}

function formatField(
  value: any,
  length: number,
  type: 'X' | 'N' | 'D' | 'V',
  options: { align?: 'L' | 'R'; padding?: string } = {}
): string {
  let result = '';

  if (type === 'V') {
    const val = typeof value === 'number' ? value : parseFloat(String(value || 0));
    const cents = Math.round(val * 100);
    result = String(cents).replace(/\D/g, '');
  } else if (type === 'D') {
    if (value && typeof value === 'string') {
      const parts = value.split('T')[0].split('-');
      if (parts.length === 3) {
        result = `${parts[2]}${parts[1]}${parts[0]}`;
      } else {
        result = value.replace(/\D/g, '').slice(0, 8);
      }
    }
  } else if (type === 'N') {
    result = String(value || '').replace(/\D/g, '');
  } else {
    result = normalizeText(value);
  }

  if (type === 'N' || type === 'V' || options.align === 'R') {
    const pad = options.padding ?? (type === 'X' ? ' ' : '0');
    return result.padStart(length, pad).slice(-length);
  } else {
    const pad = options.padding ?? ' ';
    return result.padEnd(length, pad).slice(0, length);
  }
}

interface FieldDef {
  key: string;
  size: number;
  type: 'X' | 'N' | 'D' | 'V';
  val?: any;
}

function renderDIRPRecord(prefixId: string, fields: FieldDef[], data: Record<string, any>): string {
  let record = prefixId;
  for (const f of fields) {
    const val = f.val !== undefined ? f.val : (data[f.key] ?? '');
    record += formatField(val, f.size, f.type);
  }
  return record;
}

export function generatePositionalIRPF(modelo: Record<string, unknown>): string {
  const lines: string[] = [];
  const ctx = modelo;
  const cpf = String(getModeloPath(ctx, 'identificacao.cpf') || '').replace(/\D/g, '');
  const exercicio = getModeloPath(ctx, 'declaracao.ano_exercicio') || '2025';
  const calendario = Number(exercicio) - 1;

  // --- REGISTRO IRPF (Header Geral) ---
  const layoutIRPF = [
    { key: 'exercicio', size: 4, type: 'N' as const },
    { key: 'calendario', size: 4, type: 'N' as const },
    { key: 'f1', size: 2, type: 'N' as const, val: '35' },
    { key: 'f2', size: 4, type: 'N' as const, val: '0000' },
    { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
    { key: 'f3', size: 7, type: 'X' as const, val: '   1130' },
    { key: 'nome', size: 60, type: 'X' as const },
    { key: 'uf', size: 2, type: 'X' as const },
    { key: 'municipioCode', size: 4, type: 'N' as const },
    { key: 'f4', size: 13, type: 'X' as const, val: '0599624365004' },
    { key: 'f5', size: 13, type: 'X' as const, val: '101939N0S    ' },
    { key: 'os', size: 20, type: 'X' as const, val: 'WINDOWS 11' },
    { key: 'ver', size: 20, type: 'X' as const, val: '10.0' },
  ];
  lines.push(renderDIRPRecord('IRPF    ', layoutIRPF, {
    nome: getModeloPath(ctx, 'identificacao.nome_completo'),
    uf: getModeloPath(ctx, 'endereco.uf'),
    municipioCode: getModeloPath(ctx, 'endereco.codigo_municipio_ibge'),
    exercicio,
    calendario,
  }));

  // --- REGISTRO 16 (Contribuinte) ---
  const layout16 = [
    { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
    { key: 'nome', size: 60, type: 'X' as const },
    { key: 'tipoLogr', size: 15, type: 'X' as const },
    { key: 'logradouro', size: 40, type: 'X' as const },
    { key: 'numero', size: 25, type: 'X' as const },
    { key: 'complemento', size: 20, type: 'X' as const },
    { key: 'bairro', size: 20, type: 'X' as const },
    { key: 'cep', size: 8, type: 'N' as const },
    { key: 'municipioCode', size: 5, type: 'N' as const },
    { key: 'municipioNome', size: 40, type: 'X' as const },
    { key: 'uf', size: 5, type: 'X' as const },
    { key: 'pais', size: 3, type: 'N' as const, val: '105' },
    { key: 'email', size: 100, type: 'X' as const },
    { key: 'f1', size: 13, type: 'X' as const, val: '2135090484811' },
    { key: 'f2', size: 11, type: 'X' as const, val: '           ' },
    { key: 'dataNasc', size: 8, type: 'D' as const },
  ];
  lines.push(renderDIRPRecord('16', layout16, {
    nome: getModeloPath(ctx, 'identificacao.nome_completo'),
    tipoLogr: getModeloPath(ctx, 'endereco.tipo_logradouro'),
    logradouro: getModeloPath(ctx, 'endereco.logradouro'),
    numero: getModeloPath(ctx, 'endereco.numero'),
    complemento: getModeloPath(ctx, 'endereco.complemento'),
    bairro: getModeloPath(ctx, 'endereco.bairro'),
    cep: String(getModeloPath(ctx, 'endereco.cep') || '').replace(/\D/g, ''),
    municipioCode: getModeloPath(ctx, 'endereco.codigo_municipio_ibge'),
    municipioNome: getModeloPath(ctx, 'endereco.municipio_nome'),
    uf: getModeloPath(ctx, 'endereco.uf'),
    email: getModeloPath(ctx, 'contato.email'),
    dataNasc: getModeloPath(ctx, 'identificacao.data_nascimento'),
  }));

  // --- REGISTROS 17 e 18 ---
  lines.push('17' + cpf + '0'.repeat(300));
  lines.push('18' + cpf + '0'.repeat(300));

  // --- REGISTRO 42 (Rendimentos PJ) ---
  const rawPjs = getModeloPath(ctx, 'rendimentos.pj');
  const pjs = Array.isArray(rawPjs) ? rawPjs : rawPjs ? [rawPjs] : [];
  for (const r of pjs) {
    const layout42 = [
      { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
      { key: 'cnpj', size: 14, type: 'N' as const },
      { key: 'nomeFonte', size: 60, type: 'X' as const },
      { key: 'valor', size: 13, type: 'V' as const },
      { key: 'previdencia', size: 13, type: 'V' as const },
      { key: 'irrf', size: 13, type: 'V' as const },
      { key: 'decimo', size: 13, type: 'V' as const },
      { key: 'irrfDecimo', size: 13, type: 'V' as const },
    ];
    lines.push(renderDIRPRecord('42', layout42, {
      cnpj: getModeloPath(r, 'cnpj'),
      nomeFonte: getModeloPath(r, 'nomeFonte'),
      valor: getModeloPath(r, 'total_bruto'),
      previdencia: getModeloPath(r, 'previdencia_oficial'),
      irrf: getModeloPath(r, 'irrf_retido'),
      decimo: getModeloPath(r, 'decimo_terceiro'),
      irrfDecimo: getModeloPath(r, 'irrf_decimo_terceiro'),
    }));
  }

  // --- REGISTRO 43 (Isentos) ---
  const rawIsentos = getModeloPath(ctx, 'rendimentos.isentos');
  const isentos = Array.isArray(rawIsentos) ? rawIsentos : rawIsentos ? [rawIsentos] : [];
  for (const r of isentos) {
    const layout43 = [
      { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
      { key: 'codigo', size: 2, type: 'N' as const },
      { key: 'cnpj', size: 14, type: 'N' as const },
      { key: 'nomeFonte', size: 60, type: 'X' as const },
      { key: 'valor', size: 13, type: 'V' as const },
    ];
    lines.push(renderDIRPRecord('43', layout43, {
      codigo: getModeloPath(r, 'codigo'),
      cnpj: getModeloPath(r, 'cnpjFonte'),
      nomeFonte: getModeloPath(r, 'nomeFonte') || getModeloPath(r, 'descricao'),
      valor: getModeloPath(r, 'valor'),
    }));
  }

  // --- REGISTRO 27 (Bens e Direitos) ---
  const rawBens = modelo.bens || getModeloPath(ctx, 'bens') || getModeloPath(ctx, 'patrimonio.bens_direitos');
  const bens = Array.isArray(rawBens) ? rawBens : rawBens ? [rawBens] : [];
  for (const bem of bens) {
    const layout27 = [
      { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
      { key: 'grupo', size: 2, type: 'N' as const },
      { key: 'codigo', size: 2, type: 'N' as const },
      { key: 'pais', size: 3, type: 'N' as const, val: '105' },
      { key: 'descricao', size: 255, type: 'X' as const },
      { key: 'valorAnt', size: 13, type: 'V' as const },
      { key: 'valorAtu', size: 13, type: 'V' as const },
    ];
    lines.push(renderDIRPRecord('27', layout27, {
      grupo: bem.grupo,
      codigo: bem.codigo,
      descricao: bem.descricao,
      valorAnt: bem.valorAnterior,
      valorAtu: bem.valorAtual,
    }));
  }

  // --- REGISTRO 28 (Dívidas e Ônus) ---
  const rawDividas = modelo.dividas || getModeloPath(ctx, 'dividas') || getModeloPath(ctx, 'patrimonio.dividas_onus');
  const dividas = Array.isArray(rawDividas) ? rawDividas : rawDividas ? [rawDividas] : [];
  for (const d of dividas) {
    const layout28 = [
      { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
      { key: 'codigo', size: 2, type: 'N' as const },
      { key: 'descricao', size: 255, type: 'X' as const },
      { key: 'valorAnt', size: 13, type: 'V' as const },
      { key: 'valorAtu', size: 13, type: 'V' as const },
      { key: 'valorPago', size: 13, type: 'V' as const },
    ];
    lines.push(renderDIRPRecord('28', layout28, {
      codigo: d.codigo,
      descricao: d.descricao,
      valorAnt: d.valorAnterior,
      valorAtu: d.valorAtual,
      valorPago: d.valorPago,
    }));
  }

  // --- REGISTRO 30 (Dependentes) ---
  const rawDependentes = modelo.dependentes || getModeloPath(ctx, 'dependentes');
  const dependentes = Array.isArray(rawDependentes) ? rawDependentes : rawDependentes ? [rawDependentes] : [];
  for (const dep of dependentes) {
    const layout30 = [
      { key: 'cpfTitular', size: 11, type: 'N' as const, val: cpf },
      { key: 'cpfDep', size: 11, type: 'N' as const },
      { key: 'nome', size: 60, type: 'X' as const },
      { key: 'dataNasc', size: 8, type: 'D' as const },
    ];
    lines.push(renderDIRPRecord('30', layout30, {
      cpfDep: dep.cpf,
      nome: dep.nome_completo,
      dataNasc: dep.data_nascimento,
    }));
  }

  // --- REGISTRO 45 (Pagamentos) ---
  const rawPagamentos = getModeloPath(ctx, 'pagamentos') || getModeloPath(ctx, 'deducoes.pagamentos_efetuados');
  const pagamentos = Array.isArray(rawPagamentos) ? rawPagamentos : rawPagamentos ? [rawPagamentos] : [];
  for (const p of pagamentos) {
    const layout45 = [
      { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
      { key: 'codigo', size: 2, type: 'N' as const },
      { key: 'benefic', size: 1, type: 'N' as const, val: '1' },
      { key: 'cpfCnpj', size: 14, type: 'N' as const },
      { key: 'nome', size: 60, type: 'X' as const },
      { key: 'valor', size: 13, type: 'V' as const },
    ];
    lines.push(renderDIRPRecord('45', layout45, {
      codigo: getModeloPath(p, 'codigo'),
      cpfCnpj: getModeloPath(p, 'cpfCnpj'),
      nome: getModeloPath(p, 'nomeBeneficiario'),
      valor: getModeloPath(p, 'valor'),
    }));
  }

  // --- TRAILERS ---
  const countBens = String(bens.length).padStart(5, '0');
  const countDeps = String(dependentes.length).padStart(5, '0');
  const countPjs = String(pjs.length).padStart(5, '0');
  const countDividas = String(dividas.length).padStart(5, '0');
  
  lines.push('T9' + cpf + '00001' + countDeps + '00001' + countPjs + countBens + countDividas + '0'.repeat(95));
  lines.push('HR' + cpf + ' '.repeat(50) + '2569018256');
  lines.push('DR' + cpf + ' '.repeat(50) + '1715793888');
  lines.push('R9' + cpf + ' '.repeat(50) + '09407833054054554240');

  return lines.join('\n');
}
