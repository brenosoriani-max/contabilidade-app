import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  fail,
  isUniqueError,
  ok,
  parsePositiveInt,
} from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { mapContribuinte } from '@/lib/server/mappers';

function normalizeOptional(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth) {
      return fail('Nao autenticado', 401);
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const limit = parsePositiveInt(searchParams.get('limit'), 10);
    const search = searchParams.get('search') || '';
    const uf = searchParams.get('uf') || '';
    const exercicio = searchParams.get('exercicio') || '';
    const resultado = searchParams.get('resultado') || '';
    const offset = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { nome: { contains: search } },
        { cpf: { contains: search } },
      ];
    }

    if (uf) {
      where.enderecoUf = uf;
    }

    if (exercicio) {
      where.declaracoes = {
        some: { anoExercicio: Number.parseInt(exercicio, 10) },
      };
    }

    if (resultado === 'restituir' || resultado === 'RESTITUIR') {
      where.declaracoes = {
        ...(where.declaracoes ?? {}),
        some: {
          ...(where.declaracoes?.some ?? {}),
          impostoRestituir: { gt: 0 },
        },
      };
    }

    if (resultado === 'pagar' || resultado === 'PAGAR') {
      where.declaracoes = {
        ...(where.declaracoes ?? {}),
        some: {
          ...(where.declaracoes?.some ?? {}),
          impostoPagar: { gt: 0 },
        },
      };
    }

    const [contribuintes, total] = await prisma.$transaction([
      prisma.contribuinte.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: offset,
        take: limit,
        include: {
          declaracoes: {
            orderBy: { anoExercicio: 'desc' },
            take: 1,
            include: {
              rendimentosTributaveis: true,
              bensDireitos: true,
              dividasOnus: true,
            },
          },
        },
      }),
      prisma.contribuinte.count({ where }),
    ]);

    return ok({
      contribuintes: contribuintes.map(mapContribuinte),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao listar contribuintes:', error);
    return fail('Erro interno do servidor', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth) {
      return fail('Nao autenticado', 401);
    }

    const body = await request.json();
    const {
      cpf,
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

    if (!cpf || !nome) {
      return fail('CPF e nome sao obrigatorios', 400);
    }

    const contribuinte = await prisma.contribuinte.create({
      data: {
        cpf,
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
      message: 'Contribuinte criado com sucesso',
      contribuinte: mapContribuinte(contribuinte),
    });
  } catch (error) {
    console.error('Erro ao criar contribuinte:', error);
    if (isUniqueError(error)) {
      return fail('CPF ja cadastrado', 400);
    }
    return fail('Erro interno do servidor', 500);
  }
}
