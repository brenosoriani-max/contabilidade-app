/**
 * anchor-parser.ts
 *
 * Extração de documentos IRPF sem IA e sem regex frágil.
 * Usa "âncoras de texto" — os próprios rótulos do documento.
 *
 * Instalar: npm install pdf-parse
 *            npm install --save-dev @types/pdf-parse
 *
 * Para imagens (RG, CNH): npm install tesseract.js
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ExtractionResult {
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
  rendimentos_pj?: RendimentoPJ[];
  bens?: BemDireito[];
  rendimentos_pf_mensal?: RendimentoPFMes[];
  confianca: number;
}

export interface RendimentoPJ {
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

export interface BemDireito {
  codigo_irpf: string;
  grupo: string;
  discriminacao: string;
  valor_anterior: number | null;
  valor_atual: number | null;
  cnpj?: string | null;
  fonte: string;
  status: 'sugerido';
  confianca: number;
}

export interface RendimentoPFMes {
  mes: string;
  carne_leao: number;
  alugueis: number;
  pessoa_fisica: number;
  darf_pago: number;
  irrf_retido: number;
}

// ─── Utilitários de texto ─────────────────────────────────────────────────────

/**
 * Normaliza o texto extraído do PDF:
 * - remove espaços múltiplos
 * - remove linhas completamente vazias
 * - mantém quebras de linha para facilitar as buscas por âncora
 */
function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')   // espaços múltiplos → 1 espaço
    .replace(/\n{3,}/g, '\n\n')   // linhas em branco múltiplas → 1
    .trim();
}

/**
 * Busca um rótulo âncora no texto e retorna a string que vem depois dele.
 * afterLines: quantas linhas depois do rótulo procurar o valor (padrão: 0 = mesma linha ou próxima)
 */
function afterAnchor(
  text: string,
  anchor: string,
  opts: { linhasDepois?: number; maxChars?: number } = {},
): string | null {
  const { linhasDepois = 0, maxChars = 200 } = opts;
  const idx = text.indexOf(anchor);
  if (idx === -1) return null;

  const after = text.slice(idx + anchor.length);
  const lines = after.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) return null;
  const line = lines[linhasDepois] ?? lines[0];
  return line.slice(0, maxChars).trim() || null;
}

/**
 * Converte valor monetário brasileiro para float.
 * "R$ 25.916,03" → 25916.03
 * "25.916,03"    → 25916.03
 */
function parseMoney(raw: string | null): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')        // remove pontos de milhar
    .replace(',', '.')         // vírgula → ponto decimal
    .trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Extrai um CNPJ formatado de uma string.
 * Retorna null se não encontrar.
 */
function extractCnpj(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  return match ? match[0] : null;
}

/**
 * Extrai um CPF formatado de uma string.
 */
function extractCpf(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  return match ? match[0] : null;
}

/**
 * Extrai um CEP formatado de uma string.
 */
function extractCep(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\d{5}-\d{3}/);
  if (match) return match[0];
  const raw = text.match(/\d{8}/);
  if (raw) return `${raw[0].slice(0, 5)}-${raw[0].slice(5)}`;
  return null;
}

/**
 * Extrai uma data DD/MM/AAAA de uma string.
 */
function extractDate(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\d{2}\/\d{2}\/\d{4}/);
  return match ? match[0] : null;
}

