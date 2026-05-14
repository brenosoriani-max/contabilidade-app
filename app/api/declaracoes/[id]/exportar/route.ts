import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { getModeloPath } from '@/lib/server/irpf-model-utils';
import { validarExportacaoLocal } from '@/lib/server/irpf-declaracao-local';
import { loadModeloForDeclaracao } from '@/lib/server/declaracao-modelo';
import { packDEC } from '@/lib/server/dec-pack';

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

    const body = (await request.json().catch(() => ({}))) as {
      anoExercicio?: number;
      tipo?: string;
      json?: boolean;
      /** "dec" (pacote PGD) ou "xml" (arquivo XML bruto gravado na declaracao) */
      formato?: 'dec' | 'xml';
    };

    const decl = await prisma.declaracao.findUnique({
      where: { id: declaracaoId },
      include: {
        contribuinte: true,
        _count: {
          select: { rendimentosTributaveis: true },
        },
      },
    });

    if (!decl?.contribuinte) {
      return fail('Declaracao nao encontrada', 404);
    }

    const { modelo } = await loadModeloForDeclaracao(declaracaoId);

    const validacao = validarExportacaoLocal(modelo, {
      qtdRendTributaveis: decl._count.rendimentosTributaveis,
    });

    if (!validacao.apto) {
      return NextResponse.json(
        {
          success: false,
          error: 'Declaracao nao apta a exportacao',
          data: {
            erros: validacao.erros_impeditivos,
            avisos: validacao.avisos,
          },
        },
        { status: 422 }
      );
    }

    const xmlConteudo = decl.xmlOriginal?.trim();
    if (!xmlConteudo) {
      return fail(
        'Nao ha XML original gravado nesta declaracao. Importe o XML (importacao em massa ou reimporte na tela IRPF).',
        422
      );
    }

    const anoExercicio =
      typeof body.anoExercicio === 'number' && Number.isFinite(body.anoExercicio)
        ? body.anoExercicio
        : decl.anoExercicio;

    const tipo = typeof body.tipo === 'string' && body.tipo ? body.tipo : 'O';
    const formato = body.formato === 'xml' ? 'xml' : 'dec';

    const cpfRaw =
      getModeloPath(modelo, 'identificacao.cpf') ?? decl.contribuinte.cpf;
    const cpf = String(cpfRaw ?? '')
      .replace(/\D/g, '')
      .slice(0, 11);
    const cpfPart = cpf.length === 11 ? cpf : 'SEM_CPF';
    const nomeBase = `${cpfPart}IRPF${anoExercicio}${tipo}`;

    if (body.json) {
      return ok({
        sucesso: true,
        nomeArquivo:
          formato === 'xml' ? `${nomeBase}.xml` : `${nomeBase}.DEC`,
        avisos: validacao.avisos,
        formato,
      });
    }

    if (formato === 'xml') {
      return new NextResponse(xmlConteudo, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${nomeBase}.xml"`,
        },
      });
    }

    const buffer = await packDEC(xmlConteudo, 'declaracao.xml');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${nomeBase}.DEC"`,
      },
    });
  } catch (e) {
    console.error('exportar declaracao:', e);
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return fail(msg, 500);
  }
}
