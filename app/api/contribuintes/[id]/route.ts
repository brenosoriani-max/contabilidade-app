import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, isUniqueError, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { mapContribuinte, mapDeclaration } from '@/lib/server/mappers';

function normalizeOptional(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) {
      return fail('Nao autenticado', 401);
    }

    const { id } = await params;
    const contribuinteId = Number.parseInt(id, 10);

    const contribuinte = await prisma.contribuinte.findUnique({
      where: { id: contribuinteId },
      include: {
        declaracoes: {
          orderBy: { anoExercicio: 'desc' },
          include: {
            rendimentosTributaveis: true,
            rendimentosIsentos: true,
            deducoes: true,
            bensDireitos: true,
            dividasOnus: true,
            dependentes: true,
          },
        },
      },
    });

    if (!contribuinte) {
      return fail('Contribuinte nao encontrado', 404);
    }

    const declaracoes = contribuinte.declaracoes.map((declaracao: any) =>
      mapDeclaration({ ...declaracao, contribuinte })
    );

    return ok({
      contribuinte: mapContribuinte(contribuinte),
      declaracoes,
      rendimentos: contribuinte.declaracoes[0]?.rendimentosTributaveis ?? [],
      bens: contribuinte.declaracoes[0]?.bensDireitos ?? [],
      deducoes: contribuinte.declaracoes[0]?.deducoes ?? [],
      dependentes: contribuinte.declaracoes[0]?.dependentes ?? [],
    });
  } catch (error) {
    console.error('Erro ao buscar contribuinte:', error);
    return fail('Erro interno do servidor', 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) {
      return fail('Nao autenticado', 401);
    }

    const { id } = await params;
    const body = await request.json();
    const {
      nome,
      data_nascimento,
      dataNascimento,
      titulo_eleitor,
      tituloEleitor,
      endereco_cep,
      enderecoCep,
      endereco_uf,
      enderecoUf,
      endereco_municipio,
      enderecoMunicipio,
      endereco_bairro,
      enderecoBairro,
      endereco_logradouro,
      enderecoLogradouro,
      endereco_numero,
      enderecoNumero,
      endereco_complemento,
      enderecoComplemento,
      telefone,
      email,
      ocupacao_principal,
      ocupacaoPrincipal,
      natureza_ocupacao,
      naturezaOcupacao,
    } = body;

    if (!nome) {
      return fail('Nome e obrigatorio', 400);
    }

    const contribuinte = await prisma.contribuinte.update({
      where: { id: Number.parseInt(id, 10) },
      data: {
        nome,
        dataNascimento: parseDate(dataNascimento || data_nascimento),
        tituloEleitor: normalizeOptional(tituloEleitor || titulo_eleitor),
        enderecoCep: normalizeOptional(enderecoCep || endereco_cep),
        enderecoUf: normalizeOptional(enderecoUf || endereco_uf),
        enderecoMunicipio: normalizeOptional(
          enderecoMunicipio || endereco_municipio
        ),
        enderecoBairro: normalizeOptional(enderecoBairro || endereco_bairro),
        enderecoLogradouro: normalizeOptional(
          enderecoLogradouro || endereco_logradouro
        ),
        enderecoNumero: normalizeOptional(enderecoNumero || endereco_numero),
        enderecoComplemento: normalizeOptional(
          enderecoComplemento || endereco_complemento
        ),
        telefone: normalizeOptional(telefone),
        email: normalizeOptional(email),
        ocupacaoPrincipal: normalizeOptional(
          ocupacaoPrincipal || ocupacao_principal
        ),
        naturezaOcupacao: normalizeOptional(
          naturezaOcupacao || natureza_ocupacao
        ),
      },
      include: { declaracoes: true },
    });

    return ok({
      message: 'Contribuinte atualizado com sucesso',
      contribuinte: mapContribuinte(contribuinte),
    });
  } catch (error) {
    console.error('Erro ao atualizar contribuinte:', error);
    if (isUniqueError(error)) {
      return fail('CPF ja cadastrado', 400);
    }
    return fail('Erro interno do servidor', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) {
      return fail('Nao autenticado', 401);
    }

    const { id } = await params;
    const contribuinteId = Number.parseInt(id, 10);
    if (Number.isNaN(contribuinteId)) {
      return fail('ID invalido', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const agendamentos = await tx.agendamento.deleteMany({
        where: { contribuinteId },
      });

      await tx.contribuinte.delete({
        where: { id: contribuinteId },
      });

      return agendamentos;
    });

    return ok({
      message: 'Contribuinte excluido com sucesso',
      agendamentosExcluidos: result.count,
    });
  } catch (error) {
    console.error('Erro ao excluir contribuinte:', error);
    return fail('Erro interno do servidor', 500);
  }
}
