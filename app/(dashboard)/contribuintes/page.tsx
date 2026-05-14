"use client"

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import { useRouter } from "next/navigation"

import useSWR from "swr"

import { AppHeader } from "@/components/app-header"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Input } from "@/components/ui/input"

import { Button } from "@/components/ui/button"

import { Badge } from "@/components/ui/badge"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Eye,
  Filter,
  MoreVertical,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

import { contribuinteService } from "@/lib/api/services"

import {
  formatCPF,
  formatCurrency,
  getResultColor,
  getResultLabel,
} from "@/lib/format"

import type {
  ContribuinteSummary,
  Declaration,
} from "@/types"

function fallbackDeclaration(
  contribuinte: ContribuinteSummary
): Declaration {
  return {
    id: contribuinte.id,
    contribuinteId: contribuinte.id,
    cpf: contribuinte.cpf,
    nome: contribuinte.nome,
    exercicio: "-",
    anoExercicio: 0,
    dataCriacao: null,
    resultadoDeclaracao: null,
    tipoDeclaracao: null,
    situacao: null,
    dataNascimento: contribuinte.dataNascimento,
    endereco:
      [
        contribuinte.enderecoLogradouro,
        contribuinte.enderecoNumero,
      ]
        .filter(Boolean)
        .join(", ") || null,
    municipio: contribuinte.enderecoMunicipio,
    uf: contribuinte.enderecoUf,
    bairro: contribuinte.enderecoBairro,
    cep: contribuinte.enderecoCep,
    ocupacao: contribuinte.ocupacaoPrincipal,
    naturezaOcupacao:
      contribuinte.naturezaOcupacao,
    totalRendPJ: 0,
    totalIRRF: 0,
    totalPrevOficial: 0,
    totalDecimoTerceiro: 0,
    totalRendIsentos: 0,
    totalTribExclusiva: 0,
    rendAplicacoes: 0,
    ganhosCapital: 0,
    totalBensAnterior: 0,
    totalBensAtual: 0,
    qtdBens: 0,
    totalDividasAnterior: 0,
    totalDividasAtual: 0,
    baseCalculo: 0,
    impostoDevido: 0,
    impostoRestituir: 0,
    saldoPagar: 0,
    aliquotaEfetiva: 0,
    totalImpostoPago: 0,
    createdAt: contribuinte.createdAt,
    updatedAt: contribuinte.updatedAt,
  }
}

