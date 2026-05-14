import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { fail, isUniqueError, ok } from '@/lib/server/api';
import { requireAdmin, toSafeUser } from '@/lib/server/auth';
import type { UserRole } from '@/types';

const roles: UserRole[] = ['admin', 'contador', 'assistente'];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) {
      return fail('Acesso negado', 403);
    }

    const usuarios = await prisma.usuario.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return ok({ usuarios: usuarios.map(toSafeUser) });
  } catch (error) {
    console.error('Erro ao listar usuarios:', error);
    return fail('Erro interno do servidor', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) {
      return fail('Acesso negado', 403);
    }

    const body = await request.json();
    const { nome, name, email, senha, password, role, telefone, cargo } = body;
    const userName = nome || name;
    const plainPassword = senha || password;

    if (!userName || !email || !plainPassword) {
      return fail('Nome, email e senha sao obrigatorios', 400);
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const userRole = roles.includes(role) ? role : 'contador';

    const usuario = await prisma.usuario.create({
      data: {
        nome: userName,
        email,
        senha: hashedPassword,
        role: userRole,
        telefone: telefone || null,
        cargo: cargo || null,
      },
    });

    return ok({
      message: 'Usuario criado com sucesso',
      usuario: toSafeUser(usuario),
    });
  } catch (error) {
    console.error('Erro ao criar usuario:', error);
    if (isUniqueError(error)) {
      return fail('Email ja cadastrado', 400);
    }
    return fail('Erro interno do servidor', 500);
  }
}
