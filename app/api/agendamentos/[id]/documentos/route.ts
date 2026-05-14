import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import {
  ensureSchedulingChecklist,
  recordSchedulingHistory,
  storeUploadedFile,
  validateUploadFile,
} from '@/lib/server/scheduling-details';
import { mapScheduling } from '@/lib/server/mappers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const { id } = await params;
    const agendamentoId = Number.parseInt(id, 10);
    const formData = await request.formData();
    const files = formData.getAll('files').filter((file): file is File => file instanceof File);
    const checklistItemIdValue = formData.get('checklistItemId');
    const checklistItemId =
      typeof checklistItemIdValue === 'string' && checklistItemIdValue
        ? Number(checklistItemIdValue)
        : null;

    if (!files.length) {
      return fail('Nenhum arquivo enviado', 400);
    }

    for (const file of files) {
      const validationError = validateUploadFile(file);
      if (validationError) return fail(validationError, 400);
    }

    const scheduling = await prisma.agendamento.findUnique({
      where: { id: agendamentoId },
    });

    if (!scheduling) {
      return fail('Agendamento nao encontrado', 404);
    }

    await ensureSchedulingChecklist(prisma, agendamentoId, scheduling.contribuinteId);

    const checklistItem = checklistItemId
      ? await prisma.checklistAgendamento.findFirst({
          where: {
            id: checklistItemId,
            agendamentoId,
          },
        })
      : null;

    if (checklistItemId && !checklistItem) {
      return fail('Item de checklist nao encontrado', 404);
    }

    for (const file of files) {
      const stored = await storeUploadedFile(agendamentoId, file);

      await prisma.$transaction(async (tx) => {
        await tx.documentoAgendamento.create({
          data: {
            agendamentoId,
            checklistItemId: checklistItem?.id ?? null,
            checklistItemKey: checklistItem?.chave ?? null,
            nomeArquivo: file.name,
            tipoArquivo: file.type || null,
            tamanhoBytes: file.size,
            caminhoArquivo: stored.absolutePath,
            urlArquivo: stored.publicUrl,
          },
        });

        if (checklistItem) {
          await tx.checklistAgendamento.update({
            where: { id: checklistItem.id },
            data: { status: 'recebido' },
          });
        }
      });
    }

    await recordSchedulingHistory(
      prisma,
      auth.user.id,
      agendamentoId,
      'documentos_enviados',
      `${files.length} arquivo(s) anexado(s)`
    );

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
      message: 'Documento(s) enviado(s) com sucesso',
      agendamento: mapScheduling(updated),
    });
  } catch (error) {
    console.error('Erro ao enviar documentos:', error);
    return fail('Erro interno do servidor', 500);
  }
}
