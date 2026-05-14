import { randomUUID } from 'crypto';
import path from 'path';
import { mkdir, unlink, writeFile } from 'fs/promises';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_MIME_TYPES,
  DEFAULT_IR_CHECKLIST,
  MAX_DOCUMENT_FILE_SIZE,
  type ChecklistStatus,
} from '@/lib/scheduling-checklist';

type DbClient = Prisma.TransactionClient | typeof prisma;

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'agendamentos');

const FILE_NAME_MATCHES: Record<string, string[]> = {
  'rg-cnh': ['rg', 'cnh', 'identidade'],
  cpf: ['cpf'],
  'comprovante-residencia': ['residencia', 'endereco', 'agua', 'luz', 'telefone'],
  'informe-rendimentos-empregador': ['empregador', 'rendimentos', 'holerite'],
  'informe-rendimentos-bancarios': ['bancario', 'banco', 'aplicacao', 'conta'],
  'extrato-previdencia-privada': ['previdencia', 'pgbl', 'vgbl'],
  'recibos-medicos-odontologicos': ['medico', 'odontologico', 'saude', 'dentista'],
  'despesas-educacao': ['educacao', 'escola', 'faculdade', 'curso'],
  'comprovante-doacoes': ['doacao', 'doacoes'],
  'carne-leao': ['carne', 'leao', 'autonomo'],
  'darf-pago': ['darf'],
  'declaracao-ano-anterior': ['declaracao', 'anterior', 'recibo'],
};

function normalizeForMatch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function documentMatchesChecklist(documentName: string, checklistKey: string) {
  const normalized = normalizeForMatch(documentName);
  return (FILE_NAME_MATCHES[checklistKey] ?? []).some((term) =>
    normalized.includes(term)
  );
}

export async function recordSchedulingHistory(
  db: DbClient,
  usuarioId: number | null,
  agendamentoId: number,
  acao: string,
  detalhes?: string
) {
  await db.logAtividade.create({
    data: {
      usuarioId,
      acao,
      entidade: 'agendamento',
      entidadeId: agendamentoId,
      detalhes: detalhes || null,
    },
  });
}

export async function ensureSchedulingChecklist(
  db: DbClient,
  agendamentoId: number,
  contribuinteId?: number | null
) {
  const existing = await db.checklistAgendamento.findMany({
    where: { agendamentoId },
    orderBy: { ordem: 'asc' },
  });

  if (existing.length) return existing;

  const copiedStatusByKey = new Map<string, ChecklistStatus>();
  const copiedDocumentKeys = new Set<string>();

  if (contribuinteId) {
    const previousScheduling = await db.agendamento.findFirst({
      where: {
        contribuinteId,
        id: { not: agendamentoId },
      },
      orderBy: [{ dataAgendamento: 'desc' }, { createdAt: 'desc' }],
      include: {
        checklist: true,
        documentos: true,
      },
    });

    previousScheduling?.checklist.forEach((item: any) => {
      if (item.status === 'recebido' || item.status === 'nao_aplica') {
        copiedStatusByKey.set(item.chave, item.status);
      }
    });

    previousScheduling?.documentos.forEach((doc: any) => {
      if (doc.checklistItemKey) {
        copiedDocumentKeys.add(doc.checklistItemKey);
      }
    });
  }

  const currentDocuments = await db.documentoAgendamento.findMany({
    where: { agendamentoId },
  });

  await db.checklistAgendamento.createMany({
    data: DEFAULT_IR_CHECKLIST.map((item, index) => {
      const hasMatchingDocument = currentDocuments.some(
        (doc: any) =>
          doc.checklistItemKey === item.chave ||
          documentMatchesChecklist(doc.nomeArquivo, item.chave)
      );

      return {
        agendamentoId,
        chave: item.chave,
        nome: item.nome,
        status:
          copiedStatusByKey.get(item.chave) ??
          (copiedDocumentKeys.has(item.chave) || hasMatchingDocument
            ? 'recebido'
            : 'pendente'),
        ordem: index,
      };
    }),
  });

  return db.checklistAgendamento.findMany({
    where: { agendamentoId },
    orderBy: { ordem: 'asc' },
  });
}

