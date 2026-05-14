import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { mergeDocumentoArquivado } from '@/lib/server/irpf-declaracao-local';
import {
  loadModeloForDeclaracao,
  persistModeloEnvelope,
} from '@/lib/server/declaracao-modelo';
import { storeDeclaracaoBuffer } from '@/lib/server/declaracao-uploads';
import {
  ensureSchedulingChecklist,
  storeUploadedFile,
  validateUploadFile,
} from '@/lib/server/scheduling-details';
import type { DadosJsonEnvelopeV2 } from '@/lib/server/dados-json-declaracao';

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
    const file = formData.get('arquivo');
    const tagVal = formData.get('tag');
    const tag = typeof tagVal === 'string' ? tagVal.trim() : '';
    const agendamentoRaw = formData.get('agendamentoId');
    const agendamentoId =
      typeof agendamentoRaw === 'string' && agendamentoRaw
        ? Number.parseInt(agendamentoRaw, 10)
        : null;
    const origemRaw = formData.get('origem');
    const origem =
      origemRaw === 'cliente_link' ? 'cliente_link' : 'contador';

    if (!(file instanceof File) || !file.size) {
      return fail('Envie o arquivo no campo "arquivo"', 400);
    }
    if (!tag) {
      return fail('Informe a tag do documento (campo "tag")', 400);
    }

    const validationError = validateUploadFile(file);
    if (validationError) {
      return fail(validationError, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mediaType = file.type || 'application/octet-stream';

    if (
      !mediaType.startsWith('image/') &&
      mediaType !== 'application/pdf'
    ) {
      return fail(
        'Formato nao suportado. Envie imagem (JPEG/PNG) ou PDF.',
        400
      );
    }

    const { envelope, modelo } = await loadModeloForDeclaracao(declaracaoId);

    let storedUrl: string | null = null;
    if (agendamentoId && Number.isFinite(agendamentoId)) {
      const ag = await prisma.agendamento.findUnique({
        where: { id: agendamentoId },
      });
      if (!ag) {
        return fail('Agendamento nao encontrado', 404);
      }
      await ensureSchedulingChecklist(prisma, agendamentoId, ag.contribuinteId);
      const fileCopy = new File([new Uint8Array(buffer)], `[${tag}] ${file.name}`, {
        type: mediaType,
      });
      const stored = await storeUploadedFile(agendamentoId, fileCopy);
      storedUrl = stored.publicUrl;
      await prisma.documentoAgendamento.create({
        data: {
          agendamentoId,
          nomeArquivo: fileCopy.name,
          tipoArquivo: mediaType,
          tamanhoBytes: buffer.length,
          caminhoArquivo: stored.absolutePath,
          urlArquivo: stored.publicUrl,
        },
      });
    }

    await storeDeclaracaoBuffer(declaracaoId, `[${tag}] ${file.name}`, buffer);

    const prevDocs = envelope._meta?.documentos_arquivados ?? [];
    const novoDoc = {
      tag,
      nome_arquivo: file.name,
      tamanho_bytes: buffer.length,
      media_type: mediaType,
      url: storedUrl,
      origem,
      recebido_em: new Date().toISOString(),
    };

    const nextEnvelope: DadosJsonEnvelopeV2 = {
      ...envelope,
      _meta: {
        ...envelope._meta,
        documentos_arquivados: [...prevDocs, novoDoc],
      },
    };

    const { resumo } = mergeDocumentoArquivado(modelo, {
      tag,
      nomeArquivo: file.name,
      tamanhoBytes: buffer.length,
      mediaType,
      url: storedUrl,
      origem,
    });

    await persistModeloEnvelope(declaracaoId, modelo, nextEnvelope);

    return ok({ sucesso: true, resumo, modelo });
  } catch (e) {
    console.error('documento declaracao:', e);
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return fail(msg, 500);
  }
}
