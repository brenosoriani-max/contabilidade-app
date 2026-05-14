"use client"

import Link from "next/link"
import {
  ArrowRight,
  Calendar,
  FileDown,
  ListChecks,
  Upload,
  Users,
} from "lucide-react"

import { AppHeader } from "@/components/app-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const steps = [
  {
    title: "Importar XML",
    description:
      "Importe o XML do cliente para popular contribuinte, declaração e modelo canônico.",
    href: "/importar",
    icon: Upload,
  },
  {
    title: "Agendar envio de documentos",
    description:
      "Use a agenda para solicitar comprovantes e informes ao cliente.",
    href: "/agendamentos",
    icon: Calendar,
  },
  {
    title: "Conferir e completar cadastro",
    description:
      "Abra o contribuinte: reimporte XML na declaração, anexe documentos, edite campos e gere o checklist.",
    href: "/contribuintes",
    icon: Users,
  },
  {
    title: "Exportar para o IRPF",
    description:
      "Na ficha da declaração, exporte .DEC ou XML para o aplicativo da Receita.",
    href: "/contribuintes",
    icon: FileDown,
  },
]

export default function IrpfHubPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title="Imposto de renda"
        description="Fluxo: importação → documentos → conferência → exportação (.DEC ou XML)."
      />

      <div className="flex-1 space-y-8 p-4 md:p-6">
        <Card className="border-primary/20 bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-5 w-5" />
              Resumo do processo
            </CardTitle>
            <CardDescription>
              O assistente na ficha do contribuinte (e no agendamento) usa
              apenas lógica local: sem API externa de modelo de linguagem.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((s) => (
            <Card key={s.title} className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div className="rounded-lg border bg-background p-2">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" asChild>
                  <Link href={s.href}>
                    Ir
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