export async function copyContributorDocumentsToScheduling(
  db: DbClient,
  agendamentoId: number,
  contribuinteId?: number | null
) {
  if (!contribuinteId) return;

  const existingCount = await db.documentoAgendamento.count({
    where: { agendamentoId },
  });

  if (existingCount > 0) return;

  const previousScheduling = await db.agendamento.findFirst({
    where: {
      contribuinteId,
      id: { not: agendamentoId },
      documentos: { some: {} },
    },
    orderBy: [{ dataAgendamento: 'desc' }, { createdAt: 'desc' }],
    include: {
      documentos: true,
    },
  });

  if (!previousScheduling?.documentos.length) return;

  const checklist = await db.checklistAgendamento.findMany({
    where: { agendamentoId },
  });

  const checklistByKey = new Map(checklist.map((item: any) => [item.chave, item]));

  await db.documentoAgendamento.createMany({
    data: previousScheduling.documentos.map((doc: any) => {
      const checklistItem = doc.checklistItemKey
        ? checklistByKey.get(doc.checklistItemKey)
        : null;

      return {
        agendamentoId,
        checklistItemId: checklistItem?.id ?? null,
        checklistItemKey: doc.checklistItemKey ?? null,
        nomeArquivo: doc.nomeArquivo,
        tipoArquivo: doc.tipoArquivo,
        tamanhoBytes: doc.tamanhoBytes,
        caminhoArquivo: doc.caminhoArquivo,
        urlArquivo: doc.urlArquivo,
      };
    }),
  });
}

export async function initializeSchedulingArtifacts(
  db: DbClient,
  agendamento: { id: number; contribuinteId?: number | null; titulo: string },
  usuarioId: number | null
) {
  await ensureSchedulingChecklist(db, agendamento.id, agendamento.contribuinteId);
  await copyContributorDocumentsToScheduling(db, agendamento.id, agendamento.contribuinteId);
  await recordSchedulingHistory(
    db,
    usuarioId,
    agendamento.id,
    'agendamento_criado',
    `Agendamento criado: ${agendamento.titulo}`
  );
}

export function validateUploadFile(file: File) {
  const extension = path.extname(file.name).toLowerCase();

  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension)) {
    return 'Tipo de arquivo nao permitido. Envie PDF, JPG, PNG ou XML.';
  }

  if (
    file.type &&
    !ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type) &&
    extension !== '.xml'
  ) {
    return 'Tipo de arquivo nao permitido. Envie PDF, JPG, PNG ou XML.';
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    return 'Cada arquivo deve ter no maximo 10MB.';
  }

  return null;
}

function sanitizeFileName(fileName: string) {
  const parsed = path.parse(fileName);
  const base = normalizeForMatch(parsed.name)
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `${base || 'documento'}${parsed.ext.toLowerCase()}`;
}

export async function storeUploadedFile(agendamentoId: number, file: File) {
  const safeName = sanitizeFileName(file.name);
  const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`;
  const directory = path.join(UPLOADS_DIR, String(agendamentoId));
  const absolutePath = path.join(directory, storedName);
  const publicUrl = `/uploads/agendamentos/${agendamentoId}/${storedName}`;

  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    absolutePath,
    publicUrl,
  };
}

export async function removeStoredFile(filePath: string | null | undefined) {
  if (!filePath) return;

  const resolved = path.resolve(filePath);
  const root = path.resolve(UPLOADS_DIR);

  if (!resolved.startsWith(root)) return;

  try {
    await unlink(resolved);
  } catch {
    // Metadata should still be removable if the file was already missing.
  }
}

export function getDefaultLinkExpiration(days = 7) {
  const normalizedDays = Number.isFinite(days) && days > 0 ? Math.min(days, 60) : 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + normalizedDays);
  return expiresAt;
}
