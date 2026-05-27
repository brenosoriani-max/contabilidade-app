import { toNumber } from '@/lib/server/api';
import { calculateChecklistProgress } from '@/lib/scheduling-checklist';
import type {
  Alert,
  ContribuinteSummary,
  Declaration,
  SchedulingChecklistItem,
  SchedulingDocument,
  SchedulingHistoryItem,
  SchedulingUploadLink,
  Scheduling,
} from '@/types';

function iso(date: Date | string | null | undefined) {
  if (!date) return null;
  return typeof date === 'string' ? date : date.toISOString();
}

function dateOnly(date: Date | string | null | undefined) {
  const value = iso(date);
  return value ? value.slice(0, 10) : null;
}

function timeOnly(date: Date | string | null | undefined) {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  return value.toISOString().slice(11, 16);
}

function resultado(impostoRestituir: unknown, impostoPagar: unknown) {
  if (toNumber(impostoRestituir) > 0) return 'RESTITUIR';
  if (toNumber(impostoPagar) > 0) return 'PAGAR';
  return 'ZERO';
}

export function mapDeclaration(declaracao: any): Declaration {
  const contribuinte = declaracao.contribuinte;
  const rendimentos = declaracao.rendimentosTributaveis ?? [];
  const bens = declaracao.bensDireitos ?? [];
  const dividas = declaracao.dividasOnus ?? [];

  const totalIRRF = rendimentos.reduce(
    (sum: number, item: any) => sum + toNumber(item.valorIrrf),
    0
  );
  const totalRendimentosTributaveis = rendimentos.reduce(
    (sum: number, item: any) => sum + toNumber(item.valorRendimento),
    0
  );
  const totalPrevOficial = rendimentos.reduce(
    (sum: number, item: any) => sum + toNumber(item.valorPrevidencia),
    0
  );
  const totalDecimoTerceiro = rendimentos.reduce(
    (sum: number, item: any) => sum + toNumber(item.valor13o),
    0
  );
  const totalBensAnterior = bens.reduce(
    (sum: number, item: any) => sum + toNumber(item.valorAnterior),
    0
  );
  const totalBensAtual = bens.reduce(
    (sum: number, item: any) => sum + toNumber(item.valorAtual),
    0
  );
  const totalDividasAnterior = dividas.reduce(
    (sum: number, item: any) => sum + toNumber(item.valorAnterior),
    0
  );
  const totalDividasAtual = dividas.reduce(
    (sum: number, item: any) => sum + toNumber(item.valorAtual),
    0
  );
  const baseCalculo = toNumber(declaracao.baseCalculo);
  const impostoDevido = toNumber(declaracao.impostoDevido);

  return {
    id: declaracao.id,
    contribuinteId: declaracao.contribuinteId,
    cpf: contribuinte?.cpf ?? '',
    nome: contribuinte?.nome ?? '',
    exercicio: String(declaracao.anoExercicio),
    anoExercicio: declaracao.anoExercicio,
    dataCriacao: iso(declaracao.createdAt),
    resultadoDeclaracao: resultado(
      declaracao.impostoRestituir,
      declaracao.impostoPagar
    ),
    tipoDeclaracao: declaracao.tipoDeclaracao,
    situacao: declaracao.situacao,
    dataNascimento: dateOnly(contribuinte?.dataNascimento),
    endereco: [
      contribuinte?.enderecoLogradouro,
      contribuinte?.enderecoNumero,
      contribuinte?.enderecoComplemento,
    ]
      .filter(Boolean)
      .join(', ') || null,
    municipio: contribuinte?.enderecoMunicipio ?? null,
    uf: contribuinte?.enderecoUf ?? null,
    bairro: contribuinte?.enderecoBairro ?? null,
    cep: contribuinte?.enderecoCep ?? null,
    ocupacao: contribuinte?.ocupacaoPrincipal ?? null,
    naturezaOcupacao: contribuinte?.naturezaOcupacao ?? null,
    totalRendPJ:
      toNumber(declaracao.totalRendimentosTributaveis) ||
      totalRendimentosTributaveis,
    totalIRRF,
    totalPrevOficial,
    totalDecimoTerceiro,
    totalRendIsentos: toNumber(declaracao.totalRendimentosIsentos),
    totalTribExclusiva: toNumber(declaracao.totalRendimentosExclusivos),
    rendAplicacoes: 0,
    ganhosCapital: 0,
    totalBensAnterior,
    totalBensAtual: toNumber(declaracao.totalBens) || totalBensAtual,
    qtdBens: bens.length,
    totalDividasAnterior,
    totalDividasAtual,
    baseCalculo,
    impostoDevido,
    impostoRestituir: toNumber(declaracao.impostoRestituir),
    saldoPagar: toNumber(declaracao.impostoPagar),
    aliquotaEfetiva: baseCalculo > 0 ? (impostoDevido / baseCalculo) * 100 : 0,
    totalImpostoPago: toNumber(declaracao.impostoPago),
    rawData: declaracao.dadosJson ? safeJson(declaracao.dadosJson) : null,
    createdAt: iso(declaracao.createdAt) ?? '',
    updatedAt: iso(declaracao.updatedAt) ?? '',
  };
}

