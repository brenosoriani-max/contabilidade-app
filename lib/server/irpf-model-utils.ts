/** Utilitários do modelo canônico (sem chamadas a API externa). */

export function tagToFonte(tag: string): string {
  const map: Record<string, string> = {
    'RG / CNH': 'documento_cliente',
    CPF: 'documento_cliente',
    'Comprovante de residência': 'documento_cliente',
    'Informe de rendimentos': 'documento_cliente',
    'Extrato bancário': 'documento_cliente',
    'Carnê-leão / Recibo autônomo': 'documento_cliente',
    'Nota de corretagem / Informe de investimentos': 'documento_cliente',
  };
  return map[tag] || 'documento_cliente';
}

export function extrairCamposObrigatorios(modelo: Record<string, unknown>): { status?: string }[] {
  const out: { status?: string }[] = [];

  function walk(v: unknown, depth: number) {
    if (depth > 24 || v == null) return;
    if (Array.isArray(v)) {
      v.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if ('valor' in o && 'status' in o) {
      out.push({ status: o.status as string | undefined });
      return;
    }
    for (const k of Object.keys(o)) walk(o[k], depth + 1);
  }

  walk(modelo, 0);
  return out;
}

export function calcularProgresso(modelo: Record<string, unknown> | null | undefined): number {
  const campos = extrairCamposObrigatorios(modelo || {});
  if (!campos.length) return 0;
  const confirmados = campos.filter((c) => c.status === 'confirmado').length;
  return Math.round((confirmados / campos.length) * 100);
}

export function calcularStatusPipeline(
  modelo: Record<string, unknown> | null | undefined
): string {
  const pct = calcularProgresso(modelo);
  if (pct < 30) return 'pendente';
  if (pct < 80) return 'coletando_docs';
  if (pct < 95) return 'revisao_contador';
  return 'pronto_envio';
}

export function applyFieldEdit(
  modelo: Record<string, unknown>,
  caminho: string,
  valor: unknown,
  fonte = 'manual_contador'
): Record<string, unknown> {
  const modeloCopy = JSON.parse(JSON.stringify(modelo || {})) as Record<string, unknown>;
  const parts = caminho.split('.').filter(Boolean);
  if (!parts.length) return modeloCopy;

  let ref: Record<string, unknown> = modeloCopy;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const next = ref[p];
    if (
      next == null ||
      typeof next !== 'object' ||
      Array.isArray(next) ||
      ('valor' in (next as object) && 'status' in (next as object))
    ) {
      ref[p] = {};
    }
    ref = ref[p] as Record<string, unknown>;
  }

  const last = parts[parts.length - 1];
  ref[last] = {
    valor,
    fonte,
    status: 'confirmado',
    confianca: 1,
    editado_em: new Date().toISOString(),
  };
  return modeloCopy;
}

export function unwrapModeloValor(v: unknown): unknown {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'valor' in v) {
    return (v as { valor: unknown }).valor;
  }
  return v;
}

export function getModeloPath(modelo: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let cur: unknown = modelo;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return unwrapModeloValor(cur);
}
