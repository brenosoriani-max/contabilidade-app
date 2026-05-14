import { ok } from '@/lib/server/api';
import { clearAuthCookie } from '@/lib/server/auth';

export async function POST() {
  const response = ok({ success: true });
  clearAuthCookie(response);
  return response;
}