export function mapContribuinte(contribuinte: any): ContribuinteSummary {
  const ultimaDeclaracao = contribuinte.declaracoes?.[0]
    ? mapDeclaration({
        ...contribuinte.declaracoes[0],
        contribuinte,
      })
    : null;

  return {
    id: contribuinte.id,
    cpf: contribuinte.cpf,
    nome: contribuinte.nome,
    dataNascimento: dateOnly(contribuinte.dataNascimento),
    tituloEleitor: contribuinte.tituloEleitor,
    enderecoCep: contribuinte.enderecoCep,
    enderecoUf: contribuinte.enderecoUf,
    enderecoMunicipio: contribuinte.enderecoMunicipio,
    enderecoBairro: contribuinte.enderecoBairro,
    enderecoLogradouro: contribuinte.enderecoLogradouro,
    enderecoNumero: contribuinte.enderecoNumero,
    enderecoComplemento: contribuinte.enderecoComplemento,
    telefone: contribuinte.telefone,
    email: contribuinte.email,
    ocupacaoPrincipal: contribuinte.ocupacaoPrincipal,
    naturezaOcupacao: contribuinte.naturezaOcupacao,
    createdAt: iso(contribuinte.createdAt) ?? '',
    updatedAt: iso(contribuinte.updatedAt) ?? '',
    ultimaDeclaracao,
  };
}

export function mapScheduling(agendamento: any): Scheduling {
  const checklist = (agendamento.checklist ?? [])
    .map(mapSchedulingChecklistItem)
    .sort((a: SchedulingChecklistItem, b: SchedulingChecklistItem) => a.ordem - b.ordem);

  return {
    id: agendamento.id,
    contribuinteId: agendamento.contribuinteId,
    usuarioId: agendamento.usuarioId,
    cpf: agendamento.contribuinte?.cpf ?? '',
    nome: agendamento.contribuinte?.nome ?? agendamento.titulo,
    responsavel: agendamento.usuario?.nome ?? null,
    titulo: agendamento.titulo,
    descricao: agendamento.descricao,
    dataAgendamento: dateOnly(agendamento.dataAgendamento) ?? '',
    horaInicio: timeOnly(agendamento.horaInicio),
    horaFim: timeOnly(agendamento.horaFim),
    status: agendamento.status,
    tipo: agendamento.tipo,
    observacoes: agendamento.observacoes,
    documents: (agendamento.documentos ?? []).map(mapSchedulingDocument),
    checklist,
    checklistProgress: calculateChecklistProgress(checklist),
    envioLink: agendamento.envioLink
      ? mapSchedulingUploadLink(agendamento.envioLink)
      : null,
    history: agendamento.history
      ? agendamento.history.map(mapSchedulingHistoryItem)
      : undefined,
    createdAt: iso(agendamento.createdAt) ?? '',
    updatedAt: iso(agendamento.updatedAt) ?? '',
  };
}

export function mapSchedulingDocument(doc: any): SchedulingDocument {
  return {
    id: doc.id,
    schedulingId: doc.agendamentoId,
    checklistItemId: doc.checklistItemId ?? null,
    checklistItemKey: doc.checklistItemKey ?? null,
    nome: doc.nomeArquivo,
    tipo: doc.tipoArquivo,
    tamanhoBytes: doc.tamanhoBytes ?? 0,
    url: doc.urlArquivo,
    createdAt: iso(doc.createdAt) ?? '',
  };
}

export function mapSchedulingChecklistItem(item: any): SchedulingChecklistItem {
  return {
    id: item.id,
    schedulingId: item.agendamentoId,
    chave: item.chave,
    nome: item.nome,
    status: item.status,
    ordem: item.ordem,
    updatedAt: iso(item.updatedAt) ?? '',
  };
}

export function mapSchedulingUploadLink(link: any): SchedulingUploadLink {
  const expiresAt = iso(link.expiresAt) ?? '';

  return {
    token: link.token,
    url: `/enviar-documentos/${link.token}`,
    expiresAt,
    expired: expiresAt ? new Date(expiresAt).getTime() < Date.now() : true,
  };
}

export function mapSchedulingHistoryItem(log: any): SchedulingHistoryItem {
  return {
    id: log.id,
    acao: log.acao,
    detalhes: log.detalhes,
    responsavel: log.usuario?.nome ?? null,
    createdAt: iso(log.createdAt) ?? '',
  };
}

export function mapAlert(alerta: any): Alert {
  return {
    id: String(alerta.id),
    type:
      alerta.prioridade === 'urgente' || alerta.prioridade === 'alta'
        ? 'error'
        : alerta.prioridade === 'media'
          ? 'warning'
          : 'info',
    title: alerta.titulo,
    message: alerta.mensagem ?? '',
    cpf: alerta.contribuinte?.cpf,
    declarationId: alerta.declaracaoId ?? undefined,
    read: alerta.lido,
    createdAt: iso(alerta.createdAt) ?? '',
  };
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}
