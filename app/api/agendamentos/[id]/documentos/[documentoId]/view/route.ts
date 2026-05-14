import { createReadStream } from 'fs';
import path from 'path';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import type { SchedulingDocument } from '@/types';

function getMimeType(document: Pick<SchedulingDocument, 'tipo' | 'nome'>) {
  const tipo = document.tipo || '';
  if (tipo) return tipo;

  const ext = (document.nome.split('.').pop() || '').toLowerCase();

  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'xml':
      return 'application/xml';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; documentoId: string }> }
) {
  try {
    const auth = await requireAuth(request as any);
    if (!auth) return fail('Nao autenticado', 401);

    const { id, documentoId } = await params;
    const agendamentoId = Number.parseInt(id, 10);
    const documentId = Number.parseInt(documentoId, 10);

    if (!Number.isFinite(agendamentoId) || agendamentoId <= 0) {
      return fail('Agendamento invalido', 400);
    }
    if (!Number.isFinite(documentId) || documentId <= 0) {
      return fail('Documento invalido', 400);
    }

    const document = await prisma.documentoAgendamento.findFirst({
      where: { id: documentId, agendamentoId },
      select: {
        id: true,
        nomeArquivo: true,
        tipoArquivo: true,
        caminhoArquivo: true,
      },
    });

    if (!document) {
      return fail('Documento nao encontrado', 404);
    }

    const filePath = document.caminhoArquivo;
    if (!filePath) return fail('Arquivo nao encontrado', 404);


    // Segurança: evita path traversal caso algum registro fique incorreto.
    const resolved = path.resolve(filePath);

    // O upload sempre salva em /public/uploads/agendamentos/... (ver scheduling-details)
    const uploadsRoot = path.resolve(
      process.cwd(),
      'public',
      'uploads',
      'agendamentos'
    );

    if (!resolved.startsWith(uploadsRoot)) {
      return fail('Arquivo invalido', 400);
    }

    const fileStream = createReadStream(resolved);
    const mime = getMimeType({ tipo: document.tipoArquivo ?? '', nome: document.nomeArquivo });

    const fileName = document.nomeArquivo || `documento-${document.id}`;

    return new Response(fileStream as any, {
      headers: {
        'Content-Type': mime,
        // Importante: inline para o navegador tentar visualizar.
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('Erro ao visualizar documento:', error);
    return fail('Erro interno do servidor', 500);
  }
}

