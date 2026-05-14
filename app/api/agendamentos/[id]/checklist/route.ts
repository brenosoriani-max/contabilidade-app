import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import {
  ensureSchedulingChecklist,
  recordSchedulingHistory,
} from '@/lib/server/scheduling-details';
import { mapScheduling } from '@/lib/server/mappers';
import type { SchedulingChecklistStatus } from '@/types';

const VALID_STATUSES = new Set<SchedulingChecklistStatus>([
  'pendente',
  'recebido',
  'nao_aplica',
]);

function normalizeKey(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, 80);
  }

  return `custom-${randomUUID().slice(0, 8)}`;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const { id } = await params;
    const agendamentoId = Number.parseInt(id, 10);
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return fail('Informe ao menos um item de checklist', 400);
    }

    const agendamento = await prisma.$transaction(async (tx) => {
      const scheduling = await tx.agendamento.findUnique({
        where: { id: agendamentoId },
      });

      if (!scheduling) {
        throw new Error('AGENDAMENTO_NOT_FOUND');
      }

      await ensureSchedulingChecklist(tx, agendamentoId, scheduling.contribuinteId);

      const keptIds: number[] = [];

      for (const [index, item] of items.entries()) {
        const status = VALID_STATUSES.has(item.status)
          ? item.status
          : 'pendente';
        const nome =
          typeof item.nome === 'string' && item.nome.trim()
            ? item.nome.trim().slice(0, 255)
            : 'Documento';

        if (item.id && Number(item.id) > 0) {
          const updated = await tx.checklistAgendamento.update({
            where: { id: Number(item.id) },
            data: {
              nome,
              status,
              ordem: index,
            },
          });
          keptIds.push(updated.id);
        } else {
          const created = await tx.checklistAgendamento.create({
            data: {
              agendamentoId,
              chave: normalizeKey(item.chave),
              nome,
              status,
              ordem: index,
            },
          });
          keptIds.push(created.id);
        }
      }

      await tx.checklistAgendamento.deleteMany({
        where: {
          agendamentoId,
          id: { notIn: keptIds },
        },
      });

      await recordSchedulingHistory(
        tx,
        auth.user.id,
        agendamentoId,
        'checklist_atualizado',
        'Checklist de documentos atualizado'
      );

      return tx.agendamento.findUniqueOrThrow({
        where: { id: agendamentoId },
        include: {
          contribuinte: true,
          usuario: true,
          checklist: true,
          documentos: true,
          envioLink: true,
        },
      });
    });

    return ok({
      message: 'Checklist atualizado com sucesso',
      agendamento: mapScheduling(agendamento),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'AGENDAMENTO_NOT_FOUND') {
      return fail('Agendamento nao encontrado', 404);
    }

    console.error('Erro ao atualizar checklist:', error);
    return fail('Erro interno do servidor', 500);
  }
}
