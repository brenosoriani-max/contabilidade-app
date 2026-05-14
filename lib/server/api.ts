import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json<ApiResponse<never>>(
    { success: false, error: message },
    { status }
  );
}

export function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isUniqueError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

export function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    return Number((value as { toString: () => string }).toString()) || 0;
  }
  return 0;
}
