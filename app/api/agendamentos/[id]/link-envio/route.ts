import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import {
  getDefaultLinkExpiration,
  recordSchedulingHistory,
} from '@/lib/server/scheduling-details';
import { mapScheduling, mapSchedulingUploadLink } from '@/lib/server/mappers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const { id } = await params;
    const agendamentoId = Number.parseInt(id, 10);
    const body = await request.json().catch(() => ({}));
    const days = Number(body.expiresInDays ?? 7);
    const expiresAt = getDefaultLinkExpiration(days);

    const scheduling = await prisma.agendamento.findUnique({
      where: { id: agendamentoId },
    });

    if (!scheduling) {
      return fail('Agendamento nao encontrado', 404);
    }

    const token = randomUUID();

    const link = await prisma.$transaction(async (tx) => {
      const result = await tx.linkEnvioAgendamento.upsert({
        where: { agendamentoId },
        create: {
          agendamentoId,
          token,
          expiresAt,
        },
        update: {
          token,
          expiresAt,
        },
      });

      await recordSchedulingHistory(
        tx,
        auth.user.id,
        agendamentoId,
        'link_envio_gerado',
        `Link valido ate ${expiresAt.toLocaleDateString('pt-BR')}`
      );

      return result;
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
      message: 'Link de envio gerado com sucesso',
      link: mapSchedulingUploadLink(link),
      agendamento: mapScheduling(updated),
    });
  } catch (error) {
    console.error('Erro ao gerar link de envio:', error);
    return fail('Erro interno do servidor', 500);
  }
}
