import { randomUUID } from 'crypto';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

const BASE = path.join(process.cwd(), 'public', 'uploads', 'declaracoes');

function sanitizeFileName(fileName: string) {
  const parsed = path.parse(fileName);
  const base = parsed.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'documento'}${parsed.ext.toLowerCase()}`;
}

export async function storeDeclaracaoFile(declaracaoId: number, file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return storeDeclaracaoBuffer(declaracaoId, file.name, buffer);
}

export async function storeDeclaracaoBuffer(
  declaracaoId: number,
  originalName: string,
  buffer: Buffer
) {
  const safeName = sanitizeFileName(originalName);
  const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`;
  const directory = path.join(BASE, String(declaracaoId));
  const absolutePath = path.join(directory, storedName);
  const publicUrl = `/uploads/declaracoes/${declaracaoId}/${storedName}`;

  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, buffer);

  return { absolutePath, publicUrl };
}
