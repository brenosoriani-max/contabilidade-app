import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { getModeloPath } from '@/lib/server/irpf-model-utils';
import { mergeModeloBackIntoXml, validarExportacaoLocal } from '@/lib/server/irpf-declaracao-local';
import { loadModeloForDeclaracao } from '@/lib/server/declaracao-modelo';
import { packDEC } from '@/lib/server/dec-pack';
import { generatePositionalIRPF } from '@/lib/server/irpf-positional-engine';

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
      /** "dec" (pacote PGD), "xml" (bruto), ou "posicional" (layout Receita) */
      formato?: 'dec' | 'xml' | 'posicional';
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
          error: 'Declaração não apta a exportação',
          data: {
            erros: validacao.erros_impeditivos,
            avisos: validacao.avisos,
          },
        },
        { status: 422 }
      );
    }

    const anoExercicio =
      typeof body.anoExercicio === 'number' && Number.isFinite(body.anoExercicio)
        ? body.anoExercicio
        : decl.anoExercicio;

    const tipo = typeof body.tipo === 'string' && body.tipo ? body.tipo : 'O';
    const formato = body.formato || 'dec';

    const cpfRaw =
      getModeloPath(modelo, 'identificacao.cpf') ?? decl.contribuinte.cpf;
    const cpf = String(cpfRaw ?? '')
      .replace(/\D/g, '')
      .slice(0, 11);
    const cpfPart = cpf.length === 11 ? cpf : 'SEM_CPF';
    const anoAnterior = anoExercicio - 1;
    const tipoSuffix = tipo === 'O' ? 'ORIGI' : tipo === 'R' ? 'RETIF' : tipo;
    const nomeBase = `${cpfPart}-IRPF-A-${anoExercicio}-${anoAnterior}-${tipoSuffix}`;

    if (body.json) {
      return ok({
        sucesso: true,
        nomeArquivo:
          formato === 'xml' ? `${nomeBase}.xml` : `${nomeBase}.DEC`,
        avisos: validacao.avisos,
        formato,
      });
    }

    if (formato === 'posicional') {
      const posicionalConteudo = generatePositionalIRPF(modelo);
      const bufferLatin1 = Buffer.from(posicionalConteudo, 'latin1');
      return new NextResponse(bufferLatin1, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=iso-8859-1',
          'Content-Disposition': `attachment; filename="${nomeBase}.DEC"`,
        },
      });
    }

    let xmlConteudo = decl.xmlOriginal?.trim();
    if (!xmlConteudo) {
      return fail(
        'Não há XML original gravado nesta declaração. Para gerar arquivos .XML ou pacote .DEC, é necessário ter importado um XML anteriormente. Use a opção "Importação DIRP (.DEC)" que funciona apenas com os dados do sistema.',
        422
      );
    }

    // SYNC: Apply changes from Modelo (Database) back into the XML string
    xmlConteudo = mergeModeloBackIntoXml(xmlConteudo, modelo);

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