export default function ContribuintesPage() {
  const router = useRouter()

  const [searchInput, setSearchInput] =
    useState("")

  const [search, setSearch] = useState("")

  const [resultadoFilter, setResultadoFilter] =
    useState("all")

  const [ufFilter, setUfFilter] =
    useState("all")

  const [deleteConfirm, setDeleteConfirm] =
    useState<Declaration | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
    }, 400)

    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, error, isLoading, mutate } =
    useSWR(
      [
        "contribuintes",
        search,
        resultadoFilter,
        ufFilter,
      ],
      () =>
        contribuinteService.list({
          search,
          resultado:
            resultadoFilter === "all"
              ? undefined
              : resultadoFilter,
          uf:
            ufFilter === "all"
              ? undefined
              : ufFilter,
          page: 1,
          limit: 100,
        }),
      {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        keepPreviousData: true,
      }
    )

  const contribuintes = useMemo(
    () => data?.contribuintes ?? [],
    [data]
  )

  const declarations = useMemo(() => {
    return contribuintes.map(
      (item) =>
        item.ultimaDeclaracao ??
        fallbackDeclaration(item)
    )
  }, [contribuintes])

  const ufs = useMemo(() => {
    return [
      ...new Set(
        contribuintes
          .map((d) => d.enderecoUf)
          .filter(Boolean)
      ),
    ].sort()
  }, [contribuintes])

  const restituirCount = useMemo(() => {
    return declarations.filter(
      (d) =>
        d.resultadoDeclaracao ===
        "RESTITUIR"
    ).length
  }, [declarations])

  const pagarCount = useMemo(() => {
    return declarations.filter(
      (d) =>
        d.resultadoDeclaracao === "PAGAR"
    ).length
  }, [declarations])

  const handleView = useCallback(
    (declaration: Declaration) => {
      router.push(
        `/contribuintes/${declaration.contribuinteId}`
      )
    },
    [router]
  )

  const handleDeleteModal = useCallback(
    (declaration: Declaration) => {
      setDeleteConfirm(declaration)
    },
    []
  )

  const handleDelete = useCallback(
    async (declaration: Declaration) => {
      try {
        await contribuinteService.remove(
          declaration.contribuinteId
        )

        setDeleteConfirm(null)

        await mutate()
      } catch (error) {
        console.error(error)
      }
    },
    [mutate]
  )

  return (
    <>
      <AppHeader
        title="Contribuintes"
        description="Base dinâmica de contribuintes"
      />

      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Total Contribuintes
              </CardTitle>

              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>

            <CardContent>
              <div className="text-2xl font-bold">
                {contribuintes.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                A Restituir
              </CardTitle>

              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>

            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {restituirCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                A Pagar
              </CardTitle>

              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>

            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {pagarCount}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium">
                  Buscar
                </label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    placeholder="Nome ou CPF..."
                    value={searchInput}
                    onChange={(e) =>
                      setSearchInput(
                        e.target.value
                      )
                    }
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="w-full md:w-44">
                <label className="mb-1.5 block text-sm font-medium">
                  Resultado
                </label>

                <Select
                  value={resultadoFilter}
                  onValueChange={
                    setResultadoFilter
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">
                      Todos
                    </SelectItem>

                    <SelectItem value="RESTITUIR">
                      A Restituir
                    </SelectItem>

                    <SelectItem value="PAGAR">
                      A Pagar
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-32">
                <label className="mb-1.5 block text-sm font-medium">
                  UF
                </label>

                <Select
                  value={ufFilter}
                  onValueChange={setUfFilter}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">
                      Todos
                    </SelectItem>

                    {ufs.map((uf) => (
                      <SelectItem
                        key={uf}
                        value={uf!}
                      >
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("")
                  setSearchInput("")
                  setResultadoFilter("all")
                  setUfFilter("all")
                }}
              >
                <X className="mr-1 h-4 w-4" />
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({
                  length: 6,
                }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-14 w-full"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                Erro ao carregar contribuintes
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      CPF
                    </TableHead>

                    <TableHead>
                      Nome
                    </TableHead>

                    <TableHead>
                      Exercício
                    </TableHead>

                    <TableHead>
                      Rendimentos
                    </TableHead>

                    <TableHead>
                      Status
                    </TableHead>

                    <TableHead />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {declarations.map(
                    (declaration) => (
                      <TableRow
                        key={`${declaration.contribuinteId}-${declaration.id}`}
                      >
                        <TableCell>
                          {formatCPF(
                            declaration.cpf
                          )}
                        </TableCell>

                        <TableCell>
                          {declaration.nome}
                        </TableCell>

                        <TableCell>
                          {
                            declaration.exercicio
                          }
                        </TableCell>

                        <TableCell>
                          {formatCurrency(
                            declaration.totalRendPJ
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge
                            className={getResultColor(
                              declaration.resultadoDeclaracao
                            )}
                          >
                            {getResultLabel(
                              declaration.resultadoDeclaracao
                            )}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleView(
                                    declaration
                                  )
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Visualizar
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() =>
                                  handleDeleteModal(
                                    declaration
                                  )
                                }
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {deleteConfirm && (
        <AlertDialog
          open={!!deleteConfirm}
          onOpenChange={() =>
            setDeleteConfirm(null)
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Confirmar Exclusão
              </AlertDialogTitle>

              <AlertDialogDescription>
                Tem certeza que deseja
                excluir{" "}
                <strong>
                  {deleteConfirm.nome}
                </strong>
                ?
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>
                Cancelar
              </AlertDialogCancel>

              <AlertDialogAction
                onClick={() =>
                  handleDelete(
                    deleteConfirm
                  )
                }
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}