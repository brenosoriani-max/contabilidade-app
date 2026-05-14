export const DADOS_JSON_VERSION = 2 as const;

export type DadosJsonMeta = {
  status_pipeline?: string;
  percentual_completo?: number;
  historico_conflitos?: unknown[];
  alertas_revisao?: { campo: string; confianca: number }[];
  /** Metadados de PDFs/imagens anexados à declaração (sem OCR). */
  documentos_arquivados?: Array<Record<string, unknown>>;
};

export type DadosJsonEnvelopeV2 = {
  _v: typeof DADOS_JSON_VERSION;
  modelo?: Record<string, unknown>;
  _meta?: DadosJsonMeta;
  /** Preservado quando a importação antiga gravou a árvore XML parseada em `dadosJson`. */
  legacyParsedXml?: Record<string, unknown>;
};

export function parseDadosJson(raw: string | null | undefined): {
  envelope: DadosJsonEnvelopeV2 | null;
  legacyXmlTree: Record<string, unknown> | null;
} {
  if (!raw?.trim()) {
    return { envelope: null, legacyXmlTree: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { envelope: null, legacyXmlTree: null };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { envelope: null, legacyXmlTree: null };
  }
  const o = parsed as Record<string, unknown>;
  if (o._v === DADOS_JSON_VERSION) {
    return {
      envelope: o as DadosJsonEnvelopeV2,
      legacyXmlTree: (o.legacyParsedXml as Record<string, unknown>) ?? null,
    };
  }
  if (o.modelo && typeof o.modelo === 'object') {
    return {
      envelope: {
        _v: DADOS_JSON_VERSION,
        modelo: o.modelo as Record<string, unknown>,
        _meta: (o._meta as DadosJsonMeta) ?? {},
        legacyParsedXml: (o.legacyParsedXml as Record<string, unknown>) ?? undefined,
      },
      legacyXmlTree: null,
    };
  }
  return {
    envelope: null,
    legacyXmlTree: o,
  };
}

export function wrapLegacyXmlAsEnvelope(
  legacyXmlTree: Record<string, unknown> | null,
  modelo?: Record<string, unknown> | null,
  _meta?: DadosJsonMeta
): DadosJsonEnvelopeV2 {
  return {
    _v: DADOS_JSON_VERSION,
    legacyParsedXml: legacyXmlTree ?? undefined,
    modelo: modelo ?? undefined,
    _meta: _meta ?? {},
  };
}

export function serializeEnvelope(e: DadosJsonEnvelopeV2): string {
  return JSON.stringify(e);
}

export function mergeEnvelopeMeta(
  envelope: DadosJsonEnvelopeV2,
  patch: Partial<DadosJsonMeta>
): DadosJsonEnvelopeV2 {
  return {
    ...envelope,
    _meta: { ...envelope._meta, ...patch },
  };
}
