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
  
  const rawExercicio = getModeloPath(ctx, 'declaracao.ano_exercicio');
  const exercicioNum = typeof rawExercicio === 'number' ? rawExercicio : parseInt(String(rawExercicio || '2025'));
  const exercicio = String(exercicioNum);
  const calendario = exercicioNum - 1;
  
  const cpfRaw = getModeloPath(ctx, 'identificacao.cpf');
  const cpf = String(cpfRaw || '').replace(/\D/g, '').slice(0, 11);
  const nomeCompleto = normalizeText(String(getModeloPath(ctx, 'identificacao.nome_completo') || ''));

  // --- REGISTRO IRPF (Header Geral) ---
  const layoutIRPF = [
    { key: 'exercicio', size: 4, type: 'N' as const, val: exercicio },
    { key: 'calendario', size: 4, type: 'N' as const, val: String(calendario) },
    { key: 'f1', size: 2, type: 'N' as const, val: '35' },
    { key: 'f2', size: 4, type: 'N' as const, val: '0000' },
    { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
    { key: 'f3', size: 7, type: 'X' as const, val: '   1130' },
    { key: 'nome', size: 60, type: 'X' as const, val: nomeCompleto },
    { key: 'uf', size: 2, type: 'X' as const, val: getModeloPath(ctx, 'endereco.uf') || 'SC' },
    { key: 'municipioCode', size: 4, type: 'N' as const, val: getModeloPath(ctx, 'endereco.codigo_municipio_ibge') || '0000' },
    { key: 'f4', size: 13, type: 'X' as const, val: '0599624365004' },
    { key: 'f5', size: 13, type: 'X' as const, val: '101939N0S    ' },
    { key: 'os', size: 20, type: 'X' as const, val: 'WINDOWS 11' },
    { key: 'ver', size: 20, type: 'X' as const, val: '10.0' },
  ];
  lines.push(renderDIRPRecord('IRPF    ', layoutIRPF, {}));

  // --- REGISTRO 16 (Contribuinte) ---
  const layout16 = [
    { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
    { key: 'nome', size: 60, type: 'X' as const, val: nomeCompleto },
    { key: 'tipoLogr', size: 15, type: 'X' as const, val: getModeloPath(ctx, 'endereco.tipo_logradouro') },
    { key: 'logradouro', size: 40, type: 'X' as const, val: getModeloPath(ctx, 'endereco.logradouro') },
    { key: 'numero', size: 25, type: 'X' as const, val: getModeloPath(ctx, 'endereco.numero') },
    { key: 'complemento', size: 20, type: 'X' as const, val: getModeloPath(ctx, 'endereco.complemento') },
    { key: 'bairro', size: 20, type: 'X' as const, val: getModeloPath(ctx, 'endereco.bairro') },
    { key: 'cep', size: 8, type: 'N' as const, val: String(getModeloPath(ctx, 'endereco.cep') || '').replace(/\D/g, '') },
    { key: 'municipioCode', size: 5, type: 'N' as const, val: getModeloPath(ctx, 'endereco.codigo_municipio_ibge') },
    { key: 'municipioNome', size: 40, type: 'X' as const, val: getModeloPath(ctx, 'endereco.municipio_nome') },
    { key: 'uf', size: 5, type: 'X' as const, val: getModeloPath(ctx, 'endereco.uf') },
    { key: 'pais', size: 3, type: 'N' as const, val: '105' },
    { key: 'email', size: 100, type: 'X' as const, val: getModeloPath(ctx, 'contato.email') },
    { key: 'f1', size: 13, type: 'X' as const, val: '2135090484811' },
    { key: 'f2', size: 11, type: 'X' as const, val: '           ' },
    { key: 'dataNasc', size: 8, type: 'D' as const, val: getModeloPath(ctx, 'identificacao.data_nascimento') },
  ];
  lines.push(renderDIRPRecord('16', layout16, {}));

  // --- REGISTROS 17 e 18 (Sinalizadores Vazios) ---
  lines.push('17' + cpf + '0'.repeat(300));
  lines.push('18' + cpf + '0'.repeat(300));

  // --- REGISTRO 42 (Rendimentos PJ) ---
  const rawPjs = getModeloPath(ctx, 'rendimentos.pj');
  const pjs = Array.isArray(rawPjs) ? rawPjs : rawPjs ? [rawPjs] : [];
  for (const r of pjs) {
    const layout42 = [
      { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
      { key: 'cnpj', size: 14, type: 'N' as const, val: getModeloPath(r, 'cnpj') },
      { key: 'nomeFonte', size: 60, type: 'X' as const, val: getModeloPath(r, 'nomeFonte') },
      { key: 'valor', size: 13, type: 'V' as const, val: getModeloPath(r, 'total_bruto') },
      { key: 'previdencia', size: 13, type: 'V' as const, val: getModeloPath(r, 'previdencia_oficial') },
      { key: 'irrf', size: 13, type: 'V' as const, val: getModeloPath(r, 'irrf_retido') },
      { key: 'decimo', size: 13, type: 'V' as const, val: getModeloPath(r, 'decimo_terceiro') },
      { key: 'irrfDecimo', size: 13, type: 'V' as const, val: getModeloPath(r, 'irrf_decimo_terceiro') },
    ];
    lines.push(renderDIRPRecord('42', layout42, {}));
  }

  // --- REGISTRO 43 (Isentos) ---
  const rawIsentos = getModeloPath(ctx, 'rendimentos.isentos');
  const isentos = Array.isArray(rawIsentos) ? rawIsentos : rawIsentos ? [rawIsentos] : [];
  for (const r of isentos) {
    const layout43 = [
      { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
      { key: 'codigo', size: 2, type: 'N' as const, val: getModeloPath(r, 'codigo') },
      { key: 'cnpj', size: 14, type: 'N' as const, val: getModeloPath(r, 'cnpjFonte') },
      { key: 'nomeFonte', size: 60, type: 'X' as const, val: getModeloPath(r, 'nomeFonte') || getModeloPath(r, 'descricao') },
      { key: 'valor', size: 13, type: 'V' as const, val: getModeloPath(r, 'valor') },
    ];
    lines.push(renderDIRPRecord('43', layout43, {}));
  }

  // --- REGISTRO 27 (Bens e Direitos) ---
  const rawBens = modelo.bens || getModeloPath(ctx, 'bens') || getModeloPath(ctx, 'patrimonio.bens_direitos');
  const bens = Array.isArray(rawBens) ? rawBens : rawBens ? [rawBens] : [];
  for (const bem of bens) {
    const layout27 = [
      { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
      { key: 'grupo', size: 2, type: 'N' as const, val: bem.grupo },
      { key: 'codigo', size: 2, type: 'N' as const, val: bem.codigo },
      { key: 'pais', size: 3, type: 'N' as const, val: bem.localizacao || '105' },
      { key: 'descricao', size: 255, type: 'X' as const, val: bem.descricao },
      { key: 'valorAnt', size: 13, type: 'V' as const, val: bem.valorAnterior },
      { key: 'valorAtu', size: 13, type: 'V' as const, val: bem.valorAtual },
    ];
    lines.push(renderDIRPRecord('27', layout27, {}));
  }

  // --- REGISTRO 28 (Dívidas e Ônus) ---
  const rawDividas = modelo.dividas || getModeloPath(ctx, 'dividas') || getModeloPath(ctx, 'patrimonio.dividas_onus');
  const dividas = Array.isArray(rawDividas) ? rawDividas : rawDividas ? [rawDividas] : [];
  for (const d of dividas) {
    const layout28 = [
      { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
      { key: 'codigo', size: 2, type: 'N' as const, val: d.codigo },
      { key: 'descricao', size: 255, type: 'X' as const, val: d.descricao },
      { key: 'valorAnt', size: 13, type: 'V' as const, val: d.valorAnterior },
      { key: 'valorAtu', size: 13, type: 'V' as const, val: d.valorAtual },
      { key: 'valorPago', size: 13, type: 'V' as const, val: d.valorPago },
    ];
    lines.push(renderDIRPRecord('28', layout28, {}));
  }

  // --- REGISTRO 30 (Dependentes) ---
  const rawDependentes = modelo.dependentes || getModeloPath(ctx, 'dependentes');
  const dependentes = Array.isArray(rawDependentes) ? rawDependentes : rawDependentes ? [rawDependentes] : [];
  for (const dep of dependentes) {
    const layout30 = [
      { key: 'cpfTitular', size: 11, type: 'N' as const, val: cpf },
      { key: 'cpfDep', size: 11, type: 'N' as const, val: String(dep.cpf || '').replace(/\D/g, '') },
      { key: 'nome', size: 60, type: 'X' as const, val: dep.nome_completo },
      { key: 'dataNasc', size: 8, type: 'D' as const, val: dep.data_nascimento },
    ];
    lines.push(renderDIRPRecord('30', layout30, {}));
  }

  // --- REGISTRO 45 (Pagamentos) ---
  const rawPagamentos = getModeloPath(ctx, 'pagamentos') || getModeloPath(ctx, 'deducoes.pagamentos_efetuados');
  const pagamentos = Array.isArray(rawPagamentos) ? rawPagamentos : rawPagamentos ? [rawPagamentos] : [];
  for (const p of pagamentos) {
    const layout45 = [
      { key: 'cpf', size: 11, type: 'N' as const, val: cpf },
      { key: 'codigo', size: 2, type: 'N' as const, val: getModeloPath(p, 'codigo') },
      { key: 'benefic', size: 1, type: 'N' as const, val: '1' },
      { key: 'cpfCnpj', size: 14, type: 'N' as const, val: String(getModeloPath(p, 'cpfCnpj') || '').replace(/\D/g, '') },
      { key: 'nome', size: 60, type: 'X' as const, val: getModeloPath(p, 'nomeBeneficiario') },
      { key: 'valor', size: 13, type: 'V' as const, val: getModeloPath(p, 'valor') },
    ];
    lines.push(renderDIRPRecord('45', layout45, {}));
  }

  // --- TRAILERS (Contagens de Registros) ---
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

