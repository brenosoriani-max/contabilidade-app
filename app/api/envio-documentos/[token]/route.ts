import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import {
  ensureSchedulingChecklist,
  recordSchedulingHistory,
  storeUploadedFile,
  validateUploadFile,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await getPublicScheduling(token);

    if (!result) return fail('Link nao encontrado', 404);
    if (result.expired) return fail('Link expirado', 410);

    return ok(mapPublicPayload(result.link));
  } catch (error) {
    console.error('Erro ao buscar link de envio:', error);
    return fail('Erro interno do servidor', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await getPublicScheduling(token);

    if (!result) return fail('Link nao encontrado', 404);
    if (result.expired) return fail('Link expirado', 410);

    const formData = await request.formData();
    const files = formData.getAll('files').filter((file): file is File => file instanceof File);
    const checklistItemIdValue = formData.get('checklistItemId');
    const checklistItemId =
      typeof checklistItemIdValue === 'string' && checklistItemIdValue
        ? Number(checklistItemIdValue)
        : null;

    if (!checklistItemId) {
      return fail('Selecione o documento da checklist', 400);
    }

    if (!files.length) {
      return fail('Nenhum arquivo enviado', 400);
    }

    for (const file of files) {
      const validationError = validateUploadFile(file);
      if (validationError) return fail(validationError, 400);
    }

    const agendamentoId = result.link.agendamento.id;
    const checklistItem = await prisma.checklistAgendamento.findFirst({
      where: {
        id: checklistItemId,
        agendamentoId,
      },
    });

    if (!checklistItem) {
      return fail('Item de checklist nao encontrado', 404);
    }

    if (checklistItem.status === 'nao_aplica') {
      return fail('Este item nao aceita envio de documentos', 400);
    }

    for (const file of files) {
      const stored = await storeUploadedFile(agendamentoId, file);

      await prisma.$transaction(async (tx) => {
        await tx.documentoAgendamento.create({
          data: {
            agendamentoId,
            checklistItemId: checklistItem.id,
            checklistItemKey: checklistItem.chave,
            nomeArquivo: file.name,
            tipoArquivo: file.type || null,
            tamanhoBytes: file.size,
            caminhoArquivo: stored.absolutePath,
            urlArquivo: stored.publicUrl,
          },
        });

        await tx.checklistAgendamento.update({
          where: { id: checklistItem.id },
          data: { status: 'recebido' },
        });
      });
    }

    await recordSchedulingHistory(
      prisma,
      null,
      agendamentoId,
      'documentos_enviados_cliente',
      `${files.length} arquivo(s) enviado(s) pelo cliente`
    );

    const refreshed = await getPublicScheduling(token);
    if (!refreshed || refreshed.expired) {
      return fail('Link expirado', 410);
    }

    return ok({
      message: 'Documento enviado com sucesso',
      ...mapPublicPayload(refreshed.link),
    });
  } catch (error) {
    console.error('Erro ao receber documentos do cliente:', error);
    return fail('Erro interno do servidor', 500);
  }
}


