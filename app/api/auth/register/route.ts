import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { fail, isUniqueError, ok } from '@/lib/server/api';
import { requireAdmin, toSafeUser } from '@/lib/server/auth';
import type { UserRole } from '@/types';

const roles: UserRole[] = ['admin', 'contador', 'assistente'];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) {
      return fail('Acesso negado', 403);
    }

    const { nome, email, password, senha, role, telefone, cargo } =
      await request.json();
    const plainPassword = password || senha;

    if (!nome || !email || !plainPassword) {
      return fail('Nome, email e senha sao obrigatorios', 400);
    }

    const senhaHash = await bcrypt.hash(plainPassword, 10);
    const userRole = roles.includes(role) ? role : 'assistente';

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        role: userRole,
        telefone: telefone || null,
        cargo: cargo || null,
        ativo: true,
      },
    });

    return ok({
      message: 'Usuario registrado com sucesso',
      user: toSafeUser(usuario),
    });
  } catch (error) {
    console.error('Erro no registro:', error);

    if (isUniqueError(error)) {
      return fail('Ja existe um usuario com este email', 409);
    }

    return fail('Erro interno do servidor', 500);
  }
}
