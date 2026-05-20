export const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.xml'];

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/xml',
  'text/xml',
];

export const DEFAULT_IR_CHECKLIST = [
  { chave: 'rg-cnh', nome: 'RG / CNH' },
  { chave: 'cpf', nome: 'CPF' },
  { chave: 'comprovante-residencia', nome: 'Comprovante de residência' },
  { chave: 'informe-rendimentos-empregador', nome: 'Informe de rendimentos (empregador)' },
  { chave: 'informe-rendimentos-bancarios', nome: 'Informe de rendimentos bancários' },
  { chave: 'extrato-previdencia-privada', nome: 'Extrato de previdência privada' },
  { chave: 'recibos-medicos-odontologicos', nome: 'Recibos médicos / odontológicos' },
  { chave: 'despesas-educacao', nome: 'Comprovante de despesas com educação' },
  { chave: 'comprovante-doacoes', nome: 'Comprovante de doações' },
  { chave: 'carne-leao', nome: 'Carnê-leão (se autônomo)' },
  { chave: 'darf-pago', nome: 'DARF pago (se aplicável)' },
  { chave: 'declaracao-ano-anterior', nome: 'Declaração do ano anterior' },
];

export type ChecklistStatus = 'pendente' | 'recebido' | 'nao_aplica';

export function calculateChecklistProgress(
  items: Array<{ status: ChecklistStatus }> | null | undefined
) {
  const source =
    items && items.length
      ? items
      : DEFAULT_IR_CHECKLIST.map(() => ({ status: 'pendente' as const }));

  const applicable = source.filter((item) => item.status !== 'nao_aplica');
  const total = applicable.length;
  const received = applicable.filter((item) => item.status === 'recebido').length;
  const percentage = total > 0 ? Math.round((received / total) * 100) : 100;

  return {
    received,
    total,
    percentage,
  };
}

export function getProgressTone(percentage: number) {
  if (percentage < 40) {
    return {
      label: 'Baixo',
      textClass: 'text-red-700',
      bgClass: 'bg-red-100',
      barClass: 'bg-red-500',
    };
  }

  if (percentage < 80) {
    return {
      label: 'Medio',
      textClass: 'text-amber-700',
      bgClass: 'bg-amber-100',
      barClass: 'bg-amber-500',
    };
  }

  return {
    label: 'Alto',
    textClass: 'text-emerald-700',
    bgClass: 'bg-emerald-100',
    barClass: 'bg-emerald-500',
  };
}
