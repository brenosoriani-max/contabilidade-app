import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { xmlTextoParaModeloCanonico } from '@/lib/server/irpf-declaracao-local';
import {
  loadModeloForDeclaracao,
  persistModeloEnvelope,
} from '@/lib/server/declaracao-modelo';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Nao autenticado', 401);

    const { id } = await params;
    const declaracaoId = Number.parseInt(id, 10);
    if (!Number.isFinite(declaracaoId)) {
      return fail('ID invalido', 400);
    }

    const formData = await request.formData();
    const file = formData.get('xml');
    if (!(file instanceof File) || !file.size) {
      return fail('Envie o arquivo XML no campo "xml"', 400);
    }

    const anoRaw = formData.get('anoExercicio');
    const anoExercicio =
      typeof anoRaw === 'string' && anoRaw
        ? Number.parseInt(anoRaw, 10)
        : NaN;

    const xmlTexto = await file.text();

    const { envelope } = await loadModeloForDeclaracao(declaracaoId);
    const modeloNovo = await xmlTextoParaModeloCanonico(
      xmlTexto,
      Number.isFinite(anoExercicio) ? anoExercicio : new Date().getFullYear()
    );

    await persistModeloEnvelope(declaracaoId, modeloNovo, envelope);

    await prisma.declaracao.update({
      where: { id: declaracaoId },
      data: { xmlOriginal: xmlTexto },
    });

    return ok({ sucesso: true, declaracaoId });
  } catch (e) {
    console.error('importar-xml:', e);
    const msg = e instanceof Error ? e.message : 'Erro ao processar XML';
    return fail(msg, 500);
  }
}
