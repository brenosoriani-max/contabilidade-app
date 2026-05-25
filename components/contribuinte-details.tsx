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
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
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
  ExternalLink,
  Search,
  ArrowRight,
  Filter,
  FolderOpen,
  ClipboardList,
  FileCheck,
  BadgeCheck,
  Check,
  FileCode,
  CalendarDays,
  Clock,
  RefreshCcw,
  Bell,
  Trash2,
  Pencil,
  X,
  RotateCw,
  Sparkles,
  Car,
  CreditCard,
  Wallet,
  Coins,
  Calendar,
  Info,
  Maximize,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

import type {
  BemDireito,
  ContribuinteSummary,
  Declaration,
  Checklist,
  Scheduling,
} from "@/types"

import {
  formatCurrency,
  formatCPF,
  formatCEP,
  formatDate,
  formatPercent,
  getResultColor,
  getResultLabel,
  getStatusColor,
  getStatusLabel,
  maskBRL,
  parseBRLToNumber,
} from "@/lib/format"

import { declaracaoIrpfService, schedulingService, importService, contribuinteService } from "@/lib/api/services"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  AppHeader,
} from "@/components/app-header"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

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
  "01": "01 - Bens Imóveis",
  "02": "02 - Bens Móveis",
  "03": "03 - Participações Societárias",
  "04": "04 - Aplicações e Investimentos",
  "05": "05 - Créditos",
  "06": "06 - Depósitos à Vista e Numerário",
  "07": "07 - Fundos",
  "08": "08 - Criptoativos",
  "09": "09 - Outros Bens e Direitos",
}

const CODIGOS_BENS: Record<string, Record<string, string>> = {
  "01": {
    "01": "Prédio residencial",
    "11": "Apartamento",
    "12": "Casa",
    "13": "Terreno",
    "14": "Sala ou conjunto",
    "15": "Construção",
    "16": "Benfeitorias",
    "17": "Loja",
    "18": "Galpão",
    "19": "Vaga de garagem",
    "99": "Outros bens imóveis",
  },
  "02": {
    "01": "Veículo automotor terrestre (carro, moto, etc)",
    "02": "Aeronave",
    "03": "Embarcação",
    "99": "Outros bens móveis",
  },
  "03": {
    "01": "Ações (inclusive as provenientes de linha telefônica)",
    "02": "Quotas ou quinhões de capital",
    "99": "Outras participações societárias",
  },
  "04": {
    "01": "Caderneta de poupança",
    "02": "Ativos financeiros (Tesouro Direto, CDB, RDB, etc)",
    "03": "Títulos públicos e privados sujeitos a tributação",
    "99": "Outras aplicações e investimentos",
  },
  "06": {
    "01": "Depósito em conta corrente no País",
    "02": "Depósito em conta corrente no Exterior",
    "99": "Outros depósitos à vista e numerário",
  },
  "07": {
    "01": "Fundos de Investimento Imobiliário (FII)",
    "02": "Fundos de Investimento em Ações (FIA)",
    "03": "Fundos de Investimento em Índice de Mercado (ETF)",
    "99": "Outros fundos",
  },
  "08": {
    "01": "Criptoativo Bitcoin (BTC)",
    "02": "Outras criptomoedas (Altcoins)",
    "03": "Stablecoins",
    "10": "NFTs",
    "99": "Outros criptoativos",
  },
}

const PIPELINE_ORDER = [
  "pendente",
  "coletando_docs",
  "revisao_contador",
  "pronto_envio",
  "entregue",
]

type StepStatus = "done" | "active" | "pending"

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
    <Card className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {title}
            </p>
            <h4 className="text-sm font-black tracking-tight mt-0.5 truncate">
              {value}
            </h4>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ───────────────────────────── */

