import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/server/api';
import { requireAuth, toSafeUser } from '@/lib/server/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    if (!auth) {
      return fail('Nao autenticado', 401);
    }

    return ok({ user: toSafeUser(auth.user) });
  } catch (error) {
    console.error('Erro ao verificar autenticacao:', error);
    return fail('Token invalido', 401);
  }
}
