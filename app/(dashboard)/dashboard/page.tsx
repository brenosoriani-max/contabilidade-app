"use client"

import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import useSWR from "swr"

import { AppHeader } from "@/components/app-header"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

import {
  Users,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wallet,
  Building2,
  PiggyBank,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CalendarDays,
} from "lucide-react"

import { dashboardService } from "@/lib/api/services"

import {
  formatCurrency,
  formatPercent,
} from "@/lib/format"

const DashboardCharts = dynamic(
  () =>
    import("@/components/dashboard-charts").then(
      (mod) => mod.DashboardCharts
    ),
  {
    ssr: false,

    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[420px] rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    ),
  }
)

const StatCard = React.memo(
  ({
    title,
    value,
    description,
    icon: Icon,
    trend,
    trendValue,
    variant = "default",
  }: {
    title: string
    value: string
    description: string
    icon: React.ComponentType<{
      className?: string
    }>
    trend?: "up" | "down"
    trendValue?: string
    variant?:
      | "default"
      | "success"
      | "danger"
      | "warning"
      | "primary"
  }) => {
    const variants = {
      default: {
        iconBg: "bg-muted",
        iconColor:
          "text-muted-foreground",
        valueColor: "text-foreground",
      },

      success: {
        iconBg:
          "bg-emerald-500/10",
        iconColor:
          "text-emerald-600",
        valueColor:
          "text-emerald-600",
      },

      danger: {
        iconBg: "bg-red-500/10",
        iconColor: "text-red-600",
        valueColor: "text-red-600",
      },

      warning: {
        iconBg:
          "bg-amber-500/10",
        iconColor:
          "text-amber-600",
        valueColor:
          "text-amber-600",
      },

      primary: {
        iconBg: "bg-primary/10",
        iconColor: "text-primary",
        valueColor: "text-primary",
      },
    }

    const v = variants[variant]

    return (
      <Card className="overflow-hidden border-0 shadow-sm transition-all hover:shadow-md">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>

              <p
                className={`text-3xl font-bold tracking-tight ${v.valueColor}`}
              >
                {value}
              </p>

              <div className="flex items-center gap-2">
                {trend && (
                  <span
                    className={`flex items-center text-xs font-medium ${
                      trend === "up"
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {trend === "up" ? (
                      <ArrowUpRight className="mr-0.5 h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="mr-0.5 h-3 w-3" />
                    )}

                    {trendValue}
                  </span>
                )}

                <p className="text-xs text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>

            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${v.iconBg}`}
            >
              <Icon
                className={`h-6 w-6 ${v.iconColor}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
)

export default function DashboardPage() {
  const {
    data: metrics,
    error,
    isLoading,
  } = useSWR(
    "dashboard",
    () => dashboardService.get(),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 10000,
      keepPreviousData: true,
    }
  )

  const currentDate = useMemo(
    () => new Date(),
    []
  )

  const prazoIRPF = useMemo(() => {
    return new Date(
      currentDate.getFullYear(),
      3,
      30
    )
  }, [currentDate])

  const diasRestantes = useMemo(() => {
    return Math.ceil(
      (prazoIRPF.getTime() -
        currentDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  }, [prazoIRPF, currentDate])

  const totalRendimentos =
    useMemo(() => {
      if (!metrics) return 0

      return (
        metrics.totalRendimentosPJ +
        metrics.totalRendimentosIsentos +
        metrics.totalTributacaoExclusiva
      )
    }, [metrics])

  const percRendPJ = useMemo(() => {
    if (!metrics || totalRendimentos <= 0)
      return 0

    return (
      (metrics.totalRendimentosPJ /
        totalRendimentos) *
      100
    )
  }, [metrics, totalRendimentos])

  const percRendIsentos = useMemo(() => {
    if (!metrics || totalRendimentos <= 0)
      return 0

    return (
      (metrics.totalRendimentosIsentos /
        totalRendimentos) *
      100
    )
  }, [metrics, totalRendimentos])

  const percTribExclusiva =
    useMemo(() => {
      if (
        !metrics ||
        totalRendimentos <= 0
      )
        return 0

      return (
        (metrics.totalTributacaoExclusiva /
          totalRendimentos) *
        100
      )
    }, [metrics, totalRendimentos])

  if (isLoading && !metrics) {
    return (
      <>
        <AppHeader
          title="Dashboard"
          description="Carregando indicadores..."
        />

        <main className="flex-1 space-y-6 overflow-auto p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({
              length: 4,
            }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-32 rounded-xl"
              />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({
              length: 3,
            }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-52 rounded-xl"
              />
            ))}
          </div>

          <Skeleton className="h-[450px] rounded-xl" />
        </main>
      </>
    )
  }

  if (error || !metrics) {
    return (
      <>
        <AppHeader
          title="Dashboard"
          description="Visão geral das declarações IRPF"
        />

        <main className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Não foi possível carregar
              o dashboard.
            </CardContent>
          </Card>
        </main>
      </>
    )
  }

  return (
    <>
      <AppHeader
        title="Dashboard"
        description={`Exercício ${metrics.exercicioAtual} • Visão geral das declarações IRPF`}
      />

      <main className="flex-1 space-y-6 overflow-auto p-6">
        {/* TOP STATS */}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Contribuintes"
            value={metrics.totalContribuintes.toString()}
            description={`${metrics.totalDeclaracoes} declarações`}
            icon={Users}
            variant="primary"
          />

          <StatCard
            title="Total a Restituir"
            value={formatCurrency(
              metrics.totalRestituir
            )}
            description={`${metrics.declaracoesRestituir} declarações`}
            icon={TrendingUp}
            variant="success"
            trend="up"
            trendValue="+12.5%"
          />

          <StatCard
            title="Total a Pagar"
            value={formatCurrency(
              metrics.totalPagar
            )}
            description={`${metrics.declaracoesPagar} declarações`}
            icon={TrendingDown}
            variant="danger"
          />

          <StatCard
            title="Imposto Devido"
            value={formatCurrency(
              metrics.totalImpostoDevido
            )}
            description={`IRRF: ${formatCurrency(metrics.totalIRRF)}`}
            icon={Calculator}
            variant="warning"
          />
        </div>

        {/* ALERTA PRAZO */}

        {diasRestantes > 0 &&
          diasRestantes <= 60 && (
            <Card className="border-amber-200 bg-amber-50/60">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>

                  <div className="flex-1">
                    <p className="font-semibold text-amber-900">
                      Prazo de Entrega
                      IRPF{" "}
                      {currentDate.getFullYear()}
                    </p>

                    <p className="text-sm text-amber-700">
                      Restam{" "}
                      <span className="font-bold">
                        {
                          diasRestantes
                        }{" "}
                        dias
                      </span>{" "}
                      para o fim do
                      prazo.
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-100 text-amber-800"
                  >
                    <CalendarDays className="mr-1 h-3 w-3" />
                    30/04/
                    {currentDate.getFullYear()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

        {/* RENDIMENTOS */}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>

                <div>
                  <CardTitle className="text-base">
                    Rendimentos PJ
                  </CardTitle>

                  <CardDescription>
                    Pessoa Jurídica
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="text-2xl font-bold">
                {formatCurrency(
                  metrics.totalRendimentosPJ
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Participação
                  </span>

                  <span className="font-medium">
                    {formatPercent(
                      percRendPJ
                    )}
                  </span>
                </div>

                <Progress
                  value={percRendPJ}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <PiggyBank className="h-5 w-5 text-emerald-600" />
                </div>

                <div>
                  <CardTitle className="text-base">
                    Rendimentos
                    Isentos
                  </CardTitle>

                  <CardDescription>
                    Não tributáveis
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="text-2xl font-bold">
                {formatCurrency(
                  metrics.totalRendimentosIsentos
                )}
              </div>

              <Progress
                value={percRendIsentos}
                className="h-2 [&>div]:bg-emerald-500"
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>

                <div>
                  <CardTitle className="text-base">
                    Tributação
                    Exclusiva
                  </CardTitle>

                  <CardDescription>
                    Retido na fonte
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="text-2xl font-bold">
                {formatCurrency(
                  metrics.totalTributacaoExclusiva
                )}
              </div>

              <Progress
                value={percTribExclusiva}
                className="h-2 [&>div]:bg-amber-500"
              />
            </CardContent>
          </Card>
        </div>

        {/* PATRIMÔNIO + RESULTADOS */}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>

                <div>
                  <CardTitle>
                    Patrimônio Total
                  </CardTitle>

                  <CardDescription>
                    Soma dos bens e
                    direitos
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  Valor Atual
                </span>

                <span className="text-3xl font-bold">
                  {formatCurrency(
                    metrics.totalPatrimonio
                  )}
                </span>
              </div>

              <div className="rounded-xl bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  {metrics.variacaoPatrimonial >=
                  0 ? (
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}

                  <div>
                    <p
                      className={`font-semibold ${
                        metrics.variacaoPatrimonial >=
                        0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {metrics.variacaoPatrimonial >=
                      0
                        ? "+"
                        : ""}
                      {formatCurrency(
                        metrics.variacaoPatrimonial
                      )}
                    </p>

                    <p className="text-sm text-muted-foreground">
                      Variação
                      patrimonial
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RESULTADOS */}

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>

                <div>
                  <CardTitle>
                    Resultado das
                    Declarações
                  </CardTitle>

                  <CardDescription>
                    Distribuição fiscal
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />

                  <div>
                    <p className="font-semibold text-emerald-900">
                      A Restituir
                    </p>

                    <p className="text-sm text-emerald-700">
                      {formatCurrency(
                        metrics.totalRestituir
                      )}
                    </p>
                  </div>
                </div>

                <Badge className="bg-emerald-600 hover:bg-emerald-700">
                  {
                    metrics.declaracoesRestituir
                  }
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-600" />

                  <div>
                    <p className="font-semibold text-red-900">
                      A Pagar
                    </p>

                    <p className="text-sm text-red-700">
                      {formatCurrency(
                        metrics.totalPagar
                      )}
                    </p>
                  </div>
                </div>

                <Badge variant="destructive">
                  {
                    metrics.declaracoesPagar
                  }
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    0
                  </div>

                  <div>
                    <p className="font-semibold">
                      Sem Imposto
                    </p>

                    <p className="text-sm text-muted-foreground">
                      Resultado zerado
                    </p>
                  </div>
                </div>

                <Badge variant="secondary">
                  {
                    metrics.declaracoesZero
                  }
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CHARTS */}

        <DashboardCharts
          metrics={metrics}
        />

        {/* ALERTAS */}

        {metrics.alertas.length >
          0 && (
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>

                <div>
                  <CardTitle>
                    Alertas e
                    Pendências
                  </CardTitle>

                  <CardDescription>
                    Itens que requerem
                    atenção
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {metrics.alertas.map(
                (alert) => (
                  <div
                    key={alert.id}
                    className="rounded-xl border bg-muted/30 p-4"
                  >
                    <p className="font-medium">
                      {alert.title}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {alert.message}
                    </p>

                    {alert.cpf && (
                      <Badge
                        variant="outline"
                        className="mt-3 font-mono text-xs"
                      >
                        CPF:{" "}
                        {alert.cpf}
                      </Badge>
                    )}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  )
}