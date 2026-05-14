import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import {
  ensureSchedulingChecklist,
  recordSchedulingHistory,
  removeStoredFile,
} from '@/lib/server/scheduling-details';
import {
  mapSchedulingChecklistItem,
  mapSchedulingDocument,
} from '@/lib/server/mappers';
import type { SchedulingChecklistItem } from '@/types';

function isExpired(date: Date) {
  return date.getTime() < Date.now();
}

async function getPublicScheduling(token: string) {
  const link = await prisma.linkEnvioAgendamento.findUnique({
    where: { token },
    include: {
      agendamento: {
        include: {
          contribuinte: true,
          checklist: true,
          documentos: true,
        },
      },
    },
  });

  if (!link) return null;
  if (isExpired(link.expiresAt)) return { expired: true as const, link };

  await ensureSchedulingChecklist(
    prisma,
    link.agendamento.id,
    link.agendamento.contribuinteId
  );

  const freshLink = await prisma.linkEnvioAgendamento.findUniqueOrThrow({
    where: { token },
    include: {
      agendamento: {
        include: {
          contribuinte: true,
          checklist: true,
          documentos: true,
        },
      },
    },
  });

  return { expired: false as const, link: freshLink };
}

function mapPublicPayload(link: any) {
  const agendamento = link.agendamento;

  return {
    token: link.token,
    expiresAt: link.expiresAt.toISOString(),
    agendamento: {
      id: agendamento.id,
      titulo: agendamento.titulo,
      nome: agendamento.contribuinte?.nome ?? agendamento.titulo,
      dataAgendamento: agendamento.dataAgendamento.toISOString().slice(0, 10),
      checklist: agendamento.checklist
        .map(mapSchedulingChecklistItem)
        .sort(
          (a: SchedulingChecklistItem, b: SchedulingChecklistItem) =>
            a.ordem - b.ordem
        ),
      documents: agendamento.documentos.map(mapSchedulingDocument),
    },
  };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; documentoId: string }> }
) {
  try {
    const { token, documentoId } = await params;
    const result = await getPublicScheduling(token);

    if (!result) return fail('Link nao encontrado', 404);
    if (result.expired) return fail('Link expirado', 410);

    const agendamentoId = result.link.agendamento.id;
    const documentId = Number(documentoId);

    if (!Number.isFinite(documentId) || documentId <= 0) {
      return fail('Documento invalido', 400);
    }

    const document = await prisma.documentoAgendamento.findFirst({
      where: {
        id: documentId,
        agendamentoId,
      },
    });

    if (!document) {
      return fail('Documento nao encontrado', 404);
    }

    await removeStoredFile(document.caminhoArquivo);

    await prisma.$transaction(async (tx) => {
      await tx.documentoAgendamento.delete({
        where: { id: document.id },
      });

      if (document.checklistItemId) {
        const remaining = await tx.documentoAgendamento.count({
          where: { checklistItemId: document.checklistItemId },
        });

        if (remaining === 0) {
          await tx.checklistAgendamento.update({
            where: { id: document.checklistItemId },
            data: { status: 'pendente' },
          });
        }
      }

      await recordSchedulingHistory(
        tx,
        null,
        agendamentoId,
        'documento_excluido_cliente',
        document.nomeArquivo
      );
    });

    const refreshed = await getPublicScheduling(token);
    if (!refreshed || refreshed.expired) {
      return fail('Link expirado', 410);
    }

    return ok({
      message: 'Documento excluido com sucesso',
      ...mapPublicPayload(refreshed.link),
    });
  } catch (error) {
    console.error('Erro ao excluir documento do cliente:', error);
    return fail('Erro interno do servidor', 500);
  }
}