// ─── Extração de texto do PDF ─────────────────────────────────────────────────

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Importação dinâmica para evitar erros de build quando pdf-parse não está instalado
    const pdfParseModule: any = await import('pdf-parse');
    const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule.default || pdfParseModule;
    const data = await pdfParse(buffer);
    return normalizeText(data.text ?? '');
  } catch (err) {
    console.error('[anchor-parser] pdf-parse erro:', err);
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSERS POR TIPO DE DOCUMENTO
// Cada parser recebe o texto normalizado e retorna ExtractionResult parcial.
// As âncoras são os rótulos exatos do documento oficial da Receita Federal.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Comprovante de Rendimentos (Informe de Rendimentos PJ) ────────────────
// Baseado na IN RFB nº 2060/2021 — layout fixo por lei

function parseInformeRendimentos(text: string): ExtractionResult {
  // CNPJ e razão social da fonte pagadora
  const cnpjRaw  = afterAnchor(text, 'CNPJ/CPF');
  const cnpj     = extractCnpj(cnpjRaw ?? text) ?? '';
  const razao    = afterAnchor(text, 'Nome Empresarial', { linhasDepois: 0 })
                ?? afterAnchor(text, 'Nome Empresarial\n')
                ?? '';

  // Beneficiário
  const cpfBenef = afterAnchor(text, 'CPF\n') ?? afterAnchor(text, 'CPF ');
  const nomeBenef = afterAnchor(text, 'Nome Completo');

  // Ano-calendário
  const anoLine = afterAnchor(text, 'Ano-calendário');
  const anoCalendario = parseInt(anoLine ?? '') || new Date().getFullYear() - 1;

  // Exercício
  const exercicioLine = afterAnchor(text, 'Exercício de ');
  const exercicio = parseInt(exercicioLine ?? '') || new Date().getFullYear();

  // Rendimentos Tributáveis (quadro 3)
  const totalRend   = parseMoney(afterAnchor(text, '1. Total dos rendimentos (inclusive férias)'));
  const prevOficial = parseMoney(afterAnchor(text, '2. Contribuição previdenciária oficial'));
  const prevCompl   = parseMoney(afterAnchor(text, '3. Contribuição a entidades de previdência complementar'));
  const pensaoAl    = parseMoney(afterAnchor(text, '4. Pensão alimentícia'));
  const irrfRetido  = parseMoney(afterAnchor(text, '5. Imposto sobre a renda retido na fonte'));

  // Rendimentos Isentos (quadro 4)
  const isentoParcAposent = parseMoney(afterAnchor(text, '1. Parcela isenta dos proventos de aposentadoria'));
  const isentoParcAposent13 = parseMoney(afterAnchor(text, '2. Parcela isenta do 13º salário de aposentadoria'));
  const diarias           = parseMoney(afterAnchor(text, '3. Diárias e ajudas de custo'));
  const lucrosDividendos  = parseMoney(afterAnchor(text, '5. Lucros e dividendos'));
  const indenizacoes      = parseMoney(afterAnchor(text, '7. Indenizações por rescisões'));
  const outrosIsentos     = parseMoney(afterAnchor(text, '9. Outros (especificar'));

  const totalIsentos = isentoParcAposent + isentoParcAposent13 + diarias
                     + lucrosDividendos + indenizacoes + outrosIsentos;

  // Tributação Exclusiva (quadro 5)
  const decimoTerceiro     = parseMoney(afterAnchor(text, '1. Décimo terceiro salário'));
  const irrfDecimoTerceiro = parseMoney(afterAnchor(text, '2. Imposto sobre a renda retido na fonte sobre 13º'));

  // Confiança: alta se encontramos os campos principais
  const fieldsFound = [cnpj, razao, totalRend > 0, irrfRetido > 0].filter(Boolean).length;
  const confianca = fieldsFound >= 3 ? 0.95 : fieldsFound >= 2 ? 0.7 : 0.3;

  const rendimento: RendimentoPJ = {
    cnpj_fonte:                  cnpj,
    razao_social:                razao.trim(),
    valor_bruto:                 totalRend,
    irrf_retido:                 irrfRetido,
    contribuicao_previdenciaria: prevOficial,
    decimo_terceiro:             decimoTerceiro,
    irrf_decimo_terceiro:        irrfDecimoTerceiro,
    rendimentos_isentos:         totalIsentos,
    ano_calendario:              anoCalendario,
    fonte:                       'anchor_informe_pdf',
    status:                      'sugerido',
    confianca,
  };

  return { rendimentos_pj: [rendimento], confianca };
}

// ─── 2. Comprovante de Residência (PDF) ──────────────────────────────────────

function parseComprovante(text: string): ExtractionResult {
  // Tenta diferentes âncoras pois cada empresa tem um layout
  const cepRaw = afterAnchor(text, 'CEP')
              ?? afterAnchor(text, 'Cep')
              ?? text;

  const cep = extractCep(cepRaw);

  // UF: procura padrão "Cidade - UF" ou "Cidade/UF"
  const ufMatch = text.match(/\b([A-Z]{2})\s*[-\/]\s*\d{5}/)  // "SP - 04166"
               ?? text.match(/,\s*([A-Z]{2})\s*[\n,]/);        // ", SP\n"
  const uf = ufMatch ? ufMatch[1] : null;

  // Logradouro: âncoras comuns
  const logradouro = afterAnchor(text, 'Endereço:')
                  ?? afterAnchor(text, 'Logradouro:')
                  ?? afterAnchor(text, 'Rua ')
                  ?? afterAnchor(text, 'Avenida ')
                  ?? afterAnchor(text, 'Av. ');

  // CEP sem âncora — busca padrão no texto inteiro
  const cepFinal = cep ?? extractCep(text);

  const confianca = [cepFinal, uf, logradouro].filter(Boolean).length >= 2 ? 0.85 : 0.5;

  return {
    enderecoCep: cepFinal ?? undefined,
    enderecoUf: uf ?? undefined,
    enderecoLogradouro: logradouro?.split('\n')[0].trim() ?? undefined,
    confianca,
  };
}

// ─── 3. Extrato Bancário (PDF) ───────────────────────────────────────────────

function parseExtratoBancario(text: string): ExtractionResult {
  const bens: BemDireito[] = [];

  // Nome do banco
  const banco = afterAnchor(text, 'Banco ')
             ?? afterAnchor(text, 'BANCO ')
             ?? 'BANCO NÃO IDENTIFICADO';

  const cnpjBanco = extractCnpj(text);

  // Conta corrente
  const saldoCCRaw = afterAnchor(text, 'Conta Corrente')
                  ?? afterAnchor(text, 'CONTA CORRENTE');
  if (saldoCCRaw) {
    const agencia = text.match(/Ag[eê]ncia[:\s]+(\d{4,5})/i)?.[1] ?? null;
    const conta   = text.match(/Conta[:\s]+(\d{4,8}-?\d?)/i)?.[1] ?? null;
    bens.push({
      codigo_irpf: '61',
      grupo: 'G6',
      discriminacao: [
        `SALDO EM CONTA CORRENTE`,
        banco.toUpperCase().trim(),
        agencia ? `AG ${agencia}` : null,
        conta   ? `CONTA ${conta}` : null,
      ].filter(Boolean).join(' - '),
      valor_anterior: null,
      valor_atual: parseMoney(saldoCCRaw),
      cnpj: cnpjBanco ?? undefined,
      fonte: 'anchor_extrato_pdf',
      status: 'sugerido',
      confianca: 0.85,
    });
  }

  // Poupança
  const saldoPoupRaw = afterAnchor(text, 'Poupança')
                    ?? afterAnchor(text, 'POUPANÇA')
                    ?? afterAnchor(text, 'Poupanca');
  if (saldoPoupRaw) {
    bens.push({
      codigo_irpf: '41',
      grupo: 'G4',
      discriminacao: `SALDO DE POUPANÇA - ${banco.toUpperCase().trim()}`,
      valor_anterior: null,
      valor_atual: parseMoney(saldoPoupRaw),
      cnpj: cnpjBanco ?? undefined,
      fonte: 'anchor_extrato_pdf',
      status: 'sugerido',
      confianca: 0.85,
    });
  }

  return { bens, confianca: bens.length > 0 ? 0.85 : 0.4 };
}

// ─── 4. Carnê-Leão / Recibo Autônomo (PDF) ───────────────────────────────────

const MESES: Record<string, string> = {
  janeiro: '01', fevereiro: '02', março: '03', marco: '03',
  abril: '04', maio: '05', junho: '06', julho: '07',
  agosto: '08', setembro: '09', outubro: '10',
  novembro: '11', dezembro: '12',
};

function parseCarneleao(text: string): ExtractionResult {
  const lowerText = text.toLowerCase();
  const meses: RendimentoPFMes[] = [];

  for (const [nomeMes, numMes] of Object.entries(MESES)) {
    const idx = lowerText.indexOf(nomeMes);
    if (idx === -1) continue;

    const bloco = text.slice(idx, idx + 400);
    const carne  = parseMoney(afterAnchor(bloco, 'Carnê-leão') ?? afterAnchor(bloco, 'Carne-leao'));
    const alugs  = parseMoney(afterAnchor(bloco, 'Aluguel') ?? afterAnchor(bloco, 'aluguéis'));
    const pf     = parseMoney(afterAnchor(bloco, 'Pessoa Física') ?? afterAnchor(bloco, 'Pessoa Fisica'));
    const darf   = parseMoney(afterAnchor(bloco, 'DARF') ?? afterAnchor(bloco, 'darf pago'));
    const irrf   = parseMoney(afterAnchor(bloco, 'IRRF') ?? afterAnchor(bloco, 'Imposto Retido'));

    if (carne > 0 || alugs > 0 || pf > 0) {
      meses.push({ mes: numMes, carne_leao: carne, alugueis: alugs,
                   pessoa_fisica: pf, darf_pago: darf, irrf_retido: irrf });
    }
  }

  return {
    rendimentos_pf_mensal: meses,
    confianca: meses.length > 0 ? 0.8 : 0.3,
  };
}

// ─── 5. CRLV / Documento do Veículo (PDF) ────────────────────────────────────

function parseCrlv(text: string): ExtractionResult {
  const placa   = text.match(/[A-Z]{3}[-\s]?\d{1}[A-Z0-9]{1}\d{2}|[A-Z]{3}\d{4}/)?.[0] ?? null;
  const renavam = text.match(/RENAVAM[:\s]+(\d{9,11})/i)?.[1]
               ?? text.match(/\b\d{11}\b/)?.[0]
               ?? null;

  const marcaLine  = afterAnchor(text, 'Marca/Modelo') ?? afterAnchor(text, 'MARCA/MODELO');
  const anoLine    = afterAnchor(text, 'Ano Fab') ?? afterAnchor(text, 'ANO FAB');
  const anoModLine = afterAnchor(text, 'Ano Mod') ?? afterAnchor(text, 'ANO MOD');

  const discriminacao = [
    'VEÍCULO',
    marcaLine?.split('\n')[0].trim(),
    anoLine   ? `FAB ${anoLine.trim().split(/\s/)[0]}` : null,
    anoModLine? `MOD ${anoModLine.trim().split(/\s/)[0]}` : null,
    placa  ? `PLACA ${placa}` : null,
    renavam? `RENAVAM ${renavam}` : null,
  ].filter(Boolean).join(' - ');

  const confianca = [placa, renavam, marcaLine].filter(Boolean).length >= 2 ? 0.9 : 0.5;

  return {
    bens: [{
      codigo_irpf: '21',
      grupo: 'G2',
      discriminacao,
      valor_anterior: null,
      valor_atual: null,
      fonte: 'anchor_crlv_pdf',
      status: 'sugerido',
      confianca,
    }],
    confianca,
  };
}

// ─── 6. Imagens: RG, CNH, Título de Eleitor (Tesseract.js — opcional) ─────────
// Para usar: npm install tesseract.js
// Tesseract extrai o texto da imagem → mesmo parser de âncoras

async function extractImageText(buffer: Buffer): Promise<string> {
  try {
    // Importação dinâmica — só carrega se tiver tesseract.js instalado
    // Se não estiver instalado, retorna string vazia (fallback para Claude OCR)
    let Tesseract: any;
    try {
      // @ts-ignore - tesseract.js é opcional
      Tesseract = await import('tesseract.js');
    } catch {
      console.warn('[anchor-parser] tesseract.js não instalado. Use: npm install tesseract.js');
      return '';
    }
    
    const { data: { text } } = await Tesseract.recognize(buffer, 'por', {
      logger: () => {},  // silencia logs do Tesseract
    });
    return normalizeText(text);
  } catch (err) {
    console.error('[anchor-parser] Tesseract erro:', err);
    return '';
  }
}

function parseRgCnh(text: string): ExtractionResult {
  const date = extractDate(text)
            ?? text.match(/DATA DE NASC[A-Z.]*\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]
            ?? null;

  return {
    dataNascimento: date ?? undefined,
    confianca: date ? 0.85 : 0.4,
  };
}

function parseTituloEleitor(text: string): ExtractionResult {
  // Título: sequência de 12–13 dígitos
  const num = text.match(/\d{4}\s\d{4}\s\d{4}/)
           ?? text.match(/\d{12,13}/);
  const titulo = num ? num[0].replace(/\s/g, '') : null;

  return {
    tituloEleitor: titulo ?? undefined,
    confianca: titulo ? 0.85 : 0.4,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCHER PRINCIPAL
// Decide qual parser usar com base na tag e no tipo de arquivo
// ═══════════════════════════════════════════════════════════════════════════════

export async function parseDocument(
  tag: string,
  buffer: Buffer,
  mediaType: string,
): Promise<ExtractionResult> {

  // ── PDFs: extrai texto primeiro ──────────────────────────────────────────
  if (mediaType === 'application/pdf') {
    const text = await extractPdfText(buffer);

    if (!text.trim()) {
      console.warn(`[anchor-parser] PDF sem texto (tag: ${tag}). Arquivo pode ser scan.`);
      return { confianca: 0 };
    }

    switch (tag) {
      case 'Informe de rendimentos':
        return parseInformeRendimentos(text);

      case 'Comprovante de residência':
      case 'Comprovante de residencia':
        return parseComprovante(text);

      case 'Extrato bancário':
        return parseExtratoBancario(text);

      case 'Carnê-leão / Recibo autônomo':
        return parseCarneleao(text);

      case 'CRLV / Documento do veículo':
        return parseCrlv(text);

      default:
        console.warn(`[anchor-parser] Tag sem parser para PDF: "${tag}"`);
        return { confianca: 0 };
    }
  }

  // ── Imagens: Tesseract → texto → parser ─────────────────────────────
  if (mediaType.startsWith('image/')) {
    const text = await extractImageText(buffer);

    if (!text.trim()) return { confianca: 0 };

    switch (tag) {
      case 'RG / CNH':
        return parseRgCnh(text);

      case 'Título de Eleitor':
      case 'Titulo de Eleitor':
        return parseTituloEleitor(text);

      case 'Comprovante de residência':
      case 'Comprovante de residencia':
        return parseComprovante(text);

      default:
        console.warn(`[anchor-parser] Tag sem parser para imagem: "${tag}"`);
        return { confianca: 0 };
    }
  }

  return { confianca: 0 };
}
