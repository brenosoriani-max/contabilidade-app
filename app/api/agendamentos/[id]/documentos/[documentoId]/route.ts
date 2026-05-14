import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import {
  recordSchedulingHistory,
  removeStoredFile,
} from '@/lib/server/scheduling-details';
import { mapScheduling } from '@/lib/server/mappers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentoId: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const { id, documentoId } = await params;
    const agendamentoId = Number.parseInt(id, 10);
    const documentId = Number.parseInt(documentoId, 10);

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
        auth.user.id,
        agendamentoId,
        'documento_excluido',
        document.nomeArquivo
      );
    });

    const updated = await prisma.agendamento.findUniqueOrThrow({
      where: { id: agendamentoId },
      include: {
        contribuinte: true,
        usuario: true,
        checklist: true,
        documentos: true,
        envioLink: true,
      },
    });

    return ok({
      message: 'Documento excluido com sucesso',
      agendamento: mapScheduling(updated),
    });
  } catch (error) {
    console.error('Erro ao excluir documento:', error);
    return fail('Erro interno do servidor', 500);
  }
}
