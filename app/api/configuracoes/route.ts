import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export async function GET() {
  const configuracoes = await prisma.configuracaoSistema.findFirst({
    orderBy: { updatedAt: "desc" },
  })


  return NextResponse.json({
    configuracoes,
  })
}

export async function PUT(request: Request) {
  const body = await request.json()

 
  const existing = await prisma.configuracaoSistema.findFirst({
    orderBy: { updatedAt: "desc" },
  })

  if (!existing) {
    const created = await prisma.configuracaoSistema.create({
      data: {
        nomeEmpresa: body.nomeEmpresa ?? null,
        cnpjEmpresa: body.cnpjEmpresa ?? null,
        emailSuporte: body.emailSuporte ?? null,
        corTema: body.corTema ?? null,
      },
    })

    return NextResponse.json({ configuracoes: created })
  }

  const updated = await prisma.configuracaoSistema.update({
    where: { id: existing.id },
    data: {
      nomeEmpresa: body.nomeEmpresa ?? null,
      cnpjEmpresa: body.cnpjEmpresa ?? null,
      emailSuporte: body.emailSuporte ?? null,
      corTema: body.corTema ?? null,
    },
  })

  return NextResponse.json({ configuracoes: updated })
}

