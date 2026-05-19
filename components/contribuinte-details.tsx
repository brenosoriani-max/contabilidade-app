"use client"

import React, {
  Fragment,
  ReactNode,
  useCallback,
  useMemo,
  useEffect,
  useState,
} from "react"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Virtuoso } from "react-virtuoso"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
  FolderOpen,
  ClipboardList,
  FileCheck,
  BadgeCheck,
  Check,
  FileCode,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { ExtractionResultBadge } from "@/components/extraction-result-badge"

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

const GRUPOS_BENS: Record<string, string> = {
  "01": "Bens Imóveis",
  "02": "Bens Móveis",
  "03": "Participações",
  "04": "Investimentos",
  "05": "Créditos",
  "06": "Depósitos",
  "07": "Fundos",
  "08": "Criptoativos",
  "09": "Outros",
}


function StatCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <Card className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
            <h4 className="text-sm font-black tracking-tight mt-0.5 truncate">{value}</h4>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ───────────────────────────── */

type StepStatus = "done" | "active" | "pending";

const PIPELINE_ORDER = [
  "pendente",
  "coletando_docs",
  "revisao_contador",
  "pronto_envio",
  "entregue",
];

const PIPELINE_STEPS = [
  { label: "XML importado" },
  { label: "Coletando docs" },
  { label: "Revisão" },
  { label: "Pronto p/ envio" },
  { label: "Entregue" },
];

