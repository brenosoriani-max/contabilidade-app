export function formatCurrency(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return 'R$ 0,00'

  const normalized =
    typeof value === 'string' ? Number(value.replace(/[^0-9.-]+/g, '')) : value

  if (normalized === undefined || normalized === null || Number.isNaN(normalized)) {
    return 'R$ 0,00'
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(normalized)
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return '0'
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function formatPercent(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return '0%'
  const normalized = typeof value === 'string' ? Number(value.replace(/[^0-9.-]+/g, '')) : value
  if (Number.isNaN(normalized)) return '0%'
  return `${normalized.toFixed(2)}%`
}

export function formatCPF(cpf: string | undefined | null): string {
  if (!cpf) return ''
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length !== 11) return cpf
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return ''

  // Date object
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('pt-BR')
  }

  const dateOnly = date.split(' ')[0]

  // Formato BR: DD/MM/YYYY ou DD/MM
  if (dateOnly.includes('/')) {
    const parts = dateOnly.split('/')
    const day   = Number(parts[0])
    const month = Number(parts[1])
    const year  = parts[2] ? Number(parts[2]) : new Date().getFullYear()

    const d = new Date(year, month - 1, day) // local time, sem UTC
    if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR')
    return dateOnly
  }

  // Formato ISO: YYYY-MM-DD — parseia como local time para evitar UTC shift
  if (/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) {
    const [year, month, day] = dateOnly.split('-').map(Number)
    const d = new Date(year, month - 1, day) // local time, sem UTC
    if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR')
  }

  // Fallback
  const d = new Date(date)
  if (isNaN(d.getTime())) return String(date)
  return d.toLocaleDateString('pt-BR')
}

export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return String(date)
  }
  return d.toLocaleString('pt-BR')
}

export function formatCEP(cep: string | undefined | null): string {
  if (!cep) return ''
  const cleaned = cep.replace(/\D/g, '')
  if (cleaned.length !== 8) return cep
  return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2')
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function getResultColor(resultado: string | null): string {
  switch (resultado) {
    case 'RESTITUIR':
      return 'text-green-600 bg-green-100'
    case 'PAGAR':
      return 'text-red-600 bg-red-100'
    case 'ZERO':
      return 'text-blue-600 bg-blue-100'
    default:
      return 'text-muted-foreground bg-muted'
  }
}

export function getResultLabel(resultado: string | null): string {
  switch (resultado) {
    case 'RESTITUIR':
      return 'A Restituir'
    case 'PAGAR':
      return 'A Pagar'
    case 'ZERO':
      return 'Zero'
    default:
      return 'Pendente'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'agendado':
      return 'text-yellow-600 bg-yellow-100'
    case 'confirmado':
      return 'text-green-600 bg-green-100'
    case 'pendente':
      return 'text-yellow-600 bg-yellow-100'
    case 'concluido':
      return 'text-blue-600 bg-blue-100'
    case 'cancelado':
      return 'text-red-600 bg-red-100'
    default:
      return 'text-muted-foreground bg-muted'
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'agendado':
      return 'Agendado'
    case 'confirmado':
      return 'Confirmado'
    case 'pendente':
      return 'Pendente'
    case 'concluido':
      return 'Concluido'
    case 'cancelado':
      return 'Cancelado'
    default:
      return status
  }
}
export function maskBRL(value: string): string {
  const onlyDigits = value.replace(/\D/g, "");
  const numericValue = Number(onlyDigits) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
}

export function parseBRLToNumber(value: string): number {
  return Number(value.replace(/\D/g, "")) / 100;
}

export function getPipelineStatusLabel(status: string | null | undefined): string {
  if (!status) return "Não Iniciada"
  const s = status.toLowerCase()
  switch (s) {
    case "nao_iniciada":
      return "Não Iniciada"
    case "em_preenchimento":
      return "Em Andamento"
    case "transmitida":
    case "processada":
    case "finalizada":
    case "concluido":
      return "Finalizada"
    case "pendente":
    case "malha":
      return "Pendente / Malha"
    default:
      return "Em Andamento"
  }
}

export function getPipelineStatusColor(status: string | null | undefined): string {
  if (!status) return "text-slate-500 bg-slate-100 border-slate-200"
  const s = status.toLowerCase()
  switch (s) {
    case "nao_iniciada":
      return "text-slate-500 bg-slate-100 border-slate-200"
    case "em_preenchimento":
      return "text-amber-600 bg-amber-50 border-amber-200"
    case "transmitida":
    case "processada":
    case "finalizada":
    case "concluido":
      return "text-emerald-600 bg-emerald-50 border-emerald-200"
    case "pendente":
    case "malha":
      return "text-red-600 bg-red-50 border-red-200"
    default:
      return "text-amber-600 bg-amber-50 border-amber-200"
  }
}
