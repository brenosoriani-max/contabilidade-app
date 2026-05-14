"use client"

import React, {
  ReactNode,
  useMemo,
  useState,
} from "react"

import {
  Badge,
} from "@/components/ui/badge"

import {
  Button,
} from "@/components/ui/button"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  Separator,
} from "@/components/ui/separator"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import {
  User,
  MapPin,
  Briefcase,
  Building2,
  Calculator,
  Landmark,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import type {
  BemDireito,
  ContribuinteSummary,
  Declaration,
} from "@/types"

import {
  formatCurrency,
  formatCPF,
  formatCEP,
  formatDate,
  formatPercent,
  getResultColor,
  getResultLabel,
} from "@/lib/format"

interface Props {
  declaration: Declaration | null
  contribuinte: ContribuinteSummary | null
  assets?: BemDireito[]
}

const ITEMS_PER_PAGE = 5

const StatCard = React.memo(
  function StatCard({
    title,
    value,
    icon,
  }: {
    title: string
    value: string
    icon?: ReactNode
  }) {
    return (
      <div className="rounded-3xl border bg-background p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {title}
          </p>

          {icon}
        </div>

        <p className="mt-4 text-2xl font-bold tracking-tight">
          {value}
        </p>
      </div>
    )
  }
)

const Field = React.memo(
  function Field({
    label,
    value,
  }: {
    label: string
    value?: string | ReactNode | null
  }) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {label}
        </p>

        <p className="font-medium break-words">
          {value || "-"}
        </p>
      </div>
    )
  }
)

