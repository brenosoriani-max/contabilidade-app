import { NextRequest } from 'next/server';

import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { applyFieldEdit } from '@/lib/server/irpf-model-utils';
import { validarCampoLocal } from '@/lib/server/irpf-declaracao-local';
import {
  loadModeloForDeclaracao,
  persistModeloEnvelope,
} from '@/lib/server/declaracao-modelo';
import { prisma } from '@/lib/prisma';

const MODELO_PATH_TO_DB: Record<string, string> = {
  'identificacao.nome_completo': 'nome',
  'identificacao.cpf': 'cpf',
  'identificacao.data_nascimento': 'dataNascimento',
  'identificacao.titulo_eleitor': 'tituloEleitor',
  'identificacao.ocupacao_principal': 'ocupacaoPrincipal',
  'identificacao.natureza_ocupacao': 'naturezaOcupacao',
  'endereco.cep': 'enderecoCep',
  'endereco.uf': 'enderecoUf',
  'endereco.codigo_municipio_ibge': 'enderecoMunicipio',
  'endereco.bairro': 'enderecoBairro',
  'endereco.logradouro': 'enderecoLogradouro',
  'endereco.numero': 'enderecoNumero',
  'endereco.complemento': 'enderecoComplemento',
  'contato.email': 'email',
  'contato.celular': 'telefone',
};

export async function PUT(
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

    const body = (await request.json()) as {
      campo?: string;
      valor?: string;
      editadoPor?: string;
    };

    const campo = typeof body.campo === 'string' ? body.campo.trim() : '';
    const valor = body.valor == null ? '' : String(body.valor);
    if (!campo) {
      return fail('Campo "campo" e obrigatorio', 400);
    }

    const validacao = await validarCampoLocal(campo, valor);
    if (!validacao.valido) {
      return fail(validacao.erro?.motivo || 'Valor invalido', 400);
    }

    const { envelope, modelo } = await loadModeloForDeclaracao(declaracaoId);
    const fonte =
      typeof body.editadoPor === 'string' && body.editadoPor
        ? body.editadoPor
        : 'manual_contador';

    const modeloAtualizado = applyFieldEdit(
      modelo,
      campo,
      validacao.valor_normalizado,
      fonte
    );

    await persistModeloEnvelope(declaracaoId, modeloAtualizado, envelope);

    // SYNC: Update main Contribuinte record if the field is a core database field
    const dbColumn = MODELO_PATH_TO_DB[campo];
    if (dbColumn) {
      const decl = await prisma.declaracao.findUnique({
        where: { id: declaracaoId },
        select: { contribuinteId: true }
      });
      if (decl) {
        let dbValue: any = validacao.valor_normalizado;
        if (dbColumn === 'dataNascimento' && dbValue) {
           const [d, m, y] = dbValue.split('/');
           const parsed = new Date(`${y}-${m}-${d}`);
           if (!isNaN(parsed.getTime())) dbValue = parsed;
        }
        
        await prisma.contribuinte.update({
          where: { id: decl.contribuinteId },
          data: { [dbColumn]: dbValue }
        });
      }
    }

    return ok({
      sucesso: true,
      valorNormalizado: validacao.valor_normalizado,
    });
  } catch (e) {
    console.error('campo declaracao:', e);
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return fail(msg, 500);
  }
}
