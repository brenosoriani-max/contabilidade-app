"use client"

import React, {
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react"

import { toast } from "sonner"

import {
  User,
  MapPin,
  Building2,
  Calculator,
  Landmark,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  FileUp,
  FileDown,
  Loader2,
  Upload,
  ClipboardCheck,
  Package,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  ArrowRight,
  Filter,
} from "lucide-react"

import type {
  BemDireito,
  ContribuinteSummary,
  Declaration,
  Checklist,
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

import { declaracaoIrpfService } from "@/lib/api/services"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

/* ───────────────────────────── */

interface Props {
  declaration: Declaration | null
  contribuinte: ContribuinteSummary | null
  assets?: BemDireito[]
  onDataRefresh?: () => void
}

const ITEMS_PER_PAGE = 8

const TAGS = [
  "RG / CNH",
  "CPF",
  "Certidão de Casamento",
  "Título de Eleitor",
  "Comprovante de residência",
  "Informe de rendimentos",
  "Extrato bancário",
  "Recibo de Aluguel",
  "Nota Fiscal / Recibo Médico",
  "Carnê-leão / Recibo autônomo",
  "Outros",
] as const

const GRUPOS_BENS: Record<number, string> = {
  1: "Bens Imóveis",
  2: "Bens Móveis",
  3: "Participações",
  4: "Investimentos",
  5: "Créditos",
  6: "Depósitos",
  7: "Fundos",
  8: "Criptoativos",
  9: "Outros",
}

/* ───────────────────────────── */

function StatCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: ReactNode
}) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/5 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            {title}
          </p>
          <p className="text-sm font-bold truncate">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="space-y-1 rounded-lg border p-3 bg-muted/5">
      <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
        {label}
      </p>
      <div className="text-sm font-bold text-foreground">
        {value || "---"}
      </div>
    </div>
  )
}

/* ───────────────────────────── */