function Field({ 
  label, 
  value, 
  highlighted, 
  editable, 
  onSave 
}: { 
  label: string; 
  value: any; 
  highlighted?: boolean;
  editable?: boolean;
  onSave?: (val: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value || "")

  const handleBlur = () => {
    setIsEditing(false)
    if (tempValue !== value) {
      onSave?.(tempValue)
    }
  }

  return (
    <div 
      className={`p-3 rounded-xl transition-all duration-500 border ${highlighted ? "bg-primary/5 border-primary ring-2 ring-primary/20 scale-[1.02]" : "border-transparent"} ${editable ? "hover:bg-muted/50 cursor-text" : "hover:bg-muted/30"}`}
      onClick={() => editable && setIsEditing(true)}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      {isEditing ? (
        <Input 
          autoFocus
          className="h-7 text-sm font-bold bg-background border-primary"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === "Enter" && handleBlur()}
        />
      ) : (
        <p className="font-bold text-sm tracking-tight flex items-center justify-between">
          {value || <span className="text-muted-foreground/40 italic font-normal">Não informado</span>}
          {editable && !value && <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-black">EDITAR</span>}
        </p>
      )}
    </div>
  )
}

/* ───────────────────────────── */

export const ContribuinteDetails = React.memo(
  ({ declaration, contribuinte, assets = [], onDataRefresh }: Props) => {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const activeTab = searchParams.get("tab") || "geral"
    const [highlightedField, setHighlightedField] = useState<string | null>(null)

    const handleTabChange = useCallback(
      (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      },
      [searchParams, router, pathname]
    )

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

    const [extractionResult, setExtractionResult] = useState<any>(null)

    const [checklist, setChecklist] =
      useState<Checklist | null>(null)

    const [checklistLoading, setChecklistLoading] =
      useState(false)

    const [exportando, setExportando] =
      useState(false)

    const [formatoExport, setFormatoExport] =
      useState<"xml" | "posicional" | "dec">("dec")

    const [customTag, setCustomTag] = useState("")

    const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({})

    const toggleManualCheck = (id: string) => {
      setManualChecks(prev => ({
        ...prev,
        [id]: !prev[id]
      }))
    }

    const declaracaoId = declaration?.id ?? null

    const anoExercicio =
      declaration?.anoExercicio ??
      new Date().getFullYear()

    if (!contribuinte) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center bg-background/50 backdrop-blur-sm rounded-[2.5rem] border border-dashed border-primary/20 p-12">
           <div className="relative mb-8">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 scale-150 opacity-20" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xl ring-1 ring-white/20">
                 <Loader2 className="h-10 w-10 animate-spin" />
              </div>
           </div>
           <h3 className="text-2xl font-black tracking-tight text-foreground">Sincronizando Dossiê</h3>
           <p className="mt-4 text-sm font-bold text-muted-foreground max-w-sm mx-auto leading-relaxed">
             Estamos consolidando os dados fiscais e documentos do contribuinte para uma auditoria completa.
           </p>
        </div>
      )
    }

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
        type: "data",
        fieldId: "identificacao.nome_completo",
      },
      {
        label: "CPF",
        ok: !!contribuinte.cpf,
        value: formatCPF(contribuinte.cpf),
        category: "Dados Pessoais",
        type: "doc",
        fieldId: "identificacao.cpf",
      },
      {
        label: "Data de Nascimento",
        ok: !!contribuinte.dataNascimento,
        value: formatDate(contribuinte.dataNascimento),
        category: "Dados Pessoais",
        type: "data",
        fieldId: "identificacao.data_nascimento",
      },
      {
        label: "Título de Eleitor",
        ok: !!contribuinte.tituloEleitor,
        value: contribuinte.tituloEleitor,
        category: "Documentos",
        type: "doc",
        fieldId: "identificacao.titulo_eleitor",
      },
      {
        label: "Endereço Completo",
        ok: !!(contribuinte.enderecoLogradouro && contribuinte.enderecoMunicipio),
        value: contribuinte.enderecoLogradouro ? `${contribuinte.enderecoLogradouro}, ${contribuinte.enderecoMunicipio}` : null,
        category: "Dados Pessoais",
        type: "data",
        fieldId: "endereco.logradouro",
      },
      {
        label: "RG / CNH",
        ok: !!contribuinte.dataNascimento, // Simplificação
        value: "Documento Identidade",
        category: "Documentos",
        type: "doc",
        fieldId: "identificacao.rg",
      },
      {
        label: "Informe de Rendimentos",
        ok: Number(declaration?.totalRendPJ) > 0,
        value: declaration?.totalRendPJ ? formatCurrency(declaration.totalRendPJ) : null,
        category: "Financeiro",
        type: "doc",
        fieldId: "rendimentos.pj",
      },
      {
        label: "Bens e Direitos",
        ok: assets.length > 0,
        value: `${assets.length} itens lançados`,
        category: "Patrimônio",
        type: "data",
        fieldId: "bens",
      },
      {
        label: "Contato (Tel/Email)",
        ok: !!(contribuinte.telefone || contribuinte.email),
        value: contribuinte.email || contribuinte.telefone,
        category: "Dados Pessoais",
        type: "data",
        fieldId: "contato.email",
      },
      {
        label: "Extrato Bancário",
        ok: Number(declaration?.totalBensAtual) > 0,
        value: "Sincronizado",
        category: "Financeiro",
        type: "doc",
        fieldId: "financeiro.extrato",
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
        carregarChecklist()
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
      setExtractionResult(null)

      try {
        const res = await declaracaoIrpfService.uploadDocumento(
          declaracaoId,
          docFile,
          finalTag
        )

        // Captura o resultado da extração
        if ((res as any)?.extractionSummary) {
          const summary = (res as any).extractionSummary
          setExtractionResult(summary)

          const totalCampos =
            summary.campos_simples_atualizados +
            summary.bens_criados +
            summary.rendimentos_pj_criados +
            summary.meses_pf_criados

          toast.success(
            `Documento ${finalTag} processado!`,
            {
              description: `${totalCampos} campo${totalCampos > 1 ? "s" : ""} atualizado${totalCampos > 1 ? "s" : ""} (${Math.round(summary.confianca * 100)}% confiança)`,
              duration: 6000,
            }
          )
        } else if (res.contribuinteAtualizado?.updated) {
          toast.success(
            `Documento ${finalTag} processado pela IA!`,
            {
              description: `Os campos [${res.contribuinteAtualizado.fields.join(", ")}] foram atualizados automaticamente no cadastro.`,
              duration: 6000,
            }
          )
        } else {
          toast.success(`Documento ${finalTag} enviado com sucesso!`)
        }

        setDocFile(null)
        setTag("")
        setCustomTag("")

        onDataRefresh?.()
        carregarChecklist()
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
          const data = await declaracaoIrpfService.getChecklist(declaracaoId)
          setChecklist(data)
        } catch (e: any) {
          toast.error(e.message || "Erro ao carregar checklist")
        } finally {
          setChecklistLoading(false)
        }
      },
      [declaracaoId]
    )

    const shouldAutoLoadChecklist = activeTab !== "checklist"

    useEffect(() => {
      // Regra: na aba "checklist" NÃO fazer refresh automático.
      // Checklist só será atualizado quando o usuário clicar no botão
      // ("Sincronizar Conferência").
      if (!shouldAutoLoadChecklist) return
      if (!declaracaoId) return

      let isCancelled = false

      const run = async () => {
        setChecklistLoading(true)
        try {
          const data = await declaracaoIrpfService.getChecklist(declaracaoId)
          if (!isCancelled) setChecklist(data)
        } catch (e: any) {
          if (!isCancelled) toast.error(e.message || "Erro ao carregar checklist")
        } finally {
          if (!isCancelled) setChecklistLoading(false)
        }
      }

      run()

      return () => {
        isCancelled = true
      }
    }, [declaracaoId, shouldAutoLoadChecklist])





    async function handleFieldUpdate(fieldPath: string, value: string) {
      if (!declaracaoId) return
      try {
        await declaracaoIrpfService.putCampo(declaracaoId, {
          campo: fieldPath,
          valor: value
        })
        toast.success("Campo atualizado", {
          description: "A alteração foi salva e sincronizada com o XML de exportação."
        })
        onDataRefresh?.()
        carregarChecklist()
      } catch (e: any) {
        toast.error(e.message || "Erro ao salvar campo")
      }
    }

    async function handleExportar(formato: "xml" | "posicional" | "dec") {
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
              formato,
            }),
          }
        )

        if (!res.ok) {
          throw new Error(
            "Erro ao exportar arquivo"
          )
        }

        const blob = await res.blob()

        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const anoAnterior = anoExercicio - 1;
        const tipo = "ORIGI"; // Conforme solicitado
        const ext = formato === "xml" ? "xml" : "DEC";
        a.download = `${contribuinte?.cpf}-IRPF-A-${anoExercicio}-${anoAnterior}-${tipo}.${ext}`;
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Arquivo gerado!", {
          description: "O download deve iniciar automaticamente."
        })
      } catch (e: any) {
        toast.error(e.message || "Erro na exportação")
      } finally {
        setExportando(false)
      }
    }


    return (
      <div className="space-y-6">
        {/* HEADER & PIPELINE */}
        <div className="flex flex-col gap-4">
          <Card className="border-none shadow-sm bg-background/60 backdrop-blur-md border border-white/20">
            <CardHeader className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                    <User className="h-7 w-7" />
                  </div>
 
                  <div>
                    <div className="flex items-center gap-2">
                       <h2 className="text-2xl font-black tracking-tight text-foreground">
                         {contribuinte.nome}
                       </h2>
                       <Badge className={`${statusClasses} rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider`}>
                         {statusLabel}
                       </Badge>
                    </div>
 
                    <div className="mt-1 flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground/70">
                        <FileText className="h-3 w-3" />
                        {formatCPF(contribuinte.cpf)}
                      </div>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                      <Badge variant="outline" className="h-5 text-[10px] font-bold border-muted-foreground/20">
                        EXERCÍCIO {anoExercicio}
                      </Badge>
                    </div>
                  </div>
                </div>
 
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold border-muted-foreground/20 hover:bg-primary/5 transition-all group">
                        {exportando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4 text-primary group-hover:scale-110 transition-transform" />}
                        EXPORTAR
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl border-white/20 bg-background/80 backdrop-blur-md">
                      <DropdownMenuItem onClick={() => handleExportar("posicional")} className="cursor-pointer font-bold gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Arquivo .DEC (Layout RFB)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportar("xml")} className="cursor-pointer font-bold gap-2">
                        <FileCode className="h-4 w-4 text-primary" />
                        XML Bruto
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="default" size="sm" className="h-9 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                    REENVIAR LINK
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
 
          {/* DECLARACAO PIPELINE */}
          <div className="w-full px-2">
            <div className="flex flex-wrap items-center justify-center gap-4 py-3">
              {(() => {
                const statusPipeline = checklist?.status_pipeline || declaration?.statusPipeline || "pendente";
                const currentIndex = PIPELINE_ORDER.indexOf(statusPipeline);
                const activeIndex = currentIndex === -1 ? 0 : currentIndex;

                return PIPELINE_STEPS.map((step, idx) => {
                  let status: StepStatus = "pending";
                  if (idx < activeIndex) status = "done";
                  else if (idx === activeIndex) status = "active";

                  const isLast = idx === PIPELINE_STEPS.length - 1;

                  return (
                    <Fragment key={idx}>
                      <span
                        className={cn(
                          "text-[12px] font-black uppercase tracking-[0.25em] text-black",
                          status === "pending" && "opacity-60"
                        )}
                      >
                        {step.label}
                      </span>

                      {!isLast && <span className="text-[12px] text-black/40 px-2">→</span>}
                    </Fragment>
                  );
                })
              })()}
            </div>
          </div>
        </div>
 
        {/* KPI GRID */}
        {declaration && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Rendimentos"
              value={formatCurrency(declaration.totalRendPJ)}
              icon={<Landmark className="h-5 w-5" />}
            />
            <StatCard
              title="IRRF"
              value={formatCurrency(declaration.totalIRRF)}
              icon={<Calculator className="h-5 w-5" />}
            />
            <StatCard
              title="Patrimônio"
              value={formatCurrency(declaration.totalBensAtual)}
              icon={<Building2 className="h-5 w-5" />}
            />
            <StatCard
              title="Variação"
              value={`${variation >= 0 ? "+" : ""}${formatPercent(variationPercent)}`}
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
 
        {/* TABS CONTAINER */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-12 bg-muted/30 p-1 rounded-xl">
            <TabsTrigger value="geral" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs">Visão Geral</TabsTrigger>
            <TabsTrigger value="dados" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs">Dados</TabsTrigger>
            <TabsTrigger value="checklist" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs">Checklist IR</TabsTrigger>
            <TabsTrigger value="documentos" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs">Documentos</TabsTrigger>
            <TabsTrigger value="bens" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs">Bens</TabsTrigger>
          </TabsList>
 
          {/* TAB: VISÃO GERAL */}
          <TabsContent value="geral" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
               <Card className="md:col-span-2 border-none shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Audit Journal - Insights Fiscais</CardTitle>
                    <CardDescription>Resumo de riscos e validações automáticas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-amber-100 shadow-sm">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                           <p className="text-sm font-bold text-amber-900">Risco de Malha Fina: Médio</p>
                           <p className="text-xs text-amber-700/80 mt-1">A variação patrimonial ({formatPercent(variationPercent)}) está acima da média histórica para este nível de rendimento. Verifique a origem dos recursos.</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-emerald-100 shadow-sm">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                           <p className="text-sm font-bold text-emerald-900">Cruzamento de Rendimentos</p>
                           <p className="text-xs text-emerald-700/80 mt-1">Todos os informes de rendimentos recebidos via PDF foram sincronizados com sucesso.</p>
                        </div>
                     </div>
                  </CardContent>
               </Card>
 
               <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Resumo Financeiro</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                     <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                           <span className="text-muted-foreground font-medium">Bens 2023</span>
                           <span className="font-bold">{formatCurrency(declaration?.totalBensAnterior || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                           <span className="text-muted-foreground font-medium">Bens 2024</span>
                           <span className="font-bold text-primary">{formatCurrency(declaration?.totalBensAtual || 0)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full">
                           <div className="h-full bg-primary rounded-full" style={{ width: '70%' }} />
                        </div>
                     </div>
                     <Button className="w-full rounded-xl font-bold" variant="outline" onClick={() => handleTabChange("bens")}>
                        Ver Todos os Bens
                        <ArrowRight className="ml-2 h-4 w-4" />
                     </Button>
                  </CardContent>
               </Card>
            </div>
          </TabsContent>
 
          {/* TAB: DADOS */}
          <TabsContent value="dados">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <CardTitle className="text-lg font-bold">Identificação</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field 
                    label="Nome Completo" 
                    value={contribuinte.nome} 
                    highlighted={highlightedField === "identificacao.nome_completo"} 
                    editable
                    onSave={(v) => handleFieldUpdate("identificacao.nome_completo", v)}
                  />
                  <Field 
                    label="Natureza Ocupação" 
                    value={contribuinte.naturezaOcupacao} 
                    highlighted={highlightedField === "identificacao.natureza_ocupacao"} 
                    editable
                    onSave={(v) => handleFieldUpdate("identificacao.natureza_ocupacao", v)}
                  />
                  <Field 
                    label="Ocupação Principal" 
                    value={contribuinte.ocupacaoPrincipal} 
                    highlighted={highlightedField === "identificacao.ocupacao_principal"} 
                    editable
                    onSave={(v) => handleFieldUpdate("identificacao.ocupacao_principal", v)}
                  />
                  <Field 
                    label="CPF" 
                    value={formatCPF(contribuinte.cpf)} 
                    highlighted={highlightedField === "identificacao.cpf"} 
                    editable
                    onSave={(v) => handleFieldUpdate("identificacao.cpf", v)}
                  />
                  <Field 
                    label="Data Nascimento" 
                    value={formatDate(contribuinte.dataNascimento)} 
                    highlighted={highlightedField === "identificacao.data_nascimento"} 
                    editable
                    onSave={(v) => handleFieldUpdate("identificacao.data_nascimento", v)}
                  />
                  <Field 
                    label="Título de Eleitor" 
                    value={contribuinte.tituloEleitor} 
                    highlighted={highlightedField === "identificacao.titulo_eleitor"} 
                    editable
                    onSave={(v) => handleFieldUpdate("identificacao.titulo_eleitor", v)}
                  />
                </CardContent>
              </Card>
 
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <CardTitle className="text-lg font-bold">Localização & Contato</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field 
                    label="CEP" 
                    value={formatCEP(contribuinte.enderecoCep)} 
                    highlighted={highlightedField === "endereco.cep"} 
                    editable
                    onSave={(v) => handleFieldUpdate("endereco.cep", v)}
                  />
                  <Field 
                    label="Endereço" 
                    value={contribuinte.enderecoLogradouro} 
                    highlighted={highlightedField === "endereco.logradouro"} 
                    editable
                    onSave={(v) => handleFieldUpdate("endereco.logradouro", v)}
                  />
                  <Field 
                    label="Complemento" 
                    value={contribuinte.enderecoComplemento} 
                    highlighted={highlightedField === "endereco.complemento"} 
                    editable
                    onSave={(v) => handleFieldUpdate("endereco.complemento", v)}
                  />
                  <Field label="Cidade/UF" value={`${contribuinte.enderecoMunicipio || ""} - ${contribuinte.enderecoUf || ""}`} highlighted={highlightedField === "endereco"} />
                  <Field 
                    label="Email" 
                    value={contribuinte.email} 
                    highlighted={highlightedField === "contato.email"} 
                    editable
                    onSave={(v) => handleFieldUpdate("contato.email", v)}
                  />
                  <Field 
                    label="Telefone/Celular" 
                    value={contribuinte.telefone} 
                    highlighted={highlightedField === "contato.celular"} 
                    editable
                    onSave={(v) => handleFieldUpdate("contato.celular", v)}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
 
          {/* TAB: CHECKLIST (ANTIGA REVISAO) */}
          <TabsContent value="checklist">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* STATUS CARD */}
              <Card className="lg:col-span-1 border-none shadow-sm bg-gradient-to-br from-primary/10 to-transparent h-fit sticky top-6">
                <CardHeader className="pb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Qualidade dos Dados</p>
                  <CardTitle className="text-2xl font-black">Progresso Geral</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center justify-center py-8">
                     <div className="relative h-32 w-32 flex items-center justify-center">
                        <svg className="h-full w-full rotate-[-90deg]">
                           <circle cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-muted/20" />
                           <circle cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" strokeWidth="12" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * (concluidos.length / cadastroItems.length))} className="text-primary transition-all duration-1000" strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                           <span className="text-3xl font-black">{Math.round((concluidos.length / cadastroItems.length) * 100)}%</span>
                           <span className="text-[10px] uppercase font-bold text-muted-foreground">Auditado</span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="space-y-3">
                     <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-muted-foreground">Obrigatórios</span>
                        <span className="font-black text-primary">{concluidos.length} de {cadastroItems.length}</span>
                     </div>
                     <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${(concluidos.length / cadastroItems.length) * 100}%` }} />
                     </div>
                  </div>

                  <Button className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20" onClick={carregarChecklist} disabled={checklistLoading}>
                    {checklistLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
                    Sincronizar Conferência
                  </Button>
                </CardContent>
              </Card>

              {/* LISTA DE CHECKLIST */}
              <div className="lg:col-span-2 space-y-8">
                {["Dados Pessoais", "Documentos", "Financeiro", "Patrimônio"].map((category) => {
                  const items = cadastroItems.filter(i => i.category === category);
                  if (items.length === 0) return null;
                  
                  return (
                    <div key={category} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between px-2">
                         <div className="flex items-center gap-2">
                           <div className="h-4 w-1 rounded-full bg-primary" />
                           <h4 className="text-xs font-black uppercase tracking-widest text-foreground">{category}</h4>
                         </div>
                         <Badge variant="outline" className="text-[10px] font-bold border-muted-foreground/10">
                            {items.filter(i => i.ok || manualChecks[i.fieldId]).length} / {items.length} COMPLETO
                         </Badge>
                      </div>

                      <div className="bg-background rounded-3xl border border-muted-foreground/10 overflow-hidden shadow-sm">
                        {items.map((item, idx) => {
                          const isDone = item.ok || manualChecks[item.fieldId];
                          
                          return (
                            <div key={idx} className={`p-4 flex items-center justify-between gap-4 transition-all border-b last:border-b-0 hover:bg-muted/5 ${isDone ? "bg-emerald-50/10" : ""}`}>
                               <div className="flex items-center gap-4 flex-1">
                                  <div className="flex items-center justify-center min-w-[24px]">
                                     <Checkbox 
                                       id={`check-${item.fieldId}`}
                                       checked={isDone}
                                       onCheckedChange={() => toggleManualCheck(item.fieldId)}
                                       className="h-5 w-5 rounded-md data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                     />
                                  </div>
                                  <div className="space-y-0.5">
                                     <Label htmlFor={`check-${item.fieldId}`} className={`text-sm font-bold cursor-pointer transition-all ${isDone ? "text-muted-foreground line-through opacity-50" : "text-foreground"}`}>
                                        {item.label}
                                        {item.ok && <CheckCircle2 className="inline ml-2 h-3 w-3 text-emerald-500" />}
                                     </Label>
                                     <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                                        {item.ok ? `Valor: ${item.value}` : "Pendente de validação no sistema"}
                                     </p>
                                  </div>
                               </div>
                               
                               {!item.ok && (
                                 <Button 
                                   variant="ghost" 
                                   size="sm" 
                                   className="h-8 pr-2 pl-4 rounded-xl text-[10px] font-black tracking-widest text-primary hover:bg-primary/10 transition-all group shrink-0" 
                                   onClick={() => {
                                      if (item.type === "doc") {
                                        setTag(item.fieldId);
                                        handleTabChange("documentos");
                                        toast.info(`Local de upload para: ${item.label}`);
                                      } else {
                                        handleTabChange("dados");
                                        setHighlightedField(item.fieldId);
                                        toast.info(`Campo destacado na aba Dados: ${item.label}`);
                                      }
                                   }}
                                 >
                                   {item.type === "doc" ? "ANEXAR" : "PREENCHER"} 
                                   <ArrowRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                                 </Button>
                               )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* TAB: DOCUMENTOS */}
          <TabsContent value="documentos">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-none shadow-sm h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileUp className="h-4 w-4 text-primary" />
                    <CardTitle className="text-lg font-bold">Fontes Externas</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col justify-center">
                  <div className="p-8 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 group cursor-pointer hover:bg-primary/10 transition-all text-center">
                    <input type="file" accept=".xml" className="hidden" id="xml-upload-main" onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)} />
                    <Label htmlFor="xml-upload-main" className="cursor-pointer block">
                       <FileUp className="h-10 w-10 text-primary mx-auto mb-3 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                       <p className="text-sm font-black text-foreground">Importar Declaração Anterior (XML)</p>
                       <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">Sincroniza automaticamente bens, dívidas e dados cadastrais da receita federal.</p>
                    </Label>
                  </div>
                  <Button className="w-full h-12 rounded-xl font-bold transition-all" variant={xmlFile ? "default" : "outline"} onClick={handleImportarXml} disabled={importando || !xmlFile}>
                    {importando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                    {xmlFile ? `IMPORTAR "${xmlFile.name}"` : "SELECIONE UM ARQUIVO XML"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    <CardTitle className="text-lg font-bold">Repositório de Documentos</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tipo de Documento</Label>
                    <Select value={tag} onValueChange={setTag}>
                      <SelectTrigger className="h-12 rounded-xl focus:ring-primary bg-muted/20 border-none"><SelectValue placeholder="Selecione a categoria..." /></SelectTrigger>
                      <SelectContent>{TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {tag === "Outros" && (
                    <Input placeholder="Especifique o nome do documento..." className="h-12 rounded-xl border-primary/20 focus:ring-primary shadow-sm animate-in fade-in slide-in-from-top-2" value={customTag} onChange={(e) => setCustomTag(e.target.value)} />
                  )}

                  <div className="relative group space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Arquivo</Label>
                    <div className="relative">
                       <Input type="file" accept="image/*,application/pdf" className="h-12 pt-3 rounded-xl border-dashed border-2 opacity-0 absolute inset-0 z-10 cursor-pointer" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                       <div className="h-12 rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/10 group-hover:bg-muted/20 transition-all border-muted-foreground/20">
                          <p className="text-sm font-bold text-muted-foreground">{docFile ? docFile.name : "Arraste PDF ou Imagem aqui"}</p>
                       </div>
                    </div>
                  </div>

                  <Button className="w-full h-12 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all" disabled={docLoading || !docFile || !tag || (tag === "Outros" && !customTag)} onClick={handleDocumento}>
                    {docLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    EFETUAR UPLOAD AGORA
                  </Button>

                  {/* Resultado da extração */}
                  {extractionResult && (
                    <ExtractionResultBadge
                      confianca={extractionResult.confianca}
                      origem={extractionResult.confianca >= 0.5 ? "anchor_parser" : "claude_ocr"}
                      camposAtualizados={
                        extractionResult.campos_simples_atualizados +
                        extractionResult.bens_criados +
                        extractionResult.rendimentos_pj_criados +
                        extractionResult.meses_pf_criados
                      }
                      alertas={extractionResult.alertas_revisao}
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2 border-none shadow-sm bg-gradient-to-r from-emerald-50 to-emerald-100/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileDown className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-xl font-black text-emerald-950">Finalização do Processo</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant={formatoExport === "dec" ? "default" : "outline"} className={`h-14 rounded-xl font-black text-[10px] transition-all p-2 ${formatoExport === 'dec' ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-emerald-200'}`} onClick={() => setFormatoExport("dec")}>
                      ARQUIVO .DEC
                    </Button>
                    <Button variant={formatoExport === "xml" ? "default" : "outline"} className={`h-14 rounded-xl font-black text-[10px] transition-all p-2 ${formatoExport === 'xml' ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-emerald-200'}`} onClick={() => setFormatoExport("xml")}>
                      ARQUIVO .XML
                    </Button>
                  </div>
                  <Button className="w-full h-16 rounded-2xl font-black text-lg bg-emerald-600 hover:bg-emerald-700 shadow-2xl shadow-emerald-200 group relative overflow-hidden" disabled={exportando} onClick={() => handleExportar(formatoExport)}>
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                    <div className="relative flex items-center justify-center">
                       {exportando ? <Loader2 className="h-6 w-6 animate-spin mr-3" /> : <FileDown className="h-6 w-6 mr-3 group-hover:bounce transition-all" />}
                       GERAR DECLARAÇÃO {anoExercicio}
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: BENS (PREMIUM RENDERING) */}
          <TabsContent value="bens">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/5 border-b py-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                       <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black tracking-tight">Relação de Bens e Direitos</CardTitle>
                      <CardDescription className="text-xs font-bold text-primary flex items-center gap-1.5 mt-0.5">
                         <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                         {filteredAssets.length} registros auditados no sistema
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative w-[320px]">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                      <Input placeholder="Pesquisar por descrição..." className="pl-10 h-11 rounded-xl bg-background border-muted-foreground/10 focus:ring-primary shadow-sm" value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} />
                    </div>
                    <Select value={assetGroupFilter} onValueChange={setAssetGroupFilter}>
                      <SelectTrigger className="w-[200px] h-11 rounded-xl bg-background border-muted-foreground/10 shadow-sm"><SelectValue placeholder="Todos Grupos" /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all" className="font-bold">Todos os Grupos</SelectItem>
                        {Object.entries(GRUPOS_BENS).map(([id, label]) => <SelectItem key={id} value={id} className="text-xs font-semibold">{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {(!assets || assets.length === 0) ? (
                  <div className="p-20 text-center flex flex-col items-center">
                     <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                        <Package className="h-10 w-10 text-muted-foreground/20" />
                     </div>
                     <h3 className="text-lg font-black text-foreground/40">Nenhum bem declarado</h3>
                     <p className="text-sm text-muted-foreground/60 mt-2 max-w-xs">Os bens aparecerão aqui após a importação do XML ou lançamento manual.</p>
                  </div>
                ) : filteredAssets.length > 50 ? (
                  <div className="h-[700px] w-full">
                    <Virtuoso data={filteredAssets} itemContent={(index, asset) => (
                      <div className="p-6 border-b last:border-b-0 hover:bg-primary/[0.02] transition-all bg-background group cursor-default">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="max-w-2xl">
                            <div className="mb-2 flex gap-2">
                              <Badge className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black tracking-[0.1em] rounded-lg px-2 py-0.5">GRUPO {asset.grupo}</Badge>
                              <Badge variant="outline" className="text-[9px] font-black border-muted-foreground/10 rounded-lg px-2 py-0.5 opacity-60">COD {asset.codigo}</Badge>
                            </div>
                            <h4 className="font-bold text-[13px] tracking-tight leading-relaxed group-hover:text-primary transition-colors pr-8">{asset.descricao}</h4>
                          </div>
                          <div className="flex gap-12 shrink-0 bg-muted/20 p-4 rounded-2xl group-hover:bg-primary/5 transition-colors">
                            <div className="text-right">
                              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.15em] mb-1.5 opacity-60">Posição 2023</p>
                              <p className="font-bold text-sm text-foreground/80 tracking-tight">{formatCurrency(asset.valorAnterior)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase font-black text-primary tracking-[0.15em] mb-1.5">Posição 2024</p>
                              <p className="font-black text-base text-primary tracking-tight">{formatCurrency(asset.valorAtual)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )} />
                  </div>
                ) : (
                  <div className="divide-y divide-muted/50">
                    {paginatedAssets.map((asset) => (
                      <div key={asset.id} className="p-6 hover:bg-primary/[0.03] transition-all bg-background group flex items-center justify-between">
                         <div className="max-w-2xl">
                            <div className="mb-2.5 flex gap-2">
                              <Badge className="bg-muted text-muted-foreground text-[9px] font-black tracking-widest rounded-lg px-2 py-0.5">GRUPO {asset.grupo}</Badge>
                              <Badge variant="outline" className="text-[9px] font-black border-muted-foreground/10 rounded-lg px-2 py-0.5">CÓDIGO {asset.codigo}</Badge>
                            </div>
                            <h4 className="font-bold text-sm leading-snug text-foreground/90">{asset.descricao}</h4>
                          </div>
                          <div className="flex gap-12 text-right">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Anterior</p>
                              <p className="font-bold text-sm tracking-tight">{formatCurrency(asset.valorAnterior)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Atual</p>
                              <p className="font-black text-base text-primary tracking-tight">{formatCurrency(asset.valorAtual)}</p>
                            </div>
                          </div>
                      </div>
                    ))}
                    {totalPages > 1 && (
                      <div className="p-6 flex items-center justify-between bg-muted/10 border-t">
                        <div className="flex items-center gap-3">
                           <div className="h-2 w-2 rounded-full bg-primary" />
                           <p className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Exibindo {paginatedAssets.length} de {filteredAssets.length} registros</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl font-bold bg-background border-muted-foreground/20 hover:bg-primary/5" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                             <ChevronLeft className="h-4 w-4 mr-2" /> ANTERIOR
                          </Button>
                          <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl font-bold bg-background border-muted-foreground/20 hover:bg-primary/5" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                             PRÓXIMO <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }
)