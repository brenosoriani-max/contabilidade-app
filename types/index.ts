export type UserRole = 'admin' | 'contador' | 'assistente';

export interface ApiError {
  message: string;
  status?: number;
}

export type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };

export interface SafeUser {
  id: number;
  nome: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  telefone: string | null;
  cargo: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SchedulingStatus =
  | "agendado"
  | "confirmado"
  | "em_andamento"
  | "concluido"
  | "cancelado"

export type SchedulingChecklistStatus =
  | 'pendente'
  | 'recebido'
  | 'nao_aplica';

export interface AuthUser extends SafeUser {}

export interface LoginResponse {
  user: SafeUser;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FilterParams {
  search?: string;
  exercicio?: string;
  resultado?: string;
  uf?: string;
  page?: number;
  limit?: number;
}

export interface ContribuinteSummary {
  id: number;
  cpf: string;
  nome: string;
  dataNascimento: string | null;
  tituloEleitor: string | null;
  enderecoCep: string | null;
  enderecoUf: string | null;
  enderecoMunicipio: string | null;
  enderecoBairro: string | null;
  enderecoLogradouro: string | null;
  enderecoNumero: string | null;
  enderecoComplemento: string | null;
  telefone: string | null;
  email: string | null;
  ocupacaoPrincipal: string | null;
  naturezaOcupacao: string | null;
  createdAt: string;
  updatedAt: string;
  ultimaDeclaracao: Declaration | null;
}

export interface Declaration {
  id: number;
  contribuinteId: number;
  cpf: string;
  nome: string;
  exercicio: string;
  anoExercicio: number;
  dataCriacao: string | null;
  resultadoDeclaracao: 'RESTITUIR' | 'PAGAR' | 'ZERO' | null;
  tipoDeclaracao: string | null;
  situacao: string | null;
  dataNascimento: string | null;
  endereco: string | null;
  municipio: string | null;
  uf: string | null;
  bairro: string | null;
  cep: string | null;
  ocupacao: string | null;
  naturezaOcupacao: string | null;
  totalRendPJ: number;
  totalIRRF: number;
  totalPrevOficial: number;
  totalDecimoTerceiro: number;
  totalRendIsentos: number;
  totalTribExclusiva: number;
  rendAplicacoes: number;
  ganhosCapital: number;
  totalBensAnterior: number;
  totalBensAtual: number;
  qtdBens: number;
  totalDividasAnterior: number;
  totalDividasAtual: number;
  baseCalculo: number;
  impostoDevido: number;
  impostoRestituir: number;
  saldoPagar: number;
  aliquotaEfetiva: number;
  totalImpostoPago: number;
  rawData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface BemDireito {
  id: number;
  declaracaoId: number;
  grupo: number | null;
  codigo: number | null;
  descricao: string | null;
  localizacao: string | null;
  valorAnterior: number | string;
  valorAtual: number | string;
  createdAt: string;
}

export interface DashboardMetrics {
  totalContribuintes: number;
  totalDeclaracoes: number;
  exercicioAtual: string;
  totalRendimentosPJ: number;
  totalRendimentosIsentos: number;
  totalTributacaoExclusiva: number;
  totalIRRF: number;
  totalPatrimonio: number;
  variacaoPatrimonial: number;
  totalImpostoDevido: number;
  totalRestituir: number;
  totalPagar: number;
  declaracoesRestituir: number;
  declaracoesPagar: number;
  declaracoesZero: number;
  alertas: Alert[];
  rendimentosPorFonte: { fonte: string; valor: number }[];
  distribuicaoResultado: { tipo: string; count: number; valor: number }[];
  evolucaoPatrimonial: { ano: string; anterior: number; atual: number }[];
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  cpf?: string;
  declarationId?: number;
  read?: boolean;
  createdAt?: string;
}

export interface Scheduling {
  id: number;
  declarationId?: number;
  contribuinteId: number | null;
  usuarioId: number | null;
  cpf: string;
  nome: string;
  responsavel: string | null;
  titulo: string;
  descricao: string | null;
  dataAgendamento: string;
  horaInicio: string;
  horaFim: string;
  status: 'agendado' | 'confirmado' | 'em_andamento' | 'concluido' | 'cancelado';
  tipo: string;
  observacoes: string | null;
  documents: SchedulingDocument[];
  checklist: SchedulingChecklistItem[];
  checklistProgress: SchedulingChecklistProgress;
  envioLink: SchedulingUploadLink | null;
  history?: SchedulingHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SchedulingDocument {
  id: number;
  schedulingId: number;
  checklistItemId: number | null;
  checklistItemKey: string | null;
  nome: string;
  tipo: string | null;
  tamanhoBytes: number;
  url: string | null;
  createdAt: string;
}

export interface SchedulingChecklistItem {
  id: number;
  schedulingId: number;
  chave: string;
  nome: string;
  status: SchedulingChecklistStatus;
  ordem: number;
  updatedAt: string;
}

export interface SchedulingChecklistProgress {
  received: number;
  total: number;
  percentage: number;
}

export interface SchedulingUploadLink {
  token: string;
  url: string;
  expiresAt: string;
  expired: boolean;
}

export interface SchedulingHistoryItem {
  id: number;
  acao: string;
  detalhes: string | null;
  responsavel: string | null;
  createdAt: string;
}

export interface XMLImportResult {
  success: boolean;
  message: string;
  results?: Array<{
    file: string;
    success: boolean;
    error?: string;
    contribuinteId?: number;
    nome?: string;
    cpf?: string;
  }>;
}
