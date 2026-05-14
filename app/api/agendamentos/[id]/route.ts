import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import {
  ensureSchedulingChecklist,
  recordSchedulingHistory,
} from '@/lib/server/scheduling-details';
import { mapScheduling } from '@/lib/server/mappers';

function dateAtUtc(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function timeAtUtc(value: string) {
  return new Date(`1970-01-01T${value || '00:00'}:00.000Z`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const { id } = await params;
    const agendamentoId = Number.parseInt(id, 10);

    const agendamento = await prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      include: {
        contribuinte: true,
        usuario: true,
        checklist: true,
        documentos: true,
        envioLink: true,
      },
    });

    if (!agendamento) return fail('Agendamento nao encontrado', 404);

    await ensureSchedulingChecklist(
      prisma,
      agendamento.id,
      agendamento.contribuinteId
    );

    const [freshAgendamento, history] = await Promise.all([
      prisma.agendamento.findUniqueOrThrow({
        where: { id: agendamentoId },
        include: {
          contribuinte: true,
          usuario: true,
          checklist: true,
          documentos: true,
          envioLink: true,
        },
      }),
      prisma.logAtividade.findMany({
        where: {
          entidade: 'agendamento',
          entidadeId: agendamentoId,
        },
        include: { usuario: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return ok({ agendamento: mapScheduling({ ...freshAgendamento, history }) });
  } catch (error) {
    console.error('Erro ao buscar agendamento:', error);
    return fail('Erro interno do servidor', 500);
  }
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

    const agendamento = await prisma.$transaction(async (tx) => {
      await tx.agendamento.update({
        where: { id: agendamentoId },
        data: {
          contribuinteId:
            body.contribuinteId === undefined
              ? undefined
              : body.contribuinteId
                ? Number(body.contribuinteId)
                : null,
          titulo: body.titulo,
          descricao: body.descricao === undefined ? undefined : body.descricao || null,
          dataAgendamento: body.dataAgendamento
            ? dateAtUtc(body.dataAgendamento)
            : undefined,
          horaInicio: body.horaInicio ? timeAtUtc(body.horaInicio) : undefined,
          horaFim: body.horaFim ? timeAtUtc(body.horaFim) : undefined,
          tipo: body.tipo,
          status: body.status,
          observacoes:
            body.observacoes === undefined ? undefined : body.observacoes || null,
        },
      });

      const updated = await tx.agendamento.findUniqueOrThrow({
        where: { id: agendamentoId },
        include: {
          contribuinte: true,
          usuario: true,
          checklist: true,
          documentos: true,
          envioLink: true,
        },
      });

      await ensureSchedulingChecklist(tx, updated.id, updated.contribuinteId);
      await recordSchedulingHistory(
        tx,
        auth.user.id,
        updated.id,
        'agendamento_atualizado',
        body.status ? `Status atual: ${body.status}` : 'Dados do agendamento atualizados'
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
      message: 'Agendamento atualizado com sucesso',
      agendamento: mapScheduling(agendamento),
    });
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    return fail('Erro interno do servidor', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const { id } = await params;
    const agendamentoId = Number.parseInt(id, 10);

    await prisma.$transaction(async (tx) => {
      await recordSchedulingHistory(
        tx,
        auth.user.id,
        agendamentoId,
        'agendamento_excluido',
        'Agendamento excluido'
      );

      await tx.agendamento.delete({ where: { id: agendamentoId } });
    });

    return ok({ message: 'Agendamento excluido com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir agendamento:', error);
    return fail('Erro interno do servidor', 500);
  }
}
