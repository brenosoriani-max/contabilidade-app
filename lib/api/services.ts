import { api, unwrap } from '@/lib/api/client';
import type {
  Alert,
  ContribuinteSummary,
  DashboardMetrics,
  FilterParams,
  LoginResponse,
  PaginatedResponse,
  SafeUser,
  Scheduling,
  XMLImportResult,
} from '@/types';

export const authService = {
  login: (email: string, password: string) =>
    unwrap<LoginResponse>(api.post('/auth/login', { email, password })),
  me: () => unwrap<LoginResponse>(api.get('/auth/me')),
  logout: () => unwrap<{ success: boolean }>(api.post('/auth/logout')),
};

export const dashboardService = {
  get: () => unwrap<DashboardMetrics>(api.get('/dashboard')),
};

export const alertService = {
  list: () => unwrap<{ alertas: Alert[] }>(api.get('/alertas')),
  markAsRead: (id: string | number) =>
    unwrap<{ message: string }>(api.patch(`/alertas/${id}/lido`)),
  resolve: (id: string | number) =>
    unwrap<{ message: string }>(api.patch(`/alertas/${id}/resolvido`)),
};


export const contribuinteService = {
  list: (params: FilterParams) =>
    unwrap<{
      contribuintes: ContribuinteSummary[];
      pagination: PaginatedResponse<ContribuinteSummary>;
    }>(api.get('/contribuintes', { params })),
  get: (id: number) =>
    unwrap<{
      contribuinte?: ContribuinteSummary;
      declaracoes?: any[];
      ultimaDeclaracao?: any;
      rendimentos?: unknown[];
      bens?: any[];
    }>(api.get(`/contribuintes/${id}`)),
  create: (data: Record<string, unknown>) =>
    unwrap<{ message: string; contribuinte: ContribuinteSummary }>(
      api.post('/contribuintes', data)
    ),
  update: (id: number, data: Record<string, unknown>) =>
    unwrap<{ message: string; contribuinte: ContribuinteSummary }>(
      api.put(`/contribuintes/${id}`, data)
    ),
  remove: (id: number) =>
    unwrap<{ message: string }>(api.delete(`/contribuintes/${id}`)),
};

export const userService = {
  list: () => unwrap<{ usuarios: SafeUser[] }>(api.get('/usuarios')),
  create: (data: Record<string, unknown>) =>
    unwrap<{ message: string; usuario: SafeUser }>(api.post('/usuarios', data)),
  update: (id: number, data: Record<string, unknown>) =>
    unwrap<{ message: string; usuario: SafeUser }>(
      api.put(`/usuarios/${id}`, data)
    ),
  remove: (id: number) =>
    unwrap<{ message: string }>(api.delete(`/usuarios/${id}`)),
};

export const schedulingService = {
  list: (status?: string) =>
    unwrap<{ agendamentos: Scheduling[] }>(
      api.get('/agendamentos', { params: { status } })
    ),
  get: (id: number) =>
    unwrap<{ agendamento: Scheduling }>(api.get(`/agendamentos/${id}`)),
  create: (data: Record<string, unknown>) =>
    unwrap<{ message: string; agendamento: Scheduling }>(
      api.post('/agendamentos', data)
    ),
  update: (id: number, data: Record<string, unknown>) =>
    unwrap<{ message: string; agendamento: Scheduling }>(
      api.put(`/agendamentos/${id}`, data)
    ),
  remove: (id: number) =>
    unwrap<{ message: string }>(api.delete(`/agendamentos/${id}`)),
  updateChecklist: (id: number, items: unknown[]) =>
    unwrap<{ message: string; agendamento: Scheduling }>(
      api.put(`/agendamentos/${id}/checklist`, { items })
    ),
  uploadDocuments: (id: number, files: File[], checklistItemId?: number | null) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (checklistItemId) {
      formData.append('checklistItemId', String(checklistItemId));
    }

    return unwrap<{ message: string; agendamento: Scheduling }>(
      api.post(`/agendamentos/${id}/documentos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );
  },
  deleteDocument: (id: number, documentId: number) =>
    unwrap<{ message: string; agendamento: Scheduling }>(
      api.delete(`/agendamentos/${id}/documentos/${documentId}`)
    ),
  generateUploadLink: (id: number, expiresInDays = 7) =>
    unwrap<{ message: string; link: Scheduling['envioLink']; agendamento: Scheduling }>(
      api.post(`/agendamentos/${id}/link-envio`, { expiresInDays })
    ),
};

export const importService = {
  xml: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    return unwrap<XMLImportResult>(
      api.post('/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );
  },
};

export const declaracaoIrpfService = {
  importarXml(declaracaoId: number, file: File, anoExercicio?: number) {
    const formData = new FormData();
    formData.append('xml', file);
    if (anoExercicio != null) {
      formData.append('anoExercicio', String(anoExercicio));
    }
    return unwrap<{ sucesso: boolean; declaracaoId: number }>(
      api.post(`/declaracoes/${declaracaoId}/importar-xml`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );
  },

  uploadDocumento(
    declaracaoId: number,
    file: File,
    tag: string,
    agendamentoId?: number | null,
    origem?: 'contador' | 'cliente_link'
  ) {
    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('tag', tag);
    if (agendamentoId) {
      formData.append('agendamentoId', String(agendamentoId));
    }
    if (origem) {
      formData.append('origem', origem);
    }
    return unwrap<{ sucesso: boolean; resumo: Record<string, unknown>; modelo: unknown }>(
      api.post(`/declaracoes/${declaracaoId}/documento`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );
  },

  putCampo(
    declaracaoId: number,
    body: { campo: string; valor: string; editadoPor?: string }
  ) {
    return unwrap<{ sucesso: boolean; valorNormalizado: string | null }>(
      api.put(`/declaracoes/${declaracaoId}/campo`, body)
    );
  },

  getChecklist(declaracaoId: number) {
    return unwrap<Record<string, unknown>>(api.get(`/declaracoes/${declaracaoId}/checklist`));
  },
};

export const configuracaoService = {
  get: () => unwrap<{ configuracoes: any }>(api.get('/configuracoes')),
  update: (data: Record<string, unknown>) =>
    unwrap<{ configuracoes: any }>(api.put('/configuracoes', data)),
};
