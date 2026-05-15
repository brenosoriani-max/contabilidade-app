import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { gerarChecklistLocal } from '@/lib/server/irpf-declaracao-local';
import { loadModeloForDeclaracao } from '@/lib/server/declaracao-modelo';

export async function GET(
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

    const decl = await prisma.declaracao.findUnique({
      where: { id: declaracaoId },
      select: {
        situacao: true,
        xmlOriginal: true,
        _count: {
          select: {
            rendimentosTributaveis: true,
            dependentes: true,
            bensDireitos: true,
          },
        },
      },
    });

    if (!decl) {
      return fail('Declaracao nao encontrada', 404);
    }

    const { modelo, envelope } = await loadModeloForDeclaracao(declaracaoId);
    const docCount = envelope._meta?.documentos_arquivados?.length ?? 0;
    const resultado = gerarChecklistLocal(modelo, {
      qtdDependentes: decl._count.dependentes,
      qtdBens: decl._count.bensDireitos,
      qtdRendTributaveis: decl._count.rendimentosTributaveis,
      qtdDocumentosArquivados: docCount,
      xmlOriginal: !!decl.xmlOriginal,
      situacao: decl.situacao,
    });

    return ok(resultado);
  } catch (e) {
    console.error('checklist declaracao:', e);
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return fail(msg, 500);
  }
}