export const ContribuinteDetails =
  React.memo(function ContribuinteDetails({
    declaration,
    contribuinte,
    assets = [],
  }: Props) {
    const [currentPage, setCurrentPage] =
      useState(1)

    if (!contribuinte) {
      return null
    }

    const totalPages = Math.ceil(
      assets.length / ITEMS_PER_PAGE
    )

    const paginatedAssets =
      useMemo(() => {
        const start =
          (currentPage - 1) *
          ITEMS_PER_PAGE

        const end =
          start + ITEMS_PER_PAGE

        return assets.slice(
          start,
          end
        )
      }, [assets, currentPage])

    const statusLabel = useMemo(
      () =>
        getResultLabel(
          declaration?.resultadoDeclaracao ||
            null
        ),
      [
        declaration?.resultadoDeclaracao,
      ]
    )

    const statusClasses = useMemo(
      () =>
        getResultColor(
          declaration?.resultadoDeclaracao ||
            null
        ),
      [
        declaration?.resultadoDeclaracao,
      ]
    )

    const variation = useMemo(
      () =>
        (declaration?.totalBensAtual ||
          0) -
        (declaration?.totalBensAnterior ||
          0),
      [
        declaration?.totalBensAtual,
        declaration?.totalBensAnterior,
      ]
    )

    const variationPercent =
      useMemo(() => {
        const base =
          declaration?.totalBensAnterior ||
          1

        return (
          (variation / base) * 100
        )
      }, [
        variation,
        declaration?.totalBensAnterior,
      ])

    const variationColor =
      variation >= 0
        ? "text-emerald-600"
        : "text-red-600"

    const variationIcon =
      variation >= 0 ? (
        <TrendingUp className="h-5 w-5 text-emerald-600" />
      ) : (
        <TrendingDown className="h-5 w-5 text-red-600" />
      )

    return (
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border bg-background p-6 shadow-sm">
            <div className="space-y-3">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  {contribuinte.nome}
                </h2>

                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  {formatCPF(
                    contribuinte.cpf
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {declaration && (
                  <>
                    <Badge
                      className={`${statusClasses} rounded-full px-4 py-1`}
                    >
                      {statusLabel}
                    </Badge>

                    <Badge variant="outline">
                      Exercício{" "}
                      {
                        declaration.exercicio
                      }
                    </Badge>

                    <Badge variant="secondary">
                      {declaration.tipoDeclaracao ||
                        "Não informado"}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-background p-6 shadow-sm">
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted-foreground">
                  Situação
                </p>

                <p className="font-semibold">
                  {declaration?.resultadoDeclaracao ||
                    "-"}
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground">
                  Data de Nascimento
                </p>

                <p className="font-medium">
                  {formatDate(
                    contribuinte.dataNascimento
                  ) || "Não informado"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Data Cadastro
                </p>

                <p className="font-medium">
                  {formatDate(
                    contribuinte.createdAt
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {declaration && (
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Rendimentos PJ"
              value={formatCurrency(
                declaration.totalRendPJ
              )}
              icon={
                <Building2 className="h-5 w-5 text-muted-foreground" />
              }
            />

            <StatCard
              title="IRRF"
              value={formatCurrency(
                declaration.totalIRRF
              )}
              icon={
                <Landmark className="h-5 w-5 text-muted-foreground" />
              }
            />

            <StatCard
              title="Base de Cálculo"
              value={formatCurrency(
                declaration.baseCalculo
              )}
              icon={
                <Calculator className="h-5 w-5 text-muted-foreground" />
              }
            />
          </div>
        )}

        <Tabs
          defaultValue="dados"
          className="w-full"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 md:grid-cols-5">
            <TabsTrigger value="dados">
              Dados
            </TabsTrigger>

            <TabsTrigger value="patrimonio">
              Patrimônio
            </TabsTrigger>

            <TabsTrigger value="bens">
              Bens
            </TabsTrigger>

            <TabsTrigger value="calculo">
              Cálculo
            </TabsTrigger>

            <TabsTrigger value="contato">
              Contato
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="dados"
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Identificação
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Nome"
                  value={
                    contribuinte.nome
                  }
                />

                <Field
                  label="CPF"
                  value={
                    <span className="font-mono">
                      {formatCPF(
                        contribuinte.cpf
                      )}
                    </span>
                  }
                />

                <Field
                  label="Nascimento"
                  value={formatDate(
                    contribuinte.dataNascimento
                  )}
                />

                <Field
                  label="Título de Eleitor"
                  value={
                    contribuinte.tituloEleitor
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Logradouro"
                  value={
                    contribuinte.enderecoLogradouro
                  }
                />

                <Field
                  label="Número"
                  value={
                    contribuinte.enderecoNumero
                  }
                />

                <Field
                  label="Complemento"
                  value={
                    contribuinte.enderecoComplemento
                  }
                />

                <Field
                  label="Bairro"
                  value={
                    contribuinte.enderecoBairro
                  }
                />

                <Field
                  label="Cidade"
                  value={
                    contribuinte.enderecoMunicipio
                  }
                />

                <Field
                  label="UF"
                  value={
                    contribuinte.enderecoUf
                  }
                />

                <Field
                  label="CEP"
                  value={formatCEP(
                    contribuinte.enderecoCep
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Ocupação
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Ocupação Principal"
                  value={
                    contribuinte.ocupacaoPrincipal
                  }
                />

                <Field
                  label="Natureza"
                  value={
                    contribuinte.naturezaOcupacao
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="patrimonio"
            className="space-y-4"
          >
            {declaration ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    title="Ano Anterior"
                    value={formatCurrency(
                      declaration.totalBensAnterior
                    )}
                  />

                  <StatCard
                    title="Ano Atual"
                    value={formatCurrency(
                      declaration.totalBensAtual
                    )}
                  />

                  <StatCard
                    title="Qtd. de Bens"
                    value={String(
                      declaration.qtdBens
                    )}
                  />
                </div>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Variação Patrimonial
                        </p>

                        <p
                          className={`mt-2 text-3xl font-bold ${variationColor}`}
                        >
                          {variation >= 0
                            ? "+"
                            : ""}
                          {formatCurrency(
                            variation
                          )}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {formatPercent(
                            variationPercent
                          )}
                        </p>
                      </div>

                      {variationIcon}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhuma declaração encontrada.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent
            value="bens"
            className="space-y-4"
          >
            {assets.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhum bem encontrado.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4">
                  {paginatedAssets.map(
                    (asset) => (
                      <Card
                        key={asset.id}
                      >
                        <CardContent className="space-y-4 p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <h4 className="font-semibold leading-relaxed">
                                {asset.descricao ||
                                  "Sem descrição"}
                              </h4>

                              <p className="text-sm text-muted-foreground">
                                Código:{" "}
                                {asset.codigo ||
                                  "-"}
                              </p>
                            </div>

                            <Badge variant="outline">
                              Grupo{" "}
                              {asset.grupo ||
                                "-"}
                            </Badge>
                          </div>

                          <Separator />

                          <div className="grid gap-4 md:grid-cols-2">
                            <Field
                              label="Valor Anterior"
                              value={formatCurrency(
                                asset.valorAnterior
                              )}
                            />

                            <Field
                              label="Valor Atual"
                              value={formatCurrency(
                                asset.valorAtual
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )
                  )}
                </div>

                <Card>
                  <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-muted-foreground">
                      Exibindo{" "}
                      <span className="font-medium text-foreground">
                        {(currentPage - 1) *
                          ITEMS_PER_PAGE +
                          1}
                      </span>{" "}
                      até{" "}
                      <span className="font-medium text-foreground">
                        {Math.min(
                          currentPage *
                            ITEMS_PER_PAGE,
                          assets.length
                        )}
                      </span>{" "}
                      de{" "}
                      <span className="font-medium text-foreground">
                        {assets.length}
                      </span>{" "}
                      bens
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          currentPage ===
                          1
                        }
                        onClick={() =>
                          setCurrentPage(
                            (
                              prev
                            ) =>
                              prev - 1
                          )
                        }
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <div className="flex items-center gap-1">
                        {Array.from({
                          length:
                            totalPages,
                        }).map(
                          (
                            _,
                            index
                          ) => {
                            const page =
                              index + 1

                            const isActive =
                              page ===
                              currentPage

                            return (
                              <Button
                                key={
                                  page
                                }
                                size="sm"
                                variant={
                                  isActive
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  setCurrentPage(
                                    page
                                  )
                                }
                              >
                                {page}
                              </Button>
                            )
                          }
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          currentPage ===
                          totalPages
                        }
                        onClick={() =>
                          setCurrentPage(
                            (
                              prev
                            ) =>
                              prev + 1
                          )
                        }
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent
            value="calculo"
            className="space-y-4"
          >
            {!declaration ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhum cálculo disponível.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="space-y-6 p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Base de Cálculo"
                      value={formatCurrency(
                        declaration.baseCalculo
                      )}
                    />

                    <Field
                      label="Alíquota Efetiva"
                      value={formatPercent(
                        declaration.aliquotaEfetiva
                      )}
                    />

                    <Field
                      label="Imposto Devido"
                      value={formatCurrency(
                        declaration.impostoDevido
                      )}
                    />

                    <Field
                      label="Imposto Pago"
                      value={formatCurrency(
                        declaration.totalImpostoPago
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent
            value="contato"
            className="space-y-4"
          >
            <Card>
              <CardContent className="grid gap-5 p-6 md:grid-cols-2">
                <Field
                  label="Telefone"
                  value={
                    contribuinte.telefone
                  }
                />

                <Field
                  label="E-mail"
                  value={
                    contribuinte.email
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  })