export const ContribuinteDetails = React.memo(
  function ContribuinteDetails({
    declaration,
    contribuinte,
    assets = [],
    onDataRefresh,
  }: Props) {
    const [assetSearch, setAssetSearch] =
      useState("")

    const [assetGroupFilter, setAssetGroupFilter] =
      useState("all")

    const [currentPage, setCurrentPage] =
      useState(1)

    const [xmlFile, setXmlFile] =
      useState<File | null>(null)

    const [importando, setImportando] =
      useState(false)

    const [docFile, setDocFile] =
      useState<File | null>(null)

    const [tag, setTag] = useState("")

    const [docLoading, setDocLoading] =
      useState(false)

    const [checklist, setChecklist] =
      useState<Checklist | null>(null)

    const [checklistLoading, setChecklistLoading] =
      useState(false)

    const [exportando, setExportando] =
      useState(false)

    const [formatoExport, setFormatoExport] =
      useState<"dec" | "xml">("dec")

    const [customTag, setCustomTag] = useState("")

    const declaracaoId = declaration?.id ?? null

    const anoExercicio =
      declaration?.anoExercicio ??
      new Date().getFullYear()

    if (!contribuinte) return null

    /* ───────────────────────────── */

    const filteredAssets = useMemo(() => {
      return assets.filter((a) => {
        const matchSearch = (
          a.descricao || ""
        )
          .toLowerCase()
          .includes(assetSearch.toLowerCase())

        const matchGroup =
          assetGroupFilter === "all" ||
          String(a.grupo) === assetGroupFilter

        return matchSearch && matchGroup
      })
    }, [assets, assetSearch, assetGroupFilter])

    const totalPages = Math.ceil(
      filteredAssets.length / ITEMS_PER_PAGE
    )

    const paginatedAssets = useMemo(() => {
      const start =
        (currentPage - 1) * ITEMS_PER_PAGE

      return filteredAssets.slice(
        start,
        start + ITEMS_PER_PAGE
      )
    }, [filteredAssets, currentPage])

    const statusLabel = getResultLabel(
      declaration?.resultadoDeclaracao || null
    )

    const statusClasses = getResultColor(
      declaration?.resultadoDeclaracao || null
    )

    const variation =
      (Number(declaration?.totalBensAtual) || 0) -
      (Number(declaration?.totalBensAnterior) ||
        0)

    const variationPercent =
      variation /
      (Number(declaration?.totalBensAnterior) ||
        1)

    /* ───────────────────────────── */

    const cadastroItems = useMemo(() => [
      {
        label: "Nome Completo",
        ok: !!contribuinte.nome,
        value: contribuinte.nome,
        category: "Dados Pessoais",
      },
      {
        label: "CPF",
        ok: !!contribuinte.cpf,
        value: formatCPF(contribuinte.cpf),
        category: "Dados Pessoais",
      },
      {
        label: "Data de Nascimento",
        ok: !!contribuinte.dataNascimento,
        value: formatDate(contribuinte.dataNascimento),
        category: "Dados Pessoais",
      },
      {
        label: "Título de Eleitor",
        ok: !!contribuinte.tituloEleitor,
        value: contribuinte.tituloEleitor,
        category: "Documentos",
      },
      {
        label: "Endereço Completo",
        ok: !!(contribuinte.enderecoLogradouro && contribuinte.enderecoMunicipio),
        value: contribuinte.enderecoLogradouro ? `${contribuinte.enderecoLogradouro}, ${contribuinte.enderecoMunicipio}` : null,
        category: "Dados Pessoais",
      },
      {
        label: "RG / CNH",
        ok: !!contribuinte.dataNascimento, // Simplificação: se tem nascimento, assumimos que algum doc foi lido ou preenchido
        value: "Documento Identidade",
        category: "Documentos",
      },
      {
        label: "Informe de Rendimentos",
        ok: Number(declaration?.totalRendPJ) > 0,
        value: declaration?.totalRendPJ ? formatCurrency(declaration.totalRendPJ) : null,
        category: "Financeiro",
      },
      {
        label: "Bens e Direitos",
        ok: assets.length > 0,
        value: `${assets.length} itens lançados`,
        category: "Patrimônio",
      },
      {
        label: "Contato (Tel/Email)",
        ok: !!(contribuinte.telefone || contribuinte.email),
        value: contribuinte.email || contribuinte.telefone,
        category: "Dados Pessoais",
      },
      {
        label: "Extrato Bancário",
        ok: Number(declaration?.totalBensAtual) > 0, // Heurística: se tem bens, provavelmente tem extrato bancário
        value: "Sincronizado",
        category: "Financeiro",
      },
    ], [contribuinte, declaration, assets])

    const pendentes = cadastroItems.filter(i => !i.ok)
    const concluidos = cadastroItems.filter(i => i.ok)

    /* ───────────────────────────── */

    async function handleImportarXml() {
      if (!xmlFile || !declaracaoId) return

      setImportando(true)

      try {
        await declaracaoIrpfService.importarXml(
          declaracaoId,
          xmlFile,
          anoExercicio
        )

        toast.success(
          "XML importado com sucesso!"
        )

        setXmlFile(null)

        onDataRefresh?.()
      } catch (e: any) {
        toast.error(
          e.message || "Erro ao importar XML"
        )
      } finally {
        setImportando(false)
      }
    }

    async function handleDocumento() {
      if (!docFile || !tag || !declaracaoId)
        return

      const finalTag = tag === "Outros" ? customTag || "Outros" : tag
      setDocLoading(true)

      try {
        await declaracaoIrpfService.uploadDocumento(
          declaracaoId,
          docFile,
          finalTag
        )

        toast.success(
          `Documento ${finalTag} enviado com sucesso!`
        )

        setDocFile(null)
        setTag("")
        setCustomTag("")

        onDataRefresh?.()
      } catch (e: any) {
        toast.error(
          e.message || "Erro no upload"
        )
      } finally {
        setDocLoading(false)
      }
    }

    const carregarChecklist = useCallback(
      async () => {
        if (!declaracaoId) return

        setChecklistLoading(true)

        try {
          const data =
            await declaracaoIrpfService.getChecklist(
              declaracaoId
            )

          setChecklist(data)

          toast.success(
            "Checklist atualizado"
          )
        } catch (e: any) {
          toast.error(
            e.message ||
              "Erro ao carregar checklist"
          )
        } finally {
          setChecklistLoading(false)
        }
      },
      [declaracaoId]
    )

    async function handleExportar() {
      if (!declaracaoId) return

      setExportando(true)

      try {
        const res = await fetch(
          `/api/declaracoes/${declaracaoId}/exportar`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              anoExercicio,
              tipo: "O",
              formato: formatoExport,
            }),
          }
        )

        if (!res.ok) {
          throw new Error(
            "Erro ao exportar arquivo"
          )
        }

        const blob = await res.blob()

        const url =
          URL.createObjectURL(blob)

        const a =
          document.createElement("a")

        a.href = url

        a.download = `IRPF_${contribuinte!.nome}.${formatoExport}`

        a.click()

        URL.revokeObjectURL(url)

        toast.success(
          "Arquivo gerado com sucesso!"
        )
      } catch (e: any) {
        toast.error(
          e.message || "Erro na exportação"
        )
      } finally {
        setExportando(false)
      }
    }

    /* ───────────────────────────── */

    return (
      <div className="space-y-6">
        {/* HEADER */}

        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-6 w-6" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold">
                    {contribuinte.nome}
                  </h2>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatCPF(
                        contribuinte.cpf
                      )}
                    </span>

                    <Badge variant="outline">
                      {anoExercicio}
                    </Badge>
                  </div>
                </div>
              </div>

              <Badge className={statusClasses}>
                {statusLabel}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* KPI */}

        {declaration && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Rendimentos"
              value={formatCurrency(
                declaration.totalRendPJ
              )}
              icon={
                <Landmark className="h-5 w-5" />
              }
            />

            <StatCard
              title="IRRF"
              value={formatCurrency(
                declaration.totalIRRF
              )}
              icon={
                <Calculator className="h-5 w-5" />
              }
            />

            <StatCard
              title="Patrimônio"
              value={formatCurrency(
                declaration.totalBensAtual
              )}
              icon={
                <Building2 className="h-5 w-5" />
              }
            />

            <StatCard
              title="Variação"
              value={`${variation >= 0 ? "+" : ""}${formatPercent(
                variationPercent
              )}`}
              icon={
                variation >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )
              }
            />
          </div>
        )}

        {/* TABS */}

        <Tabs
          defaultValue="bens"
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="bens">
              Bens
            </TabsTrigger>

            <TabsTrigger value="revisao">
              Revisão
            </TabsTrigger>

            <TabsTrigger value="dados">
              Cadastro
            </TabsTrigger>

            <TabsTrigger value="arquivos">
              Arquivos
            </TabsTrigger>
          </TabsList>

          {/* BENS */}

          <TabsContent value="bens">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>
                      Bens e Direitos
                    </CardTitle>

                    <CardDescription>
                      {filteredAssets.length} registros
                    </CardDescription>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar..."
                      value={assetSearch}
                      onChange={(e) =>
                        setAssetSearch(
                          e.target.value
                        )
                      }
                    />

                    <Select
                      value={assetGroupFilter}
                      onValueChange={
                        setAssetGroupFilter
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Grupo" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="all">
                          Todos
                        </SelectItem>

                        {Object.entries(
                          GRUPOS_BENS
                        ).map(([id, label]) => (
                          <SelectItem
                            key={id}
                            value={id}
                          >
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {paginatedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-xl border p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="mb-2 flex gap-2">
                          <Badge variant="outline">
                            G{asset.grupo}
                          </Badge>

                          <Badge variant="outline">
                            C{asset.codigo}
                          </Badge>
                        </div>

                        <h4 className="font-bold">
                          {asset.descricao}
                        </h4>
                      </div>

                      <div className="flex gap-8">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Anterior
                          </p>

                          <p className="font-semibold">
                            {formatCurrency(
                              asset.valorAnterior
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Atual
                          </p>

                          <p className="font-bold text-primary">
                            {formatCurrency(
                              asset.valorAtual
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {totalPages > 1 && (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={
                        currentPage === 1
                      }
                      onClick={() =>
                        setCurrentPage(
                          (p) => p - 1
                        )
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <Button
                      size="icon"
                      variant="outline"
                      disabled={
                        currentPage ===
                        totalPages
                      }
                      onClick={() =>
                        setCurrentPage(
                          (p) => p + 1
                        )
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REVISÃO */}

          <TabsContent value="revisao">
            <div className="space-y-6">
              {/* Resumo de Conferência */}
              <Card className="border-none shadow-sm bg-primary/5">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold">Relatório de Auditoria Judicial</h3>
                    <p className="text-xs text-muted-foreground">Progresso total da conferência documental e cadastral.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                       <p className="text-2xl font-black text-primary">{Math.round((concluidos.length / cadastroItems.length) * 100)}%</p>
                       <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Concluído</p>
                    </div>
                    <Button 
                      size="sm" 
                      className="rounded-full px-6 font-bold"
                      onClick={carregarChecklist}
                      disabled={checklistLoading}
                    >
                      {checklistLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
                      ATUALIZAR CONFERÊNCIA
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Categorias (Grouping items by category) */}
              {["Dados Pessoais", "Documentos", "Financeiro", "Patrimônio"].map((category) => {
                const items = cadastroItems.filter(i => i.category === category);
                if (items.length === 0) return null;
                
                return (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                       <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                       <h4 className="text-xs font-black uppercase tracking-widest opacity-60 text-foreground">{category}</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((item, idx) => (
                        <Card key={idx} className={`border shadow-none transition-all duration-300 ${item.ok ? "bg-background border-emerald-100" : "bg-muted/10 border-dashed"}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-muted-foreground">{item.label}</p>
                                <p className={`text-sm font-semibold truncate max-w-[150px] ${item.ok ? "text-foreground" : "text-muted-foreground/40 italic"}`}>
                                  {item.ok ? item.value : "Pendente"}
                                </p>
                              </div>
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${item.ok ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                                {item.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                              </div>
                            </div>
                            
                            {!item.ok && (
                              <div className="mt-4 pt-4 border-t border-dashed">
                                 <Button variant="outline" size="sm" className="w-full text-[10px] font-bold h-7 rounded-md hover:bg-primary hover:text-white transition-colors" onClick={() => {
                                   setTag(item.label.includes("RG") ? "RG / CNH" : item.label.includes("CPF") ? "CPF" : item.label);
                                   // Logic to switch to upload tab or just scroll there?
                                   toast.info(`Vá para a aba Arquivos para anexar ${item.label}`);
                                 }}>
                                   RESOLVER AGORA
                                 </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* DADOS */}

          <TabsContent value="dados">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Identificação
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Field
                    label="Nome"
                    value={contribuinte.nome}
                  />

                  <Field
                    label="CPF"
                    value={formatCPF(
                      contribuinte.cpf
                    )}
                  />

                  <Field
                    label="Nascimento"
                    value={formatDate(
                      contribuinte.dataNascimento
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Endereço
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Field
                    label="CEP"
                    value={formatCEP(
                      contribuinte.enderecoCep
                    )}
                  />

                  <Field
                    label="Cidade"
                    value={`${contribuinte.enderecoMunicipio || ""} - ${
                      contribuinte.enderecoUf ||
                      ""
                    }`}
                  />

                  <Field
                    label="Telefone"
                    value={
                      contribuinte.telefone
                    }
                  />

                  <Field
                    label="Email"
                    value={contribuinte.email}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ARQUIVOS */}

          <TabsContent value="arquivos">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Importar XML
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Input
                    type="file"
                    accept=".xml"
                    onChange={(e) =>
                      setXmlFile(
                        e.target.files?.[0] ??
                          null
                      )
                    }
                  />

                  <Button
                    className="w-full"
                    disabled={
                      importando || !xmlFile
                    }
                    onClick={handleImportarXml}
                  >
                    {importando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="mr-2 h-4 w-4" />
                    )}

                    Importar XML
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Upload Documento
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Select
                    value={tag}
                    onValueChange={setTag}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Tipo documento" />
                    </SelectTrigger>

                    <SelectContent>
                      {TAGS.map((t) => (
                        <SelectItem
                          key={t}
                          value={t}
                        >
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {tag === "Outros" && (
                    <Input 
                      placeholder="Nome do documento personalizado..." 
                      className="h-11 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300"
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                    />
                  )}

                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    className="h-11 pt-2.5 rounded-xl border-dashed"
                    onChange={(e) =>
                      setDocFile(
                        e.target.files?.[0] ??
                          null
                      )
                    }
                  />

                  <Button
                    className="w-full h-11 rounded-xl font-bold shadow-lg"
                    disabled={
                      docLoading ||
                      !docFile ||
                      !tag ||
                      (tag === "Outros" && !customTag)
                    }
                    onClick={handleDocumento}
                  >
                    {docLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}

                    ENVIAR DOCUMENTO
                  </Button>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>
                    Exportar Declaração
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant={
                        formatoExport === "dec"
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        setFormatoExport("dec")
                      }
                    >
                      .DEC
                    </Button>

                    <Button
                      variant={
                        formatoExport === "xml"
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        setFormatoExport("xml")
                      }
                    >
                      XML
                    </Button>
                  </div>

                  <Button
                    className="w-full"
                    disabled={exportando}
                    onClick={handleExportar}
                  >
                    {exportando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}

                    Exportar Arquivo
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    )
  }
)