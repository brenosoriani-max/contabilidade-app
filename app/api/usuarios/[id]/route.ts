import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { fail, isUniqueError, ok } from '@/lib/server/api';
import { requireAuth, toSafeUser } from '@/lib/server/auth';
import type { UserRole } from '@/types';

const roles: UserRole[] = ['admin', 'contador', 'assistente'];

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
    const userId = Number.parseInt(id, 10);

    if (auth.user.id !== userId && auth.user.role !== 'admin') {
      return fail('Acesso negado', 403);
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      return fail('Usuario nao encontrado', 404);
    }

    return ok({ usuario: toSafeUser(usuario) });
  } catch (error) {
    console.error('Erro ao buscar usuario:', error);
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
    const userId = Number.parseInt(id, 10);
    const body = await request.json();
    const { nome, name, email, senha, password, role, telefone, cargo, ativo } =
      body;

    if (auth.user.id !== userId && auth.user.role !== 'admin') {
      return fail('Acesso negado', 403);
    }

    const data: Record<string, unknown> = {
      nome: nome || name,
      email,
      telefone: telefone || null,
      cargo: cargo || null,
    };

    if (!data.nome || !data.email) {
      return fail('Nome e email sao obrigatorios', 400);
    }

    if (auth.user.role === 'admin') {
      data.role = roles.includes(role) ? role : 'contador';
      data.ativo = ativo !== false;
    }

    const plainPassword = senha || password;
    if (plainPassword) {
      data.senha = await bcrypt.hash(plainPassword, 10);
    }

    const usuario = await prisma.usuario.update({
      where: { id: userId },
      data,
    });

    return ok({
      message: 'Usuario atualizado com sucesso',
      usuario: toSafeUser(usuario),
    });
  } catch (error) {
    console.error('Erro ao atualizar usuario:', error);
    if (isUniqueError(error)) {
      return fail('Email ja cadastrado', 400);
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
    if (!auth || auth.user.role !== 'admin') {
      return fail('Acesso negado', 403);
    }

    const { id } = await params;
    const userId = Number.parseInt(id, 10);

    if (auth.user.id === userId) {
      return fail('Voce nao pode excluir a si mesmo', 400);
    }

    await prisma.usuario.delete({ where: { id: userId } });

    return ok({ message: 'Usuario excluido com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuario:', error);
    return fail('Erro interno do servidor', 500);
  }
}