function Field({
  label,
  value,
  highlighted,
  editable,
  onSave,
}: {
  label: string
  value: any
  highlighted?: boolean
  editable?: boolean
  onSave?: (val: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState<string>((value ?? "").toString())

  useEffect(() => {
    if (!isEditing) {
      setTempValue((value ?? "").toString())
    }
  }, [value, isEditing])

  const hasSavedForCurrentValueRef = React.useRef<string | null>(null)

  const handleBlur = () => {
    setIsEditing(false)
    const normalized = tempValue.trim()
    const original = (value ?? "").toString().trim()

    if (normalized === original) return
    if (hasSavedForCurrentValueRef.current === normalized) return

    hasSavedForCurrentValueRef.current = normalized
    onSave?.(normalized)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleBlur()
    }
    if (e.key === "Escape") {
      hasSavedForCurrentValueRef.current = null
      setTempValue((value ?? "").toString())
      setIsEditing(false)
    }
  }

  const isEditable = editable && onSave
  const hasValue = value != null && value !== ""

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-xl transition-all duration-300",
        highlighted
          ? "bg-primary/5 ring-2 ring-primary/20 scale-[1.01]"
          : isEditable
            ? "bg-muted/40 hover:bg-muted/60"
            : "",
        isEditable ? "cursor-text" : ""
      )}
      onClick={() => isEditable && !isEditing && setIsEditing(true)}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      {isEditing ? (
        <Input
          autoFocus
          className="h-8 text-sm font-bold bg-background border-primary/40 focus-visible:ring-primary/30"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div className="flex items-center justify-between min-h-[28px]">
          <p className={cn(
            "text-sm tracking-tight",
            hasValue ? "font-bold text-foreground" : "font-normal text-muted-foreground/40 italic"
          )}>
            {hasValue ? value : "Não informado"}
          </p>
          {isEditable && (
            <span className="text-[9px] text-primary font-black uppercase tracking-wider opacity-70 hover:opacity-100 transition-opacity ml-2 shrink-0">
              Editar
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export const ContribuinteDetails = React.memo(
  ({ declaration, contribuinte, assets = [], onDataRefresh }: Props) => {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const activeTab = searchParams.get("tab") || "dados"
    const [highlightedField, setHighlightedField] = useState<string | null>(null)

    const [selectedManualYear, setSelectedManualYear] = useState<string>("2026")
    const [creatingManual, setCreatingManual] = useState(false)

    const handleCreateManualDeclaration = async () => {
      if (!contribuinteId) return
      setCreatingManual(true)
      try {
        const res = await declaracaoIrpfService.create({
          contribuinteId,
          anoExercicio: Number(selectedManualYear),
        })
        toast.success(res.message || "Declaração manual inicializada com sucesso!")
        onDataRefresh?.()
      } catch (e: any) {
        toast.error(e.message || "Erro ao inicializar declaração")
      } finally {
        setCreatingManual(false)
      }
    }

    const handleTabChange = useCallback(
      (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      },
      [searchParams, router, pathname]
    )

    const [assetSearch, setAssetSearch] = useState("")
    const [assetGroupFilter, setAssetGroupFilter] = useState("all")
    const [currentPage, setCurrentPage] = useState(1)
    const [xmlFile, setXmlFile] = useState<File | null>(null)
    const [importando, setImportando] = useState(false)
    const [docFile, setDocFile] = useState<File | null>(null)
    const [tag, setTag] = useState("")
    const [docLoading, setDocLoading] = useState(false)
    const [extractionResult, setExtractionResult] = useState<any>(null)
    const [checklist, setChecklist] = useState<Checklist | null>(null)
    const [checklistLoading, setChecklistLoading] = useState(false)
    const [exportando, setExportando] = useState(false)
    const [formatoExport, setFormatoExport] = useState<"xml" | "posicional" | "dec">("dec")
    const [customTag, setCustomTag] = useState("")
    const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({})

    const [viewerDoc, setViewerDoc] = useState<
      | null
      | {
          tag: string
          nome_arquivo: string
          tamanho_bytes: number
          media_type: string
          url: string | null
          origem: string
          recebido_em: string
          confianca_extracao?: number
        }
    >(null)

    const [isViewerMaximized, setIsViewerMaximized] = useState(false)

    const [savingField, setSavingField] = useState<string | null>(null)
    const [schedulingHistory, setSchedulingHistory] = useState<Scheduling[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    // ESTADOS PARA CRUD DE BENS
    const [isBemDialogOpen, setIsBemDialogOpen] = useState(false)
    const [editingBem, setEditingBem] = useState<BemDireito | null>(null)
    const [bemForm, setBemForm] = useState({
      grupo: "01",
      codigo: "01",
      descricao: "",
      valorAnterior: "R$ 0,00",
      valorAtual: "R$ 0,00",
      // Detalhes extras
      iptu: "",
      dataAquisicao: "",
      areaTotal: "",
      areaUnidade: "m2",
      registradoCartorio: false,
      cartorioNome: "",
      cartorioMatricula: "",
      renavam: "",
      placa: "",
      cnpjInst: "",
      nomeInst: "",
      agencia: "",
      conta: "",
      digito: "",
    })

    const generateDescricao = () => {
      let desc = ""
      const g = bemForm.grupo
      const c = bemForm.codigo

      if (g === "01") {
        desc = `${CODIGOS_BENS[g]?.[c] || "Bem Imóvel"}. IPTU: ${bemForm.iptu || "Não informado"}. `
        if (bemForm.dataAquisicao) desc += `Adquirido em ${formatDate(bemForm.dataAquisicao)}. `
        desc += `Área: ${bemForm.areaTotal || "0"}${bemForm.areaUnidade}. `
        if (bemForm.registradoCartorio) {
          desc += `Registrado no Cartório ${bemForm.cartorioNome || "N/A"}, Matrícula ${bemForm.cartorioMatricula || "N/A"}. `
        } else {
          desc += `Não registrado em cartório até o momento. `
        }
      } else if (g === "02" && c === "01") {
        desc = `VEÍCULO: ${CODIGOS_BENS[g][c]}. RENAVAM: ${bemForm.renavam || "N/A"}. PLACA: ${bemForm.placa || "N/A"}. `
      } else if (["03", "04", "06", "07"].includes(g)) {
        desc = `${CODIGOS_BENS[g]?.[c] || "Ativo Financeiro"}. INSTITUIÇÃO: ${bemForm.nomeInst || "N/A"} (CNPJ: ${bemForm.cnpjInst || "N/A"}). `
        if (bemForm.agencia) desc += `AG: ${bemForm.agencia} `
        if (bemForm.conta) desc += `CC: ${bemForm.conta}-${bemForm.digito || "0"}. `
      }

      setBemForm(prev => ({ ...prev, descricao: desc.trim() }))
    }
    const [savingBem, setSavingBem] = useState(false)
    const [deletingBemId, setDeletingBemId] = useState<number | null>(null)

    const openNewBemDialog = () => {
      setEditingBem(null)
      setBemForm({
        grupo: "01",
        codigo: "01",
        descricao: "",
        valorAnterior: "R$ 0,00",
        valorAtual: "R$ 0,00",
        iptu: "",
        dataAquisicao: "",
        areaTotal: "",
        areaUnidade: "m2",
        registradoCartorio: false,
        cartorioNome: "",
        cartorioMatricula: "",
        renavam: "",
        placa: "",
        cnpjInst: "",
        nomeInst: "",
        agencia: "",
        conta: "",
        digito: "",
      })
      setIsBemDialogOpen(true)
    }

    const openEditBemDialog = (bem: BemDireito) => {
      setEditingBem(bem)
      setBemForm({
        grupo: String(bem.grupo || "").padStart(2, "0"),
        codigo: String(bem.codigo || "").padStart(2, "0"),
        descricao: bem.descricao || "",
        valorAnterior: maskBRL(String(bem.valorAnterior || 0).replace(".", "")),
        valorAtual: maskBRL(String(bem.valorAtual || 0).replace(".", "")),
        // Reset extras on edit since we don't parse yet
        iptu: "",
        dataAquisicao: "",
        areaTotal: "",
        areaUnidade: "m2",
        registradoCartorio: false,
        cartorioNome: "",
        cartorioMatricula: "",
        renavam: "",
        placa: "",
        cnpjInst: "",
        nomeInst: "",
        agencia: "",
        conta: "",
        digito: "",
      })
      setIsBemDialogOpen(true)
    }

    const handleSaveBem = async () => {
      if (!declaracaoId) {
        toast.error("Nenhuma declaração vinculada a este contribuinte. Importe um XML primeiro para poder cadastrar bens.")
        return
      }
      setSavingBem(true)
      try {
        const url = editingBem
          ? `/api/declaracoes/${declaracaoId}/bens/${editingBem.id}`
          : `/api/declaracoes/${declaracaoId}/bens`

        const payload = {
          ...bemForm,
          valorAnterior: parseBRLToNumber(bemForm.valorAnterior),
          valorAtual: parseBRLToNumber(bemForm.valorAtual),
        }

        const res = await fetch(url, {
          method: editingBem ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.message || errData?.erro || "Erro ao salvar patrimônio")
        }

        toast.success(editingBem ? "Bem atualizado!" : "Novo bem cadastrado!")
        setIsBemDialogOpen(false)
        onDataRefresh?.()
      } catch (e: any) {
        toast.error(e.message || "Erro ao salvar")
      } finally {
        setSavingBem(false)
      }
    }

    const handleDeleteBem = async (bid: number) => {
      if (!declaracaoId) {
        toast.error("Nenhuma declaração vinculada a este contribuinte.")
        return
      }
      if (!confirm("Deseja realmente excluir este bem?")) return
      setDeletingBemId(bid)
      try {
        const res = await fetch(`/api/declaracoes/${declaracaoId}/bens/${bid}`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error("Erro ao excluir")
        toast.success("Bem removido")
        onDataRefresh?.()
      } catch (e: any) {
        toast.error(e.message || "Erro ao excluir")
      } finally {
        setDeletingBemId(null)
      }
    }

    const handleExportarPdf = async () => {
      if (!declaracaoId) return
      setExportando(true)
      try {
        const res = await fetch(`/api/declaracoes/${declaracaoId}/exportar/pdf`)
        if (!res.ok) throw new Error("Erro ao gerar PDF")
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `DOSSIE-${contribuinte?.cpf}-${anoExercicio}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Dossiê PDF gerado com sucesso!")
      } catch (e: any) {
        toast.error(e.message || "Erro no PDF")
      } finally {
        setExportando(false)
      }
    }

    const toggleManualCheck = (id: string) => {
      setManualChecks((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    const declaracaoId = declaration?.id ?? null
    const contribuinteId = contribuinte?.id ?? null
    const cpf = contribuinte?.cpf ?? null
    const anoExercicio = declaration?.anoExercicio ?? new Date().getFullYear()

    /* ─── loading state ─── */
    if (!contribuinte) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center bg-background/50 backdrop-blur-sm rounded-[2.5rem] border border-dashed border-primary/20 p-12">
          <div className="relative mb-8">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 scale-150 opacity-20" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xl ring-1 ring-white/20">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-foreground">
            Sincronizando Dossiê
          </h3>
          <p className="mt-4 text-sm font-bold text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Estamos consolidando os dados fiscais e documentos do contribuinte
            para uma auditoria completa.
          </p>
        </div>
      )
    }

    /* ─── derived data ─── */
    const filteredAssets = useMemo(() => {
      return assets.filter((a) => {
        const matchSearch = (a.descricao || "")
          .toLowerCase()
          .includes(assetSearch.toLowerCase())
        const matchGroup =
          assetGroupFilter === "all" || String(a.grupo) === assetGroupFilter
        return matchSearch && matchGroup
      })
    }, [assets, assetSearch, assetGroupFilter])

    const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE)

    const paginatedAssets = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE
      return filteredAssets.slice(start, start + ITEMS_PER_PAGE)
    }, [filteredAssets, currentPage])

    const statusLabel = getResultLabel(declaration?.resultadoDeclaracao || null)
    const statusClasses = getResultColor(declaration?.resultadoDeclaracao || null)

    const variation =
      (Number(declaration?.totalBensAtual) || 0) -
      (Number(declaration?.totalBensAnterior) || 0)

    const variationPercent =
      variation / (Number(declaration?.totalBensAnterior) || 1)

    const getDocsForItem = useCallback(
      (fieldId: string) => {
        if (!declaration) return []
        const rawDataMeta = (declaration.rawData as any)?._meta
        const documentosArquivados = (rawDataMeta?.documentos_arquivados || []) as Array<{
          tag: string
          nome_arquivo: string
          tamanho_bytes: number
          media_type: string
          url: string | null
          origem: string
          recebido_em: string
          confianca_extracao?: number
        }>

        const tagMapping: Record<string, string[]> = {
          "identificacao.cpf": ["CPF"],
          "identificacao.titulo_eleitor": ["Título de Eleitor", "Titulo de Eleitor"],
          "identificacao.rg": ["RG / CNH"],
          "endereco.logradouro": ["Comprovante de residência", "Comprovante de residencia"],
          "rendimentos.pj": ["Informe de rendimentos", "Carnê-leão / Recibo autônomo"],
          "financeiro.extrato": ["Extrato bancário"],
          "bens": ["Bens e Direitos", "Nota de corretagem / Informe de investimentos", "IPTU / Escritura", "CRLV / Documento do veículo", "Recibo de Aluguel"],
        }

        const tags = tagMapping[fieldId] || []
        return documentosArquivados.filter((doc) =>
          tags.some((tag) => (doc.tag || "").toLowerCase().trim() === tag.toLowerCase().trim())
        )
      },
      [declaration]
    )

    /* ─── checklist items ─── */
    const cadastroItems = useMemo(
      () => [
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
          value: contribuinte.enderecoLogradouro
            ? `${contribuinte.enderecoLogradouro}, ${contribuinte.enderecoMunicipio}`
            : null,
          category: "Dados Pessoais",
          type: "data",
          fieldId: "endereco.logradouro",
        },
        {
          label: "RG / CNH",
          ok: !!contribuinte.dataNascimento,
          value: "Documento Identidade",
          category: "Documentos",
          type: "doc",
          fieldId: "identificacao.rg",
        },
        {
          label: "Informe de Rendimentos",
          ok: Number(declaration?.totalRendPJ) > 0,
          value: declaration?.totalRendPJ
            ? formatCurrency(declaration.totalRendPJ)
            : null,
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
      ],
      [contribuinte, declaration, assets]
    )

    const pendentes = cadastroItems.filter((i) => !i.ok)
    const concluidos = cadastroItems.filter((i) => i.ok)

    /* ─── handlers ─── */

    async function handleImportarXml(customFile?: File) {
      const fileToUpload = customFile || xmlFile
      if (!fileToUpload) return
      setImportando(true)
      try {
        if (declaracaoId) {
          await declaracaoIrpfService.importarXml(declaracaoId, fileToUpload, anoExercicio)
          toast.success("XML importado com sucesso!")
          setXmlFile(null)
          onDataRefresh?.()
          carregarChecklist()
        } else {
          const res = await importService.xml([fileToUpload])
          const result = res.results?.[0]
          if (result && result.success) {
            const cleanCpfCurrent = (cpf || "").replace(/\D/g, "")
            const cleanCpfResult = (result.cpf || "").replace(/\D/g, "")
            if (cleanCpfCurrent && cleanCpfResult && cleanCpfCurrent !== cleanCpfResult) {
              toast.error("O arquivo XML enviado pertence a outro contribuinte!", {
                description: `O XML pertence a ${result.nome} (CPF: ${formatCPF(result.cpf)}). Por favor, envie o XML correto para este contribuinte.`,
                duration: 8000,
              })
            } else {
              toast.success("XML importado com sucesso!", {
                description: `Declaração criada e dados fiscais importados para ${result.nome}.`,
              })
              setXmlFile(null)
              onDataRefresh?.()
            }
          } else {
            throw new Error(String(result?.error || res.message || "Erro na importação"))
          }
        }
      } catch (e: any) {
        toast.error(e.message || "Erro ao importar XML")
      } finally {
        setImportando(false)
      }
    }

    async function handleDocumento() {
      if (!docFile || !tag || !declaracaoId) return
      const finalTag = tag === "Outros" ? customTag || "Outros" : tag
      setDocLoading(true)
      setExtractionResult(null)
      try {
        const res = await declaracaoIrpfService.uploadDocumento(
          declaracaoId,
          docFile,
          finalTag
        )
        if ((res as any)?.extractionSummary) {
          const summary = (res as any).extractionSummary
          setExtractionResult(summary)
          const totalCampos =
            summary.campos_simples_atualizados +
            summary.bens_criados +
            summary.rendimentos_pj_criados +
            summary.meses_pf_criados
          toast.success(`Documento ${finalTag} processado!`, {
            description: `${totalCampos} campo${totalCampos > 1 ? "s" : ""} atualizado${totalCampos > 1 ? "s" : ""} (${Math.round(summary.confianca * 100)}% confiança)`,
            duration: 6000,
          })
        } else if (res.contribuinteAtualizado?.updated) {
          toast.success(`Documento ${finalTag} processado pela IA!`, {
            description: `Os campos [${res.contribuinteAtualizado.fields.join(", ")}] foram atualizados automaticamente no cadastro.`,
            duration: 6000,
          })
        } else {
          toast.success(`Documento ${finalTag} enviado com sucesso!`)
        }
        setDocFile(null)
        setTag("")
        setCustomTag("")
        onDataRefresh?.()
        carregarChecklist()
      } catch (e: any) {
        toast.error(e.message || "Erro no upload")
      } finally {
        setDocLoading(false)
      }
    }

    const carregarChecklist = useCallback(async () => {
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
    }, [declaracaoId])

    const shouldAutoLoadChecklist = activeTab !== "checklist"

    useEffect(() => {
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

    useEffect(() => {
      if (!highlightedField) return
      const timer = setTimeout(() => setHighlightedField(null), 3000)
      return () => clearTimeout(timer)
    }, [highlightedField])

    useEffect(() => {
      if (activeTab !== "agendamentos" || !cpf) return

      async function loadHistory() {
        setLoadingHistory(true)
        try {
          const res = await schedulingService.list({ cpf: cpf || undefined })
          setSchedulingHistory(res.agendamentos)
        } catch (error) {
          console.error("Erro ao carregar historico:", error)
        } finally {
          setLoadingHistory(false)
        }
      }

      void loadHistory()
    }, [activeTab, cpf])

    const FIELD_TO_CONTRIBUINTE_COLUMN: Record<string, string> = {
      "identificacao.nome_completo": "nome",
      "identificacao.cpf": "cpf",
      "identificacao.data_nascimento": "dataNascimento",
      "identificacao.titulo_eleitor": "tituloEleitor",
      "identificacao.ocupacao_principal": "ocupacaoPrincipal",
      "identificacao.natureza_ocupacao": "naturezaOcupacao",
      "endereco.cep": "enderecoCep",
      "endereco.uf": "enderecoUf",
      "endereco.codigo_municipio_ibge": "enderecoMunicipio",
      "endereco.bairro": "enderecoBairro",
      "endereco.logradouro": "enderecoLogradouro",
      "endereco.numero": "enderecoNumero",
      "endereco.complemento": "enderecoComplemento",
      "contato.email": "email",
      "contato.celular": "telefone",
    }

    const fieldUpdateSeqRef = React.useRef(0)

    async function handleFieldUpdate(fieldPath: string, value: string) {
      const seq = ++fieldUpdateSeqRef.current
      setSavingField(fieldPath)
      try {
        if (declaracaoId) {
          await declaracaoIrpfService.putCampo(declaracaoId, {
            campo: fieldPath,
            valor: value,
          })
          toast.success("Campo atualizado", {
            description: "A alteração foi salva e sincronizada com o XML de exportação.",
          })
        } else if (contribuinteId) {
          const dbColumn = FIELD_TO_CONTRIBUINTE_COLUMN[fieldPath]
          if (!dbColumn) {
            toast.error(`Campo '${fieldPath}' não pode ser editado sem uma declaração.`)
            return
          }
          const payload: Record<string, unknown> = {
            nome: contribuinte?.nome || "",
            [dbColumn]: value,
          }
          await contribuinteService.update(contribuinteId, payload)
          toast.success("Campo atualizado", {
            description: "O dado foi salvo diretamente no cadastro do contribuinte.",
          })
        } else {
          toast.error("Não foi possível identificar o contribuinte para atualização.")
          return
        }

        if (seq === fieldUpdateSeqRef.current) {
          onDataRefresh?.()
          if (declaracaoId) carregarChecklist()
        }
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.erro ||
          e?.response?.data?.motivo ||
          e?.message ||
          "Erro ao salvar campo"
        toast.error(msg)
        console.error("[handleFieldUpdate] erro:", e?.response ?? e)
      } finally {
        if (seq === fieldUpdateSeqRef.current) setSavingField(null)
      }
    }

    async function handleExportar(formato: "xml" | "posicional" | "dec") {
      if (!declaracaoId) return
      setExportando(true)
      try {
        const res = await fetch(`/api/declaracoes/${declaracaoId}/exportar`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anoExercicio, tipo: "O", formato }),
        })
        if (!res.ok) throw new Error("Erro ao exportar arquivo")
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const anoAnterior = anoExercicio - 1
        const ext = formato === "xml" ? "xml" : "DEC"
        a.download = `${contribuinte?.cpf}-IRPF-A-${anoExercicio}-${anoAnterior}-ORIGI.${ext}`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Arquivo gerado!", {
          description: "O download deve iniciar automaticamente.",
        })
      } catch (e: any) {
        toast.error(e.message || "Erro na exportação")
      } finally {
        setExportando(false)
      }
    }

    /* ─── render ─── */

    return (
      <div className="space-y-6">
        {/* TOP TOOLBAR */}
        <div className="flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-xl px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl font-bold border-black/10 hover:bg-black/5"
              onClick={() => router.push("/contribuintes")}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              VOLTAR
            </Button>
            <div className="h-6 w-px bg-black/10 mx-2" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Auditando:
              </span>
              <span className="text-sm font-black text-foreground">
                {contribuinte.nome}
              </span>
              <Badge variant="outline" className="h-5 text-[9px] font-black tracking-widest opacity-60">
                CPF: {formatCPF(contribuinte.cpf)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="px-8 pb-12 space-y-6">
          {/* HEADER */}
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
                        <Badge
                          className={cn(
                            statusClasses,
                            "rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider"
                          )}
                        >
                          {statusLabel}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground/70">
                          <FileText className="h-3 w-3" />
                          {formatCPF(contribuinte.cpf)}
                        </div>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                        <Badge
                          variant="outline"
                          className="h-5 text-[10px] font-bold border-muted-foreground/20"
                        >
                          EXERCÍCIO {anoExercicio}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl font-bold border-muted-foreground/20 hover:bg-primary/5 transition-all group"
                        >
                          {exportando ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileDown className="mr-2 h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                          )}
                          EXPORTAR
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-56 rounded-xl border-white/20 bg-background/80 backdrop-blur-md"
                      >
                        <DropdownMenuItem
                          onClick={() => handleExportar("posicional")}
                          className="cursor-pointer font-bold gap-2"
                        >
                          <FileText className="h-4 w-4 text-primary" />
                          Arquivo .DEC (Layout RFB)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleExportar("xml")}
                          className="cursor-pointer font-bold gap-2 text-xs"
                        >
                          <FileCode className="h-3.5 w-3.5 text-primary" />
                          XML Bruto
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleExportarPdf}
                          className="cursor-pointer font-bold gap-2 text-xs text-emerald-600"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          Dossiê PDF Completo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* KPI CARDS / EMPTY BANNER */}
          {declaration ? (
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
          ) : (
            <Card className="border-none shadow-xl overflow-hidden bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-yellow-500/10 border border-amber-500/20 rounded-[2.5rem]">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-3 max-w-2xl text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-widest">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Declaração Não Iniciada
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-foreground">
                      Este contribuinte não possui nenhuma declaração ativa para o exercício atual.
                    </h3>
                    <p className="text-sm font-bold text-muted-foreground leading-relaxed font-sans">
                      Você pode iniciar o preenchimento manual agora mesmo escolhendo o ano do exercício, ou fazer o upload do arquivo XML anterior para importar e preencher automaticamente todos os bens e dados cadastrais.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto shrink-0">
                    <div className="flex items-center gap-2 bg-background/85 backdrop-blur-sm p-1.5 rounded-2xl border shadow-sm w-full sm:w-auto">
                      <Select value={selectedManualYear} onValueChange={setSelectedManualYear}>
                        <SelectTrigger className="w-[100px] h-10 border-none bg-transparent font-black text-xs shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="2026" className="font-black text-xs">2026</SelectItem>
                          <SelectItem value="2025" className="font-black text-xs">2025</SelectItem>
                          <SelectItem value="2024" className="font-black text-xs">2024</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-10 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md shadow-primary/10"
                        onClick={handleCreateManualDeclaration}
                        disabled={creatingManual}
                      >
                        {creatingManual ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Iniciar Manual"
                        )}
                      </Button>
                    </div>

                    <span className="text-xs font-black text-muted-foreground/60 uppercase">OU</span>

                    <div className="relative w-full sm:w-auto">
                      <input
                        type="file"
                        accept=".xml"
                        className="hidden"
                        id="xml-upload-empty-state"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            await handleImportarXml(file)
                          }
                        }}
                        disabled={importando}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-full sm:w-auto px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 border-primary/20 bg-background/50 hover:bg-primary/5 hover:border-primary/40 transition-all gap-2"
                        asChild
                      >
                        <Label htmlFor="xml-upload-empty-state" className="cursor-pointer flex items-center justify-center h-full w-full">
                          {importando ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Importar XML
                        </Label>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TABS */}
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-5 h-12 bg-muted/30 p-1 rounded-xl">
              <TabsTrigger
                value="dados"
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs"
              >
                Dados
              </TabsTrigger>
              <TabsTrigger
                value="checklist"
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs"
              >
                Checklist IR
              </TabsTrigger>
              <TabsTrigger
                value="documentos"
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs"
              >
                Documentos
              </TabsTrigger>
              <TabsTrigger
                value="bens"
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs"
              >
                Bens
              </TabsTrigger>
              <TabsTrigger
                value="agendamentos"
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs"
              >
                Agendamentos
              </TabsTrigger>
            </TabsList>

            {/* TAB: DADOS */}
            <TabsContent value="dados">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <CardTitle className="text-lg font-bold">
                        Identificação
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {savingField && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 pb-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                      </p>
                    )}
                    <Field
                      label="Nome Completo"
                      value={contribuinte.nome}
                      highlighted={highlightedField === "identificacao.nome_completo"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("identificacao.nome_completo", v)}
                    />
                    <Field
                      label="Natureza Ocupação"
                      value={contribuinte.naturezaOcupacao}
                      highlighted={highlightedField === "identificacao.natureza_ocupacao"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("identificacao.natureza_ocupacao", v)}
                    />
                    <Field
                      label="Ocupação Principal"
                      value={contribuinte.ocupacaoPrincipal}
                      highlighted={highlightedField === "identificacao.ocupacao_principal"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("identificacao.ocupacao_principal", v)}
                    />
                    <Field
                      label="CPF"
                      value={formatCPF(contribuinte.cpf)}
                      highlighted={highlightedField === "identificacao.cpf"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("identificacao.cpf", v)}
                    />
                    <Field
                      label="Data Nascimento"
                      value={formatDate(contribuinte.dataNascimento)}
                      highlighted={highlightedField === "identificacao.data_nascimento"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("identificacao.data_nascimento", v)}
                    />
                    <Field
                      label="Título de Eleitor"
                      value={contribuinte.tituloEleitor}
                      highlighted={highlightedField === "identificacao.titulo_eleitor"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("identificacao.titulo_eleitor", v)}
                    />
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <CardTitle className="text-lg font-bold">
                        Localização & Contato
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <Field
                      label="CEP"
                      value={formatCEP(contribuinte.enderecoCep)}
                      highlighted={highlightedField === "endereco.cep"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("endereco.cep", v)}
                    />
                    <Field
                      label="Endereço"
                      value={contribuinte.enderecoLogradouro}
                      highlighted={highlightedField === "endereco.logradouro"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("endereco.logradouro", v)}
                    />
                    <Field
                      label="Complemento"
                      value={contribuinte.enderecoComplemento}
                      highlighted={highlightedField === "endereco.complemento"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("endereco.complemento", v)}
                    />
                    <Field
                      label="Cidade/UF"
                      value={`${contribuinte.enderecoMunicipio || ""} - ${contribuinte.enderecoUf || ""}`}
                      highlighted={highlightedField === "endereco"}
                    />
                    <Field
                      label="Email"
                      value={contribuinte.email}
                      highlighted={highlightedField === "contato.email"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("contato.email", v)}
                    />
                    <Field
                      label="Telefone/Celular"
                      value={contribuinte.telefone}
                      highlighted={highlightedField === "contato.celular"}
                      editable={!!declaracaoId}
                      onSave={(v) => handleFieldUpdate("contato.celular", v)}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB: CHECKLIST */}
            <TabsContent value="checklist">
              <div className="grid gap-6 lg:grid-cols-12">
                {/* LEFT: checklist items */}
                <div className="lg:col-span-4 xl:col-span-3 space-y-6 h-[calc(100vh-4.5rem)] overflow-y-auto pr-2 scrollbar-none pb-10">
                  {["Dados Pessoais", "Documentos", "Financeiro", "Patrimônio"].map(
                    (category) => {
                      const items = cadastroItems.filter(
                        (i) => i.category === category
                      )
                      if (items.length === 0) return null

                      return (
                        <div
                          key={category}
                          className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
                        >
                          <div className="flex items-center justify-between px-3 py-2 sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm rounded-t-2xl border-x border-t border-muted-foreground/10 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-1.5 rounded-full bg-primary" />
                              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                {category}
                              </h4>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] font-bold border-muted-foreground/10 bg-white/50"
                              >
                                {
                                  items.filter(
                                    (i) => i.ok || manualChecks[i.fieldId] || getDocsForItem(i.fieldId).length > 0
                                  ).length
                                }{" "}
                                / {items.length}
                              </Badge>
                              <div className="w-24 h-1 bg-muted-foreground/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-1000"
                                  style={{
                                    width: `${(items.filter(i => i.ok || manualChecks[i.fieldId] || getDocsForItem(i.fieldId).length > 0).length / items.length) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="bg-background rounded-b-3xl border border-muted-foreground/10 overflow-hidden shadow-sm">
                            {items.map((item, idx) => {
                              const hasDocs = getDocsForItem(item.fieldId).length > 0
                              const isDone = item.ok || manualChecks[item.fieldId] || hasDocs
                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    "p-4 flex items-start justify-between gap-4 transition-all border-b last:border-b-0 hover:bg-muted/5",
                                    isDone && "bg-emerald-50/10"
                                  )}
                                >
                                  {/* LEFT: checkbox + label + docs */}
                                  <div className="flex items-start gap-4 flex-1 min-w-0">
                                    <div className="flex items-center justify-center min-w-[24px] pt-0.5">
                                      <Checkbox
                                        id={`check-${item.fieldId}`}
                                        checked={isDone}
                                        onCheckedChange={() => toggleManualCheck(item.fieldId)}
                                        className="h-5 w-5 rounded-md data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                      <Label
                                        htmlFor={`check-${item.fieldId}`}
                                        className={cn(
                                          "text-sm font-bold cursor-pointer transition-all break-words leading-tight",
                                          isDone
                                            ? "text-muted-foreground line-through opacity-50"
                                            : "text-foreground"
                                        )}
                                      >
                                        {item.label}
                                        {item.ok && (
                                          <CheckCircle2 className="inline ml-2 h-3 w-3 text-emerald-500" />
                                        )}
                                        {!item.ok && hasDocs && (
                                          <Badge variant="outline" className="ml-2 h-4 text-[8px] font-black uppercase border-emerald-200 text-emerald-600 bg-emerald-50/50">
                                            Auditado
                                          </Badge>
                                        )}
                                      </Label>
                                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight line-clamp-1">
                                        {item.ok
                                          ? `Valor: ${item.value}`
                                          : hasDocs
                                            ? "Documento anexado para conferência"
                                            : "Pendente de validação no sistema"}
                                      </p>
                                      {/* Botões de documento — dentro do bloco de texto */}
                                      {getDocsForItem(item.fieldId).length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in-50 duration-500">
                                          {getDocsForItem(item.fieldId).map((doc, dIdx) => (
                                            <Button
                                              key={dIdx}
                                              variant="secondary"
                                              size="sm"
                                              className="h-8 group/doc bg-primary/10 hover:bg-primary text-primary hover:text-white border-none rounded-xl transition-all gap-2 px-4 shadow-sm"
                                              onClick={() => {
                                                if (!doc.url) {
                                                  toast.error("URL do arquivo não disponível.")
                                                  return
                                                }
                                                setViewerDoc(doc)
                                              }}
                                            >
                                              <FileText className="h-3.5 w-3.5" />
                                              <span className="text-[10px] font-black uppercase tracking-widest max-w-[120px] truncate">
                                                Ver {doc.tag || "Documento"}
                                              </span>
                                              <Maximize2 className="h-3 w-3 opacity-0 group-hover/doc:opacity-100 transition-all scale-0 group-hover/doc:scale-100" />
                                            </Button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* RIGHT: action button */}
                                  <div className="flex flex-col items-end gap-2 shrink-0 self-start mt-1">
                                    {(!item.ok || manualChecks[item.fieldId]) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                          "h-7 pr-1 pl-3 rounded-lg text-[9px] font-black tracking-widest text-primary hover:bg-primary/10 transition-all group",
                                          manualChecks[item.fieldId] && "text-emerald-600 bg-emerald-50/50"
                                        )}
                                        onClick={() => {
                                          if (item.type === "doc") {
                                            setTag(item.fieldId)
                                            handleTabChange("documentos")
                                          } else {
                                            handleTabChange("dados")
                                            setHighlightedField(item.fieldId)
                                          }
                                        }}
                                      >
                                        {manualChecks[item.fieldId]
                                          ? "CONFERIDO"
                                          : item.type === "doc"
                                            ? "ANEXAR"
                                            : "PREENCHER"}
                                        <ArrowRight className="ml-1.5 h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>

                {/* RIGHT: document viewer */}
                <div className={cn(
                  "lg:col-span-8 xl:col-span-9 sticky top-4 h-[calc(100vh-4rem)] pb-4 transition-all duration-500",
                  isViewerMaximized && "fixed inset-0 z-[100] h-screen w-screen p-0 m-0 bg-background/80 backdrop-blur-2xl"
                )}>
                  <Card className={cn(
                    "border-none shadow-sm overflow-hidden h-full flex flex-col bg-white/50 backdrop-blur-sm transition-all",
                    isViewerMaximized && "rounded-none bg-background shadow-2xl"
                  )}>
                    <CardHeader className="px-6 py-3 border-b bg-muted/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2">
                              Visualizador
                              {viewerDoc?.confianca_extracao !== undefined && (
                                <Badge
                                  className={cn(
                                    "h-4 text-[8px] font-black px-1.5 border-none",
                                    viewerDoc.confianca_extracao >= 0.8
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : viewerDoc.confianca_extracao >= 0.5
                                        ? "bg-amber-500/10 text-amber-600"
                                        : "bg-red-500/10 text-red-600"
                                  )}
                                >
                                  IA {Math.round(viewerDoc.confianca_extracao * 100)}%
                                </Badge>
                              )}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-0.5">
                              <CardDescription className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 truncate max-w-[150px]">
                                {viewerDoc?.nome_arquivo || "Selecione"}
                              </CardDescription>
                              {viewerDoc && (
                                <div className="flex items-center gap-2 border-l pl-2 border-muted-foreground/10">
                                  <span className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-tighter truncate max-w-[100px]">
                                    {viewerDoc.origem} •{" "}
                                    {viewerDoc.recebido_em
                                      ? formatDate(viewerDoc.recebido_em)
                                      : "--"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {viewerDoc && (
                            <div className="flex items-center gap-1 mr-4 border-r pr-4 border-muted-foreground/10 bg-muted/5 p-1 rounded-lg">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-primary">
                                <ZoomOut className="h-3.5 w-3.5" />
                              </Button>
                              <span className="text-[10px] font-black text-muted-foreground px-1 min-w-[32px] text-center tracking-tighter">100%</span>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-primary">
                                <ZoomIn className="h-3.5 w-3.5" />
                              </Button>
                              <div className="w-px h-3 bg-muted-foreground/20 mx-1" />
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-primary">
                                <RotateCw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                          {viewerDoc && (
                            <>
                              {viewerDoc.tag && !manualChecks[viewerDoc.tag] && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 font-black text-[10px] gap-2 rounded-lg px-3 shadow-sm mr-2"
                                  onClick={() => {
                                    toggleManualCheck(viewerDoc.tag)
                                    toast.success("Documento validado com sucesso!")
                                  }}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  VALIDAR
                                </Button>
                              )}
                              {viewerDoc.url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all"
                                  onClick={() => window.open(viewerDoc.url!, "_blank")}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "h-8 w-8 p-0 rounded-lg hover:bg-primary/5 transition-all text-muted-foreground",
                                  isViewerMaximized && "bg-primary/10 text-primary"
                                )}
                                onClick={() => setIsViewerMaximized(!isViewerMaximized)}
                              >
                                {isViewerMaximized ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-auto px-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all text-muted-foreground gap-2"
                                onClick={() => {
                                  setViewerDoc(null)
                                  setIsViewerMaximized(false)
                                }}
                              >
                                <span className="text-[10px] font-black uppercase tracking-widest">Fechar</span>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-0 flex-1 overflow-hidden relative group">
                      {viewerDoc ? (
                        <div className="h-full bg-white relative">
                          {!viewerDoc.url ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm font-bold p-6 text-center">
                              <AlertCircle className="h-10 w-10 mb-2 opacity-20" />
                              URL do arquivo indisponível.
                            </div>
                          ) : viewerDoc.media_type?.includes("pdf") ? (
                            <iframe
                              title="viewer-pdf"
                              src={viewerDoc.url}
                              className="w-full h-full border-none bg-white"
                            />
                          ) : (
                            <img
                              src={viewerDoc.url}
                              alt={viewerDoc.nome_arquivo}
                              className="w-full h-full object-contain bg-white"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                          <div className="relative mb-6">
                            <div className="absolute inset-0 animate-ping rounded-full bg-primary/5 scale-150 opacity-10" />
                            <div className="relative h-20 w-20 rounded-[2rem] bg-muted/30 flex items-center justify-center border border-dashed border-muted-foreground/10">
                              <FolderOpen className="h-10 w-10 text-muted-foreground/20" />
                            </div>
                          </div>
                          <h3 className="text-lg font-black text-foreground/40 tracking-tight">
                            Aguardando Documento
                          </h3>
                          <p className="text-xs font-medium text-muted-foreground/50 mt-2 max-w-[200px] leading-relaxed">
                            Selecione um anexo no checklist para visualizar os detalhes aqui.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
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
                      <CardTitle className="text-lg font-bold">
                        Fontes Externas
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 flex-1 flex flex-col justify-center">
                    <div className="p-8 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 group cursor-pointer hover:bg-primary/10 transition-all text-center">
                      <input
                        type="file"
                        accept=".xml"
                        className="hidden"
                        id="xml-upload-main"
                        onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)}
                      />
                      <Label htmlFor="xml-upload-main" className="cursor-pointer block">
                        <FileUp className="h-10 w-10 text-primary mx-auto mb-3 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                        <p className="text-sm font-black text-foreground">
                          Importar Declaração Anterior (XML)
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                          Sincroniza automaticamente bens, dívidas e dados cadastrais
                          da receita federal.
                        </p>
                      </Label>
                    </div>
                    <Button
                      className="w-full h-12 rounded-xl font-bold transition-all"
                      variant={xmlFile ? "default" : "outline"}
                      onClick={() => handleImportarXml()}
                      disabled={importando || !xmlFile}
                    >
                      {importando ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Package className="h-4 w-4 mr-2" />
                      )}
                      {xmlFile ? `IMPORTAR "${xmlFile.name}"` : "SELECIONE UM ARQUIVO XML"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm h-full flex flex-col">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      <CardTitle className="text-lg font-bold">
                        Repositório de Documentos
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        Tipo de Documento
                      </Label>
                      <Select value={tag} onValueChange={setTag}>
                        <SelectTrigger className="h-12 rounded-xl focus:ring-primary bg-muted/20 border-none">
                          <SelectValue placeholder="Selecione a categoria..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TAGS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {tag === "Outros" && (
                      <Input
                        placeholder="Especifique o nome do documento..."
                        className="h-12 rounded-xl border-primary/20 focus:ring-primary shadow-sm animate-in fade-in slide-in-from-top-2"
                        value={customTag}
                        onChange={(e) => setCustomTag(e.target.value)}
                      />
                    )}

                    <div className="relative group space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        Arquivo
                      </Label>
                      <div className="relative">
                        <Input
                          type="file"
                          accept="image/*,application/pdf"
                          className="h-12 pt-3 rounded-xl border-dashed border-2 opacity-0 absolute inset-0 z-10 cursor-pointer"
                          onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                        />
                        <div className="h-12 rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/10 group-hover:bg-muted/20 transition-all border-muted-foreground/20">
                          <p className="text-sm font-bold text-muted-foreground">
                            {docFile ? docFile.name : "Arraste PDF ou Imagem aqui"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full h-12 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all"
                      disabled={
                        docLoading ||
                        !docFile ||
                        !tag ||
                        (tag === "Outros" && !customTag)
                      }
                      onClick={handleDocumento}
                    >
                      {docLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      EFETUAR UPLOAD AGORA
                    </Button>

                    {extractionResult && (
                      <ExtractionResultBadge
                        confianca={extractionResult.confianca}
                        origem={
                          extractionResult.confianca >= 0.5
                            ? "anchor_parser"
                            : "claude_ocr"
                        }
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
              </div>
            </TabsContent>

            {/* TAB: BENS */}
            <TabsContent value="bens">
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/5 border-b py-6">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-black tracking-tight">
                          Relação de Bens e Direitos
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-primary flex items-center gap-1.5 mt-0.5">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          {filteredAssets.length} registros auditados no sistema
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        className="h-11 rounded-xl font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-primary/20"
                        onClick={openNewBemDialog}
                        disabled={!declaracaoId}
                      >
                        <Package className="mr-2 h-4 w-4" />
                        Novo Bem
                      </Button>
                      <div className="relative w-[320px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                        <Input
                          placeholder="Pesquisar por descrição..."
                          className="pl-10 h-11 rounded-xl bg-background border-muted-foreground/10 focus:ring-primary shadow-sm"
                          value={assetSearch}
                          onChange={(e) => setAssetSearch(e.target.value)}
                        />
                      </div>
                      <Select
                        value={assetGroupFilter}
                        onValueChange={setAssetGroupFilter}
                      >
                        <SelectTrigger className="w-[200px] h-11 rounded-xl bg-background border-muted-foreground/10 shadow-sm">
                          <SelectValue placeholder="Todos Grupos" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="all" className="font-bold">
                            Todos os Grupos
                          </SelectItem>
                          {Object.entries(GRUPOS_BENS).map(([id, label]) => (
                            <SelectItem key={id} value={id} className="text-xs font-semibold">
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {!assets || assets.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center">
                      <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                        <Package className="h-10 w-10 text-muted-foreground/20" />
                      </div>
                      <h3 className="text-lg font-black text-foreground/40">
                        Nenhum bem declarado
                      </h3>
                      <p className="text-sm text-muted-foreground/60 mt-2 max-w-xs">
                        {!declaracaoId
                          ? "Por favor, inicialize a declaração do contribuinte no topo da página para lançar bens manualmente."
                          : "Os bens aparecerão aqui após a importação do XML ou lançamento manual."}
                      </p>
                    </div>
                  ) : filteredAssets.length > 50 ? (
                    <div className="h-[700px] w-full">
                      <Virtuoso
                        data={filteredAssets}
                        itemContent={(index, asset) => (
                          <div className="p-6 border-b last:border-b-0 hover:bg-primary/[0.02] transition-all bg-background group cursor-default">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div className="max-w-2xl">
                                <div className="mb-2 flex gap-2">
                                  <Badge className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black tracking-[0.1em] rounded-lg px-2 py-0.5">
                                    GRUPO {asset.grupo}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-black border-muted-foreground/10 rounded-lg px-2 py-0.5 opacity-60"
                                  >
                                    COD {asset.codigo}
                                  </Badge>
                                </div>
                                <h4 className="font-bold text-[13px] tracking-tight leading-relaxed group-hover:text-primary transition-colors pr-8">
                                  {asset.descricao}
                                </h4>
                              </div>
                              <div className="flex gap-12 shrink-0 bg-muted/20 p-4 rounded-2xl group-hover:bg-primary/5 transition-colors">
                                <div className="text-right">
                                  <p className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.15em] mb-1.5 opacity-60">
                                    Posição 2023
                                  </p>
                                  <p className="font-bold text-sm text-foreground/80 tracking-tight">
                                    {formatCurrency(asset.valorAnterior)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] uppercase font-black text-primary tracking-[0.15em] mb-1.5">
                                    Posição 2024
                                  </p>
                                  <p className="font-black text-base text-primary tracking-tight">
                                    {formatCurrency(asset.valorAtual)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-muted/50">
                      {paginatedAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="p-6 hover:bg-primary/[0.03] transition-all bg-background group flex items-center justify-between"
                        >
                          <div className="max-w-2xl">
                            <div className="mb-2.5 flex gap-2">
                              <Badge className="bg-muted text-muted-foreground text-[9px] font-black tracking-widest rounded-lg px-2 py-0.5">
                                GRUPO {asset.grupo}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-[9px] font-black border-muted-foreground/10 rounded-lg px-2 py-0.5"
                              >
                                CÓDIGO {asset.codigo}
                              </Badge>
                            </div>
                            <h4 className="font-bold text-sm leading-snug text-foreground/90">
                              {asset.descricao}
                            </h4>
                          </div>
                          <div className="flex gap-12 text-right">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">
                                Anterior
                              </p>
                              <p className="font-bold text-sm tracking-tight">
                                {formatCurrency(asset.valorAnterior)}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                                Atual
                              </p>
                              <p className="font-black text-base text-primary tracking-tight">
                                {formatCurrency(asset.valorAtual)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 pl-6">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                                onClick={() => openEditBemDialog(asset)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all"
                                onClick={() => handleDeleteBem(asset.id)}
                                disabled={deletingBemId === asset.id}
                              >
                                {deletingBemId === asset.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {totalPages > 1 && (
                        <div className="p-6 flex items-center justify-between bg-muted/10 border-t">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <p className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">
                              Exibindo {paginatedAssets.length} de{" "}
                              {filteredAssets.length} registros
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 px-4 rounded-xl font-bold bg-background border-muted-foreground/20 hover:bg-primary/5"
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage((p) => p - 1)}
                            >
                              <ChevronLeft className="h-4 w-4 mr-2" /> ANTERIOR
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 px-4 rounded-xl font-bold bg-background border-muted-foreground/20 hover:bg-primary/5"
                              disabled={currentPage === totalPages}
                              onClick={() => setCurrentPage((p) => p + 1)}
                            >
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

            {/* TAB: AGENDAMENTOS */}
            <TabsContent value="agendamentos">
              <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-muted/5 border-b py-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                        <CalendarDays className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-black tracking-tight">
                          Dossiê de Agendamentos
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                          Histórico de consultas e status de documentos vinculados
                        </CardDescription>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="h-9 rounded-xl font-black text-[10px] uppercase tracking-widest"
                      onClick={() => router.push("/agendamentos")}
                    >
                      NOVO AGENDAMENTO
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mr-3" />
                      Carregando histórico...
                    </div>
                  ) : schedulingHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="rounded-full bg-slate-100 p-4 mb-4">
                        <CalendarDays className="h-8 w-8 text-slate-300" />
                      </div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-relaxed px-10">
                        Nenhum agendamento encontrado para este CPF.
                      </h3>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {schedulingHistory.map((s) => (
                        <div key={s.id} className="p-6 transition-all hover:bg-slate-50 group">
                          <div className="flex flex-col gap-6 md:flex-row md:items-center">
                            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white border-2 border-slate-100 shadow-sm group-hover:border-primary/20 group-hover:shadow-md transition-all">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {format(parseISO(s.dataAgendamento), "MMM", { locale: ptBR })}
                              </span>
                              <span className="text-xl font-black text-slate-900">
                                {format(parseISO(s.dataAgendamento), "d")}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex items-center gap-3">
                                <h4 className="truncate text-lg font-black tracking-tight text-slate-900">{s.titulo}</h4>
                                <Badge className={cn("rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-wider", getStatusColor(s.status))}>
                                  {getStatusLabel(s.status)}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3" /> {s.horaInicio || "--:--"}
                                </span>
                                {s.tipo && (
                                  <span className="flex items-center gap-1.5">
                                    <FileText className="h-3 w-3" /> {s.tipo}
                                  </span>
                                )}
                                {s.checklistProgress && (
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-lg border",
                                    s.checklistProgress.percentage >= 80
                                      ? "border-emerald-200 text-emerald-600 bg-emerald-50"
                                      : "border-slate-100 text-slate-500"
                                  )}>
                                    {s.checklistProgress.received}/{s.checklistProgress.total} DOCS
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 border-slate-100 hover:border-primary/20 bg-white"
                                onClick={() => router.push(`/agendamentos?id=${s.id}`)}
                              >
                                DETALHES
                                <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* DIALOG: CRUD BENS */}
          <Dialog open={isBemDialogOpen} onOpenChange={setIsBemDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] bg-background/95 backdrop-blur-xl border-primary/10 shadow-2xl">
              <DialogHeader className="pb-4 border-b border-muted">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-3xl font-black tracking-tight flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        {editingBem ? <Pencil className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                      </div>
                      {editingBem ? "Editar Patrimônio" : "Novo Bem / Direito"}
                    </DialogTitle>
                    <DialogDescription className="font-bold text-[10px] uppercase tracking-[0.2em] text-primary/60 mt-2 flex items-center gap-2">
                      <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
                      Ficha de Bens e Direitos - IRPF {anoExercicio}
                    </DialogDescription>
                  </div>
                  {!editingBem && (
                    <Button
                      variant="ghost" 
                      size="sm"
                      className="rounded-xl font-black text-[10px] tracking-widest text-primary hover:bg-primary/5 px-4"
                      onClick={generateDescricao}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      GERAR DESCRIÇÃO
                    </Button>
                  )}
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-6">
                {/* Coluna Principal: Formulário Inteligente */}
                <div className="lg:col-span-12 space-y-8">
                  
                  {/* Seção 1: Classificação */}
                  <div className="bg-muted/30 p-6 rounded-[2rem] border border-muted-foreground/5">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                       <Filter className="h-3 w-3" /> Classificação do Bem
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground/70">Grupo</Label>
                        <Select
                          value={bemForm.grupo}
                          onValueChange={(v) => {
                            const firstCode = Object.keys(CODIGOS_BENS[v] || {})[0] || ""
                            setBemForm({ ...bemForm, grupo: v, codigo: firstCode })
                          }}
                        >
                          <SelectTrigger className="h-14 rounded-2xl border-muted-foreground/10 bg-background shadow-sm hover:border-primary/30 transition-all font-bold text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            {Object.entries(GRUPOS_BENS).map(([id, label]) => (
                              <SelectItem key={id} value={id} className="font-semibold text-xs py-3">{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground/70">Código</Label>
                        <Select
                          value={bemForm.codigo}
                          onValueChange={(v) => setBemForm({ ...bemForm, codigo: v })}
                        >
                          <SelectTrigger className="h-14 rounded-2xl border-muted-foreground/10 bg-background shadow-sm hover:border-primary/30 transition-all font-bold text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl max-h-[300px]">
                            {Object.entries(CODIGOS_BENS[bemForm.grupo] || { "99": "Outros" }).map(([id, label]) => (
                              <SelectItem key={id} value={id} className="font-semibold text-xs py-3">{id} - {label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Seção 2: Campos Dinâmicos (Condicionais) */}
                  {bemForm.grupo === "01" && (
                    <div className="bg-primary/[0.02] p-6 rounded-[2rem] border border-primary/10 animate-in fade-in slide-in-from-top-2">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                         <Building2 className="h-3 w-3" /> Detalhes do Imóvel
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase ml-1">Insc. Municipal (IPTU)</Label>
                          <Input
                            placeholder="000000000"
                            className="h-12 rounded-xl bg-background font-bold"
                            value={bemForm.iptu}
                            onChange={(e) => setBemForm({...bemForm, iptu: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase ml-1">Data Aquisição</Label>
                          <Input
                            type="date"
                            className="h-12 rounded-xl bg-background font-bold"
                            value={bemForm.dataAquisicao}
                            onChange={(e) => setBemForm({...bemForm, dataAquisicao: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase ml-1">Área Total</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="0.00"
                              className="h-12 rounded-xl bg-background font-bold flex-1"
                              value={bemForm.areaTotal}
                              onChange={(e) => setBemForm({...bemForm, areaTotal: e.target.value})}
                            />
                            <Select
                              value={bemForm.areaUnidade}
                              onValueChange={(v) => setBemForm({...bemForm, areaUnidade: v})}
                            >
                              <SelectTrigger className="w-20 h-12 rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="m2">m²</SelectItem>
                                <SelectItem value="ha">ha</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="md:col-span-3">
                           <div className="flex items-center space-x-3 bg-background p-4 rounded-xl border border-muted mb-4">
                             <Checkbox 
                                id="registrado" 
                                checked={bemForm.registradoCartorio}
                                onCheckedChange={(checked) => setBemForm({...bemForm, registradoCartorio: !!checked})}
                             />
                             <Label htmlFor="registrado" className="text-xs font-black uppercase tracking-wider cursor-pointer">Registrado em Cartório?</Label>
                           </div>
                           {bemForm.registradoCartorio && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in zoom-in-95">
                                <Input placeholder="Nome do Cartório" className="h-12 rounded-xl font-bold" value={bemForm.cartorioNome} onChange={(e) => setBemForm({...bemForm, cartorioNome: e.target.value})} />
                                <Input placeholder="Matrícula / Registro" className="h-12 rounded-xl font-bold" value={bemForm.cartorioMatricula} onChange={(e) => setBemForm({...bemForm, cartorioMatricula: e.target.value})} />
                             </div>
                           )}
                        </div>
                      </div>
                    </div>
                  )}

                  {bemForm.grupo === "02" && bemForm.codigo === "01" && (
                     <div className="bg-primary/[0.02] p-6 rounded-[2rem] border border-primary/10 animate-in fade-in slide-in-from-top-2">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                         <Car className="h-3 w-3" /> Detalhes do Veículo
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase ml-1">RENAVAM</Label>
                          <Input
                            placeholder="00000000000"
                            className="h-12 rounded-xl bg-background font-bold"
                            value={bemForm.renavam}
                            onChange={(e) => setBemForm({...bemForm, renavam: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase ml-1">Placa</Label>
                          <Input
                            placeholder="ABC-1234"
                            className="h-12 rounded-xl bg-background font-bold"
                            value={bemForm.placa}
                            onChange={(e) => setBemForm({...bemForm, placa: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {["03", "04", "06", "07"].includes(bemForm.grupo) && (
                     <div className="bg-primary/[0.02] p-6 rounded-[2rem] border border-primary/10 animate-in fade-in slide-in-from-top-2">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                         <CreditCard className="h-3 w-3" /> Dados da Instituição / Empresa
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase ml-1">CNPJ</Label>
                          <Input
                            placeholder="00.000.000/0000-00"
                            className="h-12 rounded-xl bg-background font-bold"
                            value={bemForm.cnpjInst}
                            onChange={(e) => setBemForm({...bemForm, cnpjInst: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase ml-1">Nome da Instituição</Label>
                          <Input
                            placeholder="Ex: Banco Itaú S.A."
                            className="h-12 rounded-xl bg-background font-bold"
                            value={bemForm.nomeInst}
                            onChange={(e) => setBemForm({...bemForm, nomeInst: e.target.value})}
                          />
                        </div>
                        <div className="md:col-span-2 grid grid-cols-3 gap-4">
                           <div className="space-y-1">
                             <Label className="text-[9px] font-black text-muted-foreground uppercase">Agência</Label>
                             <Input className="h-10 rounded-lg font-bold" value={bemForm.agencia} onChange={(e) => setBemForm({...bemForm, agencia: e.target.value})} />
                           </div>
                           <div className="space-y-1">
                             <Label className="text-[9px] font-black text-muted-foreground uppercase">Conta</Label>
                             <Input className="h-10 rounded-lg font-bold" value={bemForm.conta} onChange={(e) => setBemForm({...bemForm, conta: e.target.value})} />
                           </div>
                           <div className="space-y-1">
                             <Label className="text-[9px] font-black text-muted-foreground uppercase">DV</Label>
                             <Input className="h-10 rounded-lg font-bold" value={bemForm.digito} onChange={(e) => setBemForm({...bemForm, digito: e.target.value})} />
                           </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Seção 3: Discriminação (Texto Final) */}
                  <div className="space-y-2 relative">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground/70 flex items-center justify-between">
                      <span>Discriminação (Consolidado para Receita)</span>
                      <span className="text-[9px] font-normal text-muted-foreground lowercase">{bemForm.descricao.length} caracteres</span>
                    </Label>
                    <div className="relative group">
                      <Textarea
                        className="rounded-3xl min-h-[160px] text-[13px] font-bold leading-relaxed border-muted-foreground/10 bg-muted/10 focus-visible:ring-primary/20 p-6 resize-none transition-all group-hover:bg-muted/20"
                        placeholder="Clique em 'GERAR DESCRIÇÃO' após preencher os dados acima ou digite manualmente..."
                        value={bemForm.descricao}
                        onChange={(e) => setBemForm({ ...bemForm, descricao: e.target.value })}
                      />
                      <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <Sparkles className="h-4 w-4" />
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção 4: Valores */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-muted pt-8">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground/50">
                        Situação em 31/12/{anoExercicio - 1} (Anterior)
                      </Label>
                      <div className="relative">
                        <Input
                          className="h-16 rounded-[1.25rem] font-black text-lg bg-background border-muted-foreground/10 shadow-inner px-6 text-muted-foreground/60"
                          value={bemForm.valorAnterior}
                          onChange={(e) => setBemForm({ ...bemForm, valorAnterior: maskBRL(e.target.value) })}
                        />
                         <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-muted rounded-l-[1.25rem]" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-primary">
                        Situação em 31/12/{anoExercicio} (Atual)
                      </Label>
                      <div className="relative">
                        <Input
                          className="h-16 rounded-[1.25rem] font-black text-xl bg-primary/[0.03] border-primary/20 shadow-inner px-6 text-primary focus-visible:ring-primary/30"
                          value={bemForm.valorAtual}
                          onChange={(e) => setBemForm({ ...bemForm, valorAtual: maskBRL(e.target.value) })}
                        />
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-l-[1.25rem]" />
                        <TrendingUp className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-6 border-t border-muted">
                <Button
                  variant="ghost"
                  className="h-14 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-muted"
                  onClick={() => setIsBemDialogOpen(false)}
                >
                  DESCARTAR
                </Button>
                <Button
                  className="h-14 rounded-2xl px-12 font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary/30 active:scale-95 transition-all bg-primary"
                  onClick={handleSaveBem}
                  disabled={savingBem}
                >
                  {savingBem ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4" />
                      FINALIZAR E SALVAR
                    </div>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )
  }
)

export default ContribuinteDetails