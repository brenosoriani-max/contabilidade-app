import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { initializeSchedulingArtifacts } from '@/lib/server/scheduling-details';
import { mapScheduling } from '@/lib/server/mappers';

function dateAtUtc(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function timeAtUtc(value: string) {
  return new Date(`1970-01-01T${value || '00:00'}:00.000Z`);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const agendamentos = await prisma.agendamento.findMany({
      where: status && status !== 'all' ? { status: status as any } : {},
      include: {
        contribuinte: true,
        usuario: true,
        checklist: true,
        documentos: true,
        envioLink: true,
      },
      orderBy: [{ dataAgendamento: 'asc' }, { horaInicio: 'asc' }],
    });

    return ok({ agendamentos: agendamentos.map(mapScheduling) });
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    return fail('Erro interno do servidor', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const body = await request.json();
    const {
      contribuinteId,
      titulo,
      descricao,
      dataAgendamento,
      horaInicio,
      horaFim,
      tipo,
      status,
      observacoes,
    } = body;

    if (!titulo || !dataAgendamento) {
      return fail('Titulo e data sao obrigatorios', 400);
    }

    const agendamento = await prisma.$transaction(async (tx) => {
      const created = await tx.agendamento.create({
        data: {
          contribuinteId: contribuinteId ? Number(contribuinteId) : null,
          usuarioId: auth.user.id,
          titulo,
          descricao: descricao || null,
          dataAgendamento: dateAtUtc(dataAgendamento),
          horaInicio: horaInicio ? timeAtUtc(horaInicio) : null,
          horaFim: horaFim ? timeAtUtc(horaFim) : null,
          tipo: tipo || 'declaracao',
          status: status || 'agendado',
          observacoes: observacoes || null,
        },
      });

      await initializeSchedulingArtifacts(tx, created, auth.user.id);

      return tx.agendamento.findUniqueOrThrow({
        where: { id: created.id },
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
      message: 'Agendamento criado com sucesso',
      agendamento: mapScheduling(agendamento),
    });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    return fail('Erro interno do servidor', 500);
  }
}
