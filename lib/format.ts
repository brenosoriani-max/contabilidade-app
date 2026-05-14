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
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    // Try to parse BR format
    if (typeof date === 'string' && date.includes('/')) {
      return date.split(' ')[0]
    }
    return String(date)
  }
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
