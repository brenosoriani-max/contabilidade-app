import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { prisma } from '@/lib/prisma';
import type { SafeUser, UserRole } from '@/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'analir_2026_super_secure_jwt_key_x9k2m'
);

export interface AuthPayload extends JWTPayload {
  id: number;
  email: string;
  role: UserRole;
}

export function toSafeUser(usuario: {
  id: number;
  nome: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  telefone: string | null;
  cargo: string | null;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeUser {
  return {
    id: usuario.id,
    nome: usuario.nome,
    name: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    avatar: usuario.avatar,
    telefone: usuario.telefone,
    cargo: usuario.cargo,
    ativo: usuario.ativo,
    createdAt: usuario.createdAt.toISOString(),
    updatedAt: usuario.updatedAt.toISOString(),
  };
}

export async function createAuthToken(user: {
  id: number;
  email: string;
  role: UserRole;
}) {
  return new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export async function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (
      typeof payload.id !== 'number' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null;
    }

    return payload as AuthPayload;
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest) {
  const auth = await getAuthPayload(request);
  if (!auth) return null;

  const usuario = await prisma.usuario.findFirst({
    where: { id: auth.id, ativo: true },
  });

  if (!usuario) return null;

  return {
    payload: auth,
    user: usuario,
  };
}

export async function requireAdmin(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth || auth.user.role !== 'admin') return null;
  return auth;
}
