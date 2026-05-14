import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fail, ok } from '@/lib/server/api'
import { requireAuth } from '@/lib/server/auth'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  try {
    const auth = await requireAuth(request)
    if (!auth) return fail('Nao autenticado', 401)

    const alertaId = Number(id)
    if (!Number.isFinite(alertaId) || alertaId <= 0)
      return fail('Alerta invalido', 400)

    const alerta = await prisma.alerta.updateMany({
      where: {
        id: alertaId,
        resolvido: false,
      },
      data: {
        lido: true,
      },
    })

    if (alerta.count === 0) {
      // Pode ter sido resolvido ou nao existir
      return ok({ message: 'Alerta nao atualizado' })
    }

    return ok({ message: 'Alerta marcado como lido' })
  } catch (error) {
    console.error('Erro ao marcar alerta como lido:', error)
    return fail('Erro interno do servidor', 500)
  }
}

