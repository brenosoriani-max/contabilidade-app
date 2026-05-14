import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { createAuthToken, setAuthCookie, toSafeUser } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return fail('Email e senha sao obrigatorios', 400);
    }

    // findUnique é mais rápido que findFirst (email é unique)
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true, nome: true, email: true, senha: true,
        role: true, avatar: true, telefone: true,
        cargo: true, ativo: true, createdAt: true, updatedAt: true,
      },
    });

    
    const senhaValida = await bcrypt.compare(
      password,
      usuario?.senha ?? '$2b$10$invalido.hash.para.timing.seguro.xxxxxxxxxxxxxxxxxx'
    );

    if (!usuario || !usuario.ativo || !senhaValida) {
      return fail('Credenciais invalidas', 401);
    }

    const token = await createAuthToken(usuario);
    const response = ok({ user: toSafeUser(usuario) });
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error('Erro no login:', error);
    return fail('Erro interno do servidor', 500);
  }
}