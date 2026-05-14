import { fail, ok } from '@/lib/server/api';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return fail('Setup manual desabilitado em producao', 403);
  }

  return ok({
    message:
      'Use npx prisma migrate deploy e npm run db:seed para configurar o banco.',
  });
}
