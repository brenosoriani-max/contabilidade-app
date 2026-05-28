"use client"

import React, {
  ReactNode,
  useCallback,
  useMemo,
  useEffect,
  useState,
  memo,
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
  Package,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  Search,
  ArrowRight,
  Filter,
  FolderOpen,
  FileCode,
  CalendarDays,
  Clock,
  Trash2,
  Pencil,
  X,
  Sparkles,
  Car,
  CreditCard,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Archive,
  Layout,
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

import {
  declaracaoIrpfService,
  schedulingService,
  importService,
  contribuinteService,
} from "@/lib/api/services"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { AppHeader } from "@/components/app-header"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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



interface Props {
  declaration: Declaration | null
  contribuinte: ContribuinteSummary | null
  assets?: BemDireito[]
  onDataRefresh?: () => void
}

type ViewerDocument = {
  tag: string
  fieldId?: string
  nome_arquivo: string
  tamanho_bytes: number
  media_type: string
  url: string | null
  origem: string
  recebido_em: string
  confianca_extracao?: number
}

const ITEMS_PER_PAGE = 8

const SCHEDULING_CHECKLIST_FIELD: Record<string, string> = {
  "rg-cnh": "identificacao.rg",
  cpf: "identificacao.cpf",
  "comprovante-residencia": "endereco.logradouro",
  "informe-rendimentos-empregador": "rendimentos.pj",
  "informe-rendimentos-bancarios": "rendimentos.pj",
  "extrato-previdencia-privada": "financeiro.extrato",
  "carne-leao": "rendimentos.pj",
}

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
    "01": "Veículo automotor terrestre",
    "02": "Aeronave",
    "03": "Embarcação",
    "99": "Outros bens móveis",
  },
  "03": {
    "01": "Ações",
    "02": "Quotas ou quinhões de capital",
    "99": "Outras participações societárias",
  },
  "04": {
    "01": "Caderneta de poupança",
    "02": "Ativos financeiros",
    "03": "Títulos públicos e privados sujeitos a tributação",
    "99": "Outras aplicações e investimentos",
  },
  "05": {
    "01": "Crédito com pessoa física",
    "02": "Crédito com pessoa jurídica",
    "03": "Empréstimos concedidos",
    "04": "Adiantamentos a terceiros",
    "99": "Outros créditos",
  },
  "06": {
    "01": "Depósito em conta corrente no País",
    "02": "Depósito em conta corrente no Exterior",
    "99": "Outros depósitos à vista e numerário",
  },
  "07": {
    "01": " Investimento Imobiliário",
    "02": " Investimento em Ações",
    "03": " Investimento em Índice de Mercado",
    "99": "Outros fundos",
  },
  "08": {
    "01": "Criptoativo Bitcoin (BTC)",
    "02": "Outras criptomoedas (Altcoins)",
    "03": "Stablecoins",
    "10": "NFTs",
    "99": "Outros criptoativos",
  },
  "09": {
    "01": "Outros bens e direitos",
  },
}



interface BemForm {
  grupo: string
  codigo: string
  descricao: string
  valorAnterior: string
  valorAtual: string
  // Imóveis
  iptu: string
  dataAquisicao: string
  areaTotal: string
  areaUnidade: string
  registradoCartorio: boolean
  cartorioNome: string
  cartorioMatricula: string
  // Veículos
  renavam: string
  placa: string
  // Instituições / Empresas
  cnpjInst: string
  nomeInst: string
  agencia: string
  conta: string
  digito: string
  // Criptoativos
  siglaMoeda: string
  quantidade: string
  exchange: string
  custodiaPropria: boolean
}

const EMPTY_BEM_FORM: BemForm = {
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
  siglaMoeda: "",
  quantidade: "",
  exchange: "",
  custodiaPropria: false,
}



const inputCls =
  "h-12 rounded-xl bg-background font-bold border-muted-foreground/10 focus-visible:ring-primary/20 focus-visible:border-primary/30 transition-colors"

const inputSmCls = "h-10 rounded-lg font-bold border-muted-foreground/10 focus-visible:ring-primary/20"

const SectionTitle = memo(({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <h5 className="text-[10px] font-black uppercase tracking-widest text-primary mb-5 flex items-center gap-2">
    {icon} {label}
  </h5>
))
SectionTitle.displayName = "SectionTitle"

const FieldGroup = memo(
  ({ label, children, small, colSpan }: { label: string; children: React.ReactNode; small?: boolean; colSpan?: string }) => (
    <div className={cn("space-y-2", colSpan)}>
      <Label className={cn("font-black uppercase ml-1", small ? "text-[9px] tracking-wider text-muted-foreground" : "text-[10px] tracking-widest text-muted-foreground/70")}>
        {label}
      </Label>
      {children}
    </div>
  )
)
FieldGroup.displayName = "FieldGroup"


type ChangeHandler = (field: keyof BemForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
type SelectHandler = (field: keyof BemForm) => (v: string) => void
type CheckboxHandler = (field: keyof BemForm) => (checked: boolean) => void

const SecaoImovel = memo(
  ({
    form,
    onChange,
    onSelect,
    onCheckbox,
  }: {
    form: BemForm
    onChange: ChangeHandler
    onSelect: SelectHandler
    onCheckbox: CheckboxHandler
  }) => (
    <div className="bg-primary/[0.02] p-6 rounded-[2rem] border border-primary/10 animate-in fade-in slide-in-from-top-2 duration-200">
      <SectionTitle icon={<Building2 className="h-3.5 w-3.5" />} label="Detalhes do Imóvel" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <FieldGroup label="Insc. Municipal (IPTU)">
          <Input placeholder="000000000" className={inputCls} value={form.iptu} onChange={onChange("iptu")} />
        </FieldGroup>

        <FieldGroup label="Data de Aquisição">
          <Input type="date" className={inputCls} value={form.dataAquisicao} onChange={onChange("dataAquisicao")} />
        </FieldGroup>

        <FieldGroup label="Área Total">
          <div className="flex items-center gap-2">
            <Input placeholder="0,00" className={cn(inputCls, "flex-1")} value={form.areaTotal} onChange={onChange("areaTotal")} />
            <Select value={form.areaUnidade} onValueChange={onSelect("areaUnidade")}>
              <SelectTrigger className="w-24 h-12 rounded-xl font-bold text-sm border-muted-foreground/10 bg-background shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="m2" className="text-xs font-semibold">m²</SelectItem>
                <SelectItem value="ha" className="text-xs font-semibold">ha</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FieldGroup>

        <div className="md:col-span-3 space-y-3">
          <label className="flex items-center gap-3 bg-background px-4 py-3 rounded-xl border border-muted cursor-pointer group w-fit">
            <Checkbox
              id="registrado"
              checked={!!form.registradoCartorio}
              onCheckedChange={onCheckbox("registradoCartorio")}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="text-[10px] font-black uppercase tracking-wider group-hover:text-primary transition-colors">
              Registrado em Cartório?
            </span>
          </label>

          {form.registradoCartorio && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in zoom-in-95 duration-150">
              <Input placeholder="Nome do Cartório" className={inputCls} value={form.cartorioNome} onChange={onChange("cartorioNome")} />
              <Input placeholder="Matrícula / Registro" className={inputCls} value={form.cartorioMatricula} onChange={onChange("cartorioMatricula")} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
)
SecaoImovel.displayName = "SecaoImovel"

const SecaoVeiculo = memo(
  ({ form, onChange }: { form: BemForm; onChange: ChangeHandler }) => (
    <div className="bg-primary/[0.02] p-6 rounded-[2rem] border border-primary/10 animate-in fade-in slide-in-from-top-2 duration-200">
      <SectionTitle icon={<Car className="h-3.5 w-3.5" />} label="Detalhes do Veículo" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FieldGroup label="RENAVAM">
          <Input placeholder="00000000000" className={inputCls} value={form.renavam} onChange={onChange("renavam")} />
        </FieldGroup>
        <FieldGroup label="Placa">
          <Input placeholder="ABC-1234" className={cn(inputCls, "uppercase")} value={form.placa} onChange={onChange("placa")} />
        </FieldGroup>
      </div>
    </div>
  )
)
SecaoVeiculo.displayName = "SecaoVeiculo"

const SecaoInstituicao = memo(
  ({ form, onChange }: { form: BemForm; onChange: ChangeHandler }) => (
    <div className="bg-primary/[0.02] p-6 rounded-[2rem] border border-primary/10 animate-in fade-in slide-in-from-top-2 duration-200">
      <SectionTitle icon={<CreditCard className="h-3.5 w-3.5" />} label="Dados da Instituição / Empresa" />
      <div className="md:col-span-2 grid grid-cols-3 gap-4">
  <FieldGroup label="Agência" small>
    <Input
      className={inputSmCls}
      value={form.agencia}
      onChange={onChange("agencia")}
      placeholder="0000"
      autoComplete="off"
    />
  </FieldGroup>
  <FieldGroup label="Conta" small>
    <Input
      className={inputSmCls}
      value={form.conta}
      onChange={onChange("conta")}
      placeholder="00000"
      autoComplete="off"
    />
  </FieldGroup>
  <FieldGroup label="DV" small>
    <Input
      className={inputSmCls}
      value={form.digito}
      onChange={onChange("digito")}
      placeholder="0"
      autoComplete="off"
    />
  </FieldGroup>
</div>
    </div>
  )
)
SecaoInstituicao.displayName = "SecaoInstituicao"

const SecaoCripto = memo(
  ({
    form,
    onChange,
    onCheckbox,
  }: {
    form: BemForm
    onChange: ChangeHandler
    onCheckbox: CheckboxHandler
  }) => (
    <div className="bg-primary/[0.02] p-6 rounded-[2rem] border border-primary/10 animate-in fade-in slide-in-from-top-2 duration-200">
      <SectionTitle icon={<Sparkles className="h-3.5 w-3.5" />} label="Detalhes do Criptoativo" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FieldGroup label="Sigla (Ex: BTC, ETH)">
          <Input placeholder="BTC" className={cn(inputCls, "uppercase")} value={form.siglaMoeda} onChange={onChange("siglaMoeda")} />
        </FieldGroup>
        <FieldGroup label="Quantidade">
          <Input placeholder="0,00000000" className={inputCls} value={form.quantidade} onChange={onChange("quantidade")} />
        </FieldGroup>
        <div className="md:col-span-2 space-y-4">
          <label className="flex items-center gap-3 bg-background px-4 py-3 rounded-xl border border-muted cursor-pointer group w-fit">
            <Checkbox
              id="custodia"
              checked={!!form.custodiaPropria}
              onCheckedChange={onCheckbox("custodiaPropria")}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="text-[10px] font-black uppercase tracking-wider group-hover:text-primary transition-colors">
              Custódia Própria (Wallet)?
            </span>
          </label>

          {!form.custodiaPropria && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in zoom-in-95 duration-150">
              <FieldGroup label="Exchange / Corretora" colSpan="md:col-span-1">
                <Input placeholder="Ex: Binance, Mercado Bitcoin" className={inputCls} value={form.exchange} onChange={onChange("exchange")} />
              </FieldGroup>
              <FieldGroup label="CNPJ da Corretora (se nacional)">
                <Input placeholder="00.000.000/0000-00" className={inputCls} value={form.cnpjInst} onChange={onChange("cnpjInst")} />
              </FieldGroup>
            </div>
          )}
        </div>
      </div>
    </div>
  )
)
SecaoCripto.displayName = "SecaoCripto"


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
    if (!isEditing) setTempValue((value ?? "").toString())
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
    if (e.key === "Enter") handleBlur()
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
        highlighted ? "bg-primary/5 ring-2 ring-primary/20 scale-[1.01]" : isEditable ? "bg-muted/40 hover:bg-muted/60" : "",
        isEditable ? "cursor-text" : ""
      )}
      onClick={() => isEditable && !isEditing && setIsEditing(true)}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
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
          <p className={cn("text-sm tracking-tight", hasValue ? "font-bold text-foreground" : "font-normal text-muted-foreground/40 italic")}>
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
    const [customTag, setCustomTag] = useState("")
    const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({})
    const [viewerDoc, setViewerDoc] = useState<ViewerDocument | null>(null)
    const [isViewerMaximized, setIsViewerMaximized] = useState(false)
    const [finalizando, setFinalizando] = useState(false)
    const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false)
    const [savingField, setSavingField] = useState<string | null>(null)
    const [schedulingHistory, setSchedulingHistory] = useState<Scheduling[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    // CRUD Bens
    const [isBemDialogOpen, setIsBemDialogOpen] = useState(false)
    const [editingBem, setEditingBem] = useState<BemDireito | null>(null)
    const [bemForm, setBemForm] = useState<BemForm>(EMPTY_BEM_FORM)
    const [savingBem, setSavingBem] = useState(false)
    const [deletingBemId, setDeletingBemId] = useState<number | null>(null)

    const declaracaoId = declaration?.id ?? null
    const contribuinteId = contribuinte?.id ?? null
    const cpf = contribuinte?.cpf ?? null
    const anoExercicio = declaration?.anoExercicio ?? new Date().getFullYear()

  

    const handleBemChange = useCallback(
      (field: keyof BemForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          setBemForm((prev) => ({ ...prev, [field]: e.target.value }))
        },
      []
    )

    const handleBemSelect = useCallback(
      (field: keyof BemForm) => (v: string) => {
        setBemForm((prev) => ({ ...prev, [field]: v }))
      },
      []
    )

    const handleBemCheckbox = useCallback(
      (field: keyof BemForm) => (checked: boolean) => {
        setBemForm((prev) => ({ ...prev, [field]: checked }))
      },
      []
    )

    // Grupo change also resets codigo
    const handleGrupoChange = useCallback((v: string) => {
      const firstCode = Object.keys(CODIGOS_BENS[v] || {})[0] ?? ""
      setBemForm((prev) => ({ ...prev, grupo: v, codigo: firstCode }))
    }, [])

    // BRL-masked value fields
    const handleBemBRL = useCallback(
      (field: "valorAnterior" | "valorAtual") =>
        (e: React.ChangeEvent<HTMLInputElement>) => {
          const masked = maskBRL(e.target.value)
          setBemForm((prev) => ({ ...prev, [field]: masked }))
        },
      []
    )

 

    const openNewBemDialog = useCallback(() => {
      setEditingBem(null)
      setBemForm(EMPTY_BEM_FORM)
      setIsBemDialogOpen(true)
    }, [])

    const openEditBemDialog = useCallback((bem: BemDireito) => {
      setEditingBem(bem)
      
      const vAnt = typeof bem.valorAnterior === "string" ? parseFloat(bem.valorAnterior) : Number(bem.valorAnterior || 0)
      const vAtu = typeof bem.valorAtual === "string" ? parseFloat(bem.valorAtual) : Number(bem.valorAtual || 0)

      setBemForm({
        ...EMPTY_BEM_FORM,
        grupo: String(bem.grupo || "").padStart(2, "0"),
        codigo: String(bem.codigo || "").padStart(2, "0"),
        descricao: bem.descricao || "",
        valorAnterior: maskBRL((vAnt * 100).toFixed(0)),
        valorAtual: maskBRL((vAtu * 100).toFixed(0)),
        ...(bem.detalhes || {})
      })
      setIsBemDialogOpen(true)
    }, [])

  

    const generateDescricao = useCallback(() => {
      setBemForm((prev) => {
        const { grupo: g, codigo: c } = prev
        let desc = ""
        const label = CODIGOS_BENS[g]?.[c] || "Bem/Direito"
        
        if (g === "01") {
          desc = `${label.toUpperCase()}. `
          if (prev.iptu) desc += `Inscrição Municipal (IPTU): ${prev.iptu}. `
          if (prev.dataAquisicao) desc += `Adquirido em ${formatDate(prev.dataAquisicao)}. `
          if (prev.areaTotal) desc += `Área total de ${prev.areaTotal}${prev.areaUnidade}. `
          if (prev.registradoCartorio) {
            desc += `Registrado no Cartório ${prev.cartorioNome || "---"}, sob a Matrícula nº ${prev.cartorioMatricula || "---"}. `
          } else {
            desc += "Imóvel ainda não registrado em cartório. "
          }
        } else if (g === "02" && c === "01") {
          desc = `VEÍCULO AUTOMOTOR: ${label}. `
          if (prev.renavam) desc += `RENAVAM: ${prev.renavam}. `
          if (prev.placa) desc += `PLACA: ${prev.placa.toUpperCase()}. `
        } else if (g === "08") {
          desc = `${label.toUpperCase()}: ${prev.siglaMoeda.toUpperCase()}. `
          if (prev.quantidade) desc += `Quantidade: ${prev.quantidade}. `
          if (prev.custodiaPropria) {
            desc += "Custódia própria em carteira digital (Wallet). "
          } else {
            if (prev.exchange) desc += `Custodiado na Exchange ${prev.exchange}. `
            if (prev.cnpjInst) desc += `CNPJ: ${prev.cnpjInst}. `
          }
        } else if (["03", "04", "06", "07"].includes(g)) {
          desc = `${label.toUpperCase()}. `
          if (prev.nomeInst) desc += `Instituição: ${prev.nomeInst}. `
          if (prev.cnpjInst) desc += `CNPJ: ${prev.cnpjInst}. `
          if (prev.agencia) desc += `Agência: ${prev.agencia}. `
          if (prev.conta) desc += `Conta: ${prev.conta}${prev.digito ? "-" + prev.digito : ""}. `
        }
        
        if (!desc) desc = `${label}. `
        
        return { ...prev, descricao: desc.trim() }
      })
    }, [])

    /* ─── CRUD handlers ─── */

    const handleSaveBem = useCallback(async () => {
      if (!declaracaoId) {
        toast.error("Nenhuma declaração vinculada. Importe um XML primeiro.")
        return
      }
      setSavingBem(true)
      try {
        const url = editingBem
          ? `/api/declaracoes/${declaracaoId}/bens/${editingBem.id}`
          : `/api/declaracoes/${declaracaoId}/bens`

        const { grupo, codigo, descricao, valorAnterior, valorAtual, ...extras } = bemForm
        const payload = {
          grupo,
          codigo,
          descricao,
          valorAnterior: parseBRLToNumber(valorAnterior),
          valorAtual: parseBRLToNumber(valorAtual),
          detalhes: extras
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
    }, [declaracaoId, editingBem, bemForm, onDataRefresh])

    const handleDeleteBem = useCallback(async (bid: number) => {
      if (!declaracaoId) { toast.error("Nenhuma declaração vinculada."); return }
      if (!confirm("Deseja realmente excluir este bem?")) return
      setDeletingBemId(bid)
      try {
        const res = await fetch(`/api/declaracoes/${declaracaoId}/bens/${bid}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Erro ao excluir")
        toast.success("Bem removido")
        onDataRefresh?.()
      } catch (e: any) {
        toast.error(e.message || "Erro ao excluir")
      } finally {
        setDeletingBemId(null)
      }
    }, [declaracaoId, onDataRefresh])

    const handleExportarPdf = useCallback(async () => {
      if (!declaracaoId) return
      setExportando(true)
      try {
        const res = await fetch(`/api/declaracoes/${declaracaoId}/exportar/pdf`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error || errData?.message || "Erro ao gerar PDF")
        }
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
    }, [declaracaoId, contribuinte?.cpf, anoExercicio])

    const toggleManualCheck = useCallback((id: string) => {
      setManualChecks((prev) => ({ ...prev, [id]: !prev[id] }))
    }, [])

    const handleTabChange = useCallback(
      (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      },
      [searchParams, router, pathname]
    )

    const handleCreateManualDeclaration = useCallback(async () => {
      if (!contribuinteId) return
      setCreatingManual(true)
      try {
        const res = await declaracaoIrpfService.create({ contribuinteId, anoExercicio: Number(selectedManualYear) })
        toast.success(res.message || "Declaração manual inicializada com sucesso!")
        onDataRefresh?.()
      } catch (e: any) {
        toast.error(e.message || "Erro ao inicializar declaração")
      } finally {
        setCreatingManual(false)
      }
    }, [contribuinteId, selectedManualYear, onDataRefresh])

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
          <h3 className="text-2xl font-black tracking-tight text-foreground">Sincronizando Dossiê</h3>
          <p className="mt-4 text-sm font-bold text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Estamos consolidando os dados fiscais e documentos do contribuinte para uma auditoria completa.
          </p>
        </div>
      )
    }

    /* ─── derived data ─── */
    const filteredAssets = useMemo(() => {
      return assets.filter((a) => {
        const matchSearch = (a.descricao || "").toLowerCase().includes(assetSearch.toLowerCase())
        const matchGroup = assetGroupFilter === "all" || String(a.grupo) === assetGroupFilter
        return matchSearch && matchGroup
      })
    }, [assets, assetSearch, assetGroupFilter])

    const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE)

    const paginatedAssets = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE
      return filteredAssets.slice(start, start + ITEMS_PER_PAGE)
    }, [filteredAssets, currentPage])

        const localTotalBensAtual = useMemo(
      () => assets.reduce((sum, a) => sum + (Number(a.valorAtual) || 0), 0),
      [assets]
    )

    const localTotalBensAnterior = useMemo(
      () => assets.reduce((sum, a) => sum + (Number(a.valorAnterior) || 0), 0),
      [assets]
    )

    const localVariation = localTotalBensAtual - localTotalBensAnterior
    const localVariationPercent = localVariation / (localTotalBensAnterior || 1)

    const statusLabel = getResultLabel(declaration?.resultadoDeclaracao || null)
    const statusClasses = getResultColor(declaration?.resultadoDeclaracao || null)
    const variation = (Number(declaration?.totalBensAtual) || 0) - (Number(declaration?.totalBensAnterior) || 0)
    const variationPercent = variation / (Number(declaration?.totalBensAnterior) || 1)

    const getDeclarationDocsForItem = useCallback(
      (fieldId: string) => {
        if (!declaration) return []
        const rawDataMeta = (declaration.rawData as any)?._meta
        const documentosArquivados = (rawDataMeta?.documentos_arquivados || []) as Array<{
          tag: string; nome_arquivo: string; tamanho_bytes: number; media_type: string
          url: string | null; origem: string; recebido_em: string; confianca_extracao?: number
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
          tags.some((t) => (doc.tag || "").toLowerCase().trim() === t.toLowerCase().trim())
        )
      },
      [declaration]
    )

    const declarationDocuments = useMemo<ViewerDocument[]>(() => {
      const seen = new Set<string>()
      return [
        "identificacao.cpf",
        "identificacao.titulo_eleitor",
        "identificacao.rg",
        "endereco.logradouro",
        "rendimentos.pj",
        "financeiro.extrato",
        "bens",
      ].flatMap((fieldId) =>
        getDeclarationDocsForItem(fieldId)
          .map((doc) => ({
            ...doc,
            fieldId,
            origem: doc.origem || "declaracao",
            recebido_em: doc.recebido_em || declaration?.updatedAt || "",
          }))
          .filter((doc) => {
            const key = `${doc.tag}-${doc.nome_arquivo}-${doc.url}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
      )
    }, [declaration?.updatedAt, getDeclarationDocsForItem])

    const schedulingDocuments = useMemo<ViewerDocument[]>(
      () =>
        schedulingHistory.flatMap((scheduling) =>
          scheduling.documents.map((document) => {
            const checklistItem = scheduling.checklist.find(
              (item) =>
                item.id === document.checklistItemId ||
                item.chave === document.checklistItemKey
            )
            const checklistKey = document.checklistItemKey ?? checklistItem?.chave ?? null
            const fieldId = checklistKey
              ? SCHEDULING_CHECKLIST_FIELD[checklistKey]
              : undefined

            return {
              tag: checklistItem?.nome || checklistKey || "Agendamento",
              fieldId,
              nome_arquivo: document.nome,
              tamanho_bytes: document.tamanhoBytes,
              media_type: document.tipo || "application/octet-stream",
              url: `/api/agendamentos/${scheduling.id}/documentos/${document.id}/view`,
              origem: `agendamento ${formatDate(scheduling.dataAgendamento)}`,
              recebido_em: document.createdAt,
            }
          })
        ),
      [schedulingHistory]
    )

    const allViewerDocuments = useMemo(() => {
      const seen = new Set<string>()
      return [...declarationDocuments, ...schedulingDocuments].filter((doc) => {
        const key = doc.url || `${doc.tag}-${doc.nome_arquivo}-${doc.tamanho_bytes}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }, [declarationDocuments, schedulingDocuments])

    const normalizeTag = useCallback(
      (value: string) =>
        value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim(),
      []
    )

    const getDocsForItem = useCallback(
      (fieldId: string) => {
        const tagMapping: Record<string, string[]> = {
          "identificacao.cpf": ["CPF"],
          "identificacao.titulo_eleitor": ["Titulo de Eleitor", "TÃ­tulo de Eleitor"],
          "identificacao.rg": ["RG / CNH"],
          "endereco.logradouro": ["Comprovante de residencia", "Comprovante de residÃªncia"],
          "rendimentos.pj": ["Informe de rendimentos", "Informe de rendimentos (empregador)", "Informe de rendimentos bancÃ¡rios", "Carne-leao", "CarnÃª-leÃ£o"],
          "financeiro.extrato": ["Extrato bancario", "Extrato bancÃ¡rio", "Extrato de previdencia privada", "Extrato de previdÃªncia privada"],
          "bens": ["Bens e Direitos", "Nota de corretagem", "IPTU", "Escritura", "CRLV", "Recibo de Aluguel"],
        }
        const tags = (tagMapping[fieldId] || []).map(normalizeTag)

        return allViewerDocuments.filter((doc) => {
          if (doc.fieldId === fieldId) return true
          const docTag = normalizeTag(doc.tag || "")
          return tags.some((tag) => docTag === tag || docTag.includes(tag) || tag.includes(docTag))
        })
      },
      [allViewerDocuments, normalizeTag]
    )

    const cadastroItems = useMemo(
      () => [
        { label: "Nome Completo", ok: !!contribuinte.nome, value: contribuinte.nome, category: "Dados Pessoais", type: "data", fieldId: "identificacao.nome_completo" },
        { label: "CPF", ok: !!contribuinte.cpf, value: formatCPF(contribuinte.cpf), category: "Dados Pessoais", type: "doc", fieldId: "identificacao.cpf" },
        { label: "Data de Nascimento", ok: !!contribuinte.dataNascimento, value: formatDate(contribuinte.dataNascimento), category: "Dados Pessoais", type: "data", fieldId: "identificacao.data_nascimento" },
        { label: "Título de Eleitor", ok: !!contribuinte.tituloEleitor, value: contribuinte.tituloEleitor, category: "Documentos", type: "doc", fieldId: "identificacao.titulo_eleitor" },
        { label: "Endereço Completo", ok: !!(contribuinte.enderecoLogradouro && contribuinte.enderecoMunicipio), value: contribuinte.enderecoLogradouro ? `${contribuinte.enderecoLogradouro}, ${contribuinte.enderecoMunicipio}` : null, category: "Dados Pessoais", type: "data", fieldId: "endereco.logradouro" },
        { label: "RG / CNH", ok: false, value: "Documento Identidade", category: "Documentos", type: "doc", fieldId: "identificacao.rg" },
        { label: "Informe de Rendimentos", ok: Number(declaration?.totalRendPJ) > 0, value: declaration?.totalRendPJ ? formatCurrency(declaration.totalRendPJ) : null, category: "Financeiro", type: "doc", fieldId: "rendimentos.pj" },
        { label: "Bens e Direitos", ok: assets.length > 0, value: `${assets.length} itens lançados`, category: "Patrimônio", type: "data", fieldId: "bens" },
        { label: "Contato (Tel/Email)", ok: !!(contribuinte.telefone || contribuinte.email), value: contribuinte.email || contribuinte.telefone, category: "Dados Pessoais", type: "data", fieldId: "contato.email" },
        { label: "Extrato Bancário", ok: Number(declaration?.totalBensAtual) > 0, value: "Sincronizado", category: "Financeiro", type: "doc", fieldId: "financeiro.extrato" },
      ],
      [contribuinte, declaration, assets]
    )

    /* ─── async handlers ─── */

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
              toast.error("O arquivo XML enviado pertence a outro contribuinte!", { description: `O XML pertence a ${result.nome} (CPF: ${formatCPF(result.cpf)}).`, duration: 8000 })
            } else {
              toast.success("XML importado com sucesso!", { description: `Dados importados para ${result.nome}.` })
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
        const res = await declaracaoIrpfService.uploadDocumento(declaracaoId, docFile, finalTag)
        if ((res as any)?.extractionSummary) {
          const summary = (res as any).extractionSummary
          setExtractionResult(summary)
          const totalCampos = summary.campos_simples_atualizados + summary.bens_criados + summary.rendimentos_pj_criados + summary.meses_pf_criados
          toast.success(`Documento ${finalTag} processado!`, { description: `${totalCampos} campo(s) atualizado(s) (${Math.round(summary.confianca * 100)}% confiança)`, duration: 6000 })
        } else if (res.contribuinteAtualizado?.updated) {
          toast.success(`Documento ${finalTag} processado pela IA!`, { description: `Campos [${res.contribuinteAtualizado.fields.join(", ")}] atualizados.`, duration: 6000 })
        } else {
          toast.success(`Documento ${finalTag} enviado com sucesso!`)
        }
        setDocFile(null); setTag(""); setCustomTag("")
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

    useEffect(() => {
      if (activeTab === "checklist" || !declaracaoId) return
      let cancelled = false
      const run = async () => {
        setChecklistLoading(true)
        try {
          const data = await declaracaoIrpfService.getChecklist(declaracaoId)
          if (!cancelled) setChecklist(data)
        } catch (e: any) {
          if (!cancelled) toast.error(e.message || "Erro ao carregar checklist")
        } finally {
          if (!cancelled) setChecklistLoading(false)
        }
      }
      run()
      return () => { cancelled = true }
    }, [declaracaoId, activeTab])

    useEffect(() => {
      if (!highlightedField) return
      const t = setTimeout(() => setHighlightedField(null), 3000)
      return () => clearTimeout(t)
    }, [highlightedField])

    useEffect(() => {
      if (!["checklist", "documentos", "agendamentos"].includes(activeTab) || !cpf) return
      async function loadHistory() {
        setLoadingHistory(true)
        try {
          const res = await schedulingService.list({ cpf: cpf || undefined })
          setSchedulingHistory(res.agendamentos)
        } catch (err) {
          console.error("Erro ao carregar historico:", err)
        } finally {
          setLoadingHistory(false)
        }
      }
      void loadHistory()
    }, [activeTab, cpf])

    const FIELD_TO_CONTRIBUINTE_COLUMN: Record<string, string> = {
      "identificacao.nome_completo": "nome", "identificacao.cpf": "cpf",
      "identificacao.data_nascimento": "dataNascimento", "identificacao.titulo_eleitor": "tituloEleitor",
      "identificacao.ocupacao_principal": "ocupacaoPrincipal", "identificacao.natureza_ocupacao": "naturezaOcupacao",
      "endereco.cep": "enderecoCep", "endereco.uf": "enderecoUf", "endereco.codigo_municipio_ibge": "enderecoMunicipio",
      "endereco.bairro": "enderecoBairro", "endereco.logradouro": "enderecoLogradouro",
      "endereco.numero": "enderecoNumero", "endereco.complemento": "enderecoComplemento",
      "contato.email": "email", "contato.celular": "telefone",
    }

    const fieldUpdateSeqRef = React.useRef(0)

    async function handleFieldUpdate(fieldPath: string, value: string) {
      const seq = ++fieldUpdateSeqRef.current
      setSavingField(fieldPath)
      try {
        if (declaracaoId) {
          await declaracaoIrpfService.putCampo(declaracaoId, { campo: fieldPath, valor: value })
          toast.success("Campo atualizado", { description: "Salvo e sincronizado com o XML." })
        } else if (contribuinteId) {
          const dbColumn = FIELD_TO_CONTRIBUINTE_COLUMN[fieldPath]
          if (!dbColumn) { toast.error(`Campo '${fieldPath}' não pode ser editado sem uma declaração.`); return }
          await contribuinteService.update(contribuinteId, { nome: contribuinte?.nome || "", [dbColumn]: value })
          toast.success("Campo atualizado", { description: "Salvo no cadastro do contribuinte." })
        } else {
          toast.error("Não foi possível identificar o contribuinte.")
          return
        }
        if (seq === fieldUpdateSeqRef.current) {
          onDataRefresh?.()
          if (declaracaoId) carregarChecklist()
        }
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Erro ao salvar campo")
      } finally {
        if (seq === fieldUpdateSeqRef.current) setSavingField(null)
      }
    }

    async function handleExportar(formato: "xml" | "posicional" | "dec") {
      if (!declaracaoId) return
      setExportando(true)
      try {
        const res = await fetch(`/api/declaracoes/${declaracaoId}/exportar`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anoExercicio, tipo: "O", formato }),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error || errData?.message || "Erro ao exportar")
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${contribuinte?.cpf}-IRPF-A-${anoExercicio}-${anoExercicio - 1}-ORIGI.${formato === "xml" ? "xml" : "DEC"}`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Arquivo gerado!", { description: "Download iniciado automaticamente." })
      } catch (e: any) {
        toast.error(e.message || "Erro na exportação")
      } finally {
        setExportando(false)
      }
    }

    const FINISHED_STATUSES = ["transmitida", "finalizada", "processada", "concluido"]
    const isFinalized = FINISHED_STATUSES.includes(declaration?.situacao ?? "")

    async function handleFinalizar() {
      if (!declaracaoId || !declaration) return
      const novaSituacao = isFinalized ? "em_preenchimento" : "transmitida"
      setFinalizando(true)
      try {
        await declaracaoIrpfService.updateStatus(declaracaoId, novaSituacao)
        toast.success(novaSituacao === "transmitida" ? "Auditoria finalizada com sucesso!" : "Auditoria reaberta.")
        onDataRefresh?.()
        setIsFinalizeDialogOpen(false)
      } catch (e: any) {
        toast.error("Erro ao atualizar status: " + e.message)
      } finally {
        setFinalizando(false)
      }
    }

    /* ─── Render ─── */

    const showImovel = bemForm.grupo === "01"
    const showVeiculo = bemForm.grupo === "02" && bemForm.codigo === "01"
    const showInst = ["03", "04", "06", "07"].includes(bemForm.grupo)
    const showCripto = bemForm.grupo === "08"
    const saldoPagar = declaration?.saldoPagar ?? 0
    const impostoRestituir = declaration?.impostoRestituir ?? 0

    const hasSaldoPagar = saldoPagar > 0
    const hasImpostoRestituir = impostoRestituir > 0

    const irrfValue = hasSaldoPagar
      ? saldoPagar
      : hasImpostoRestituir
        ? impostoRestituir
        : 0

    const irrfColor = hasSaldoPagar
      ? "text-red-500"
      : hasImpostoRestituir
        ? "text-green-500"
        : "text-blue-500"


    return (
      <div className="space-y-6">
        {/* TOP TOOLBAR */}
        <div className="flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-xl px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold border-black/10 hover:bg-black/5" onClick={() => router.push("/contribuintes")}>
              <ChevronLeft className="mr-2 h-4 w-4" /> VOLTAR
            </Button>
            <div className="h-6 w-px bg-black/10 mx-2" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Auditando:</span>
              <span className="text-sm font-black text-foreground">{contribuinte.nome}</span>
              <Badge variant="outline" className="h-5 text-[9px] font-black tracking-widest opacity-60">
                CPF: {formatCPF(contribuinte.cpf)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="px-8 pb-12 space-y-6">
          {/* HEADER CARD */}
          <Card className="border-none shadow-sm bg-background/60 backdrop-blur-md border border-white/20">
            <CardHeader className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                    <User className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-black tracking-tight text-foreground">{contribuinte.nome}</h2>
                      <Badge className={cn(statusClasses, "rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider")}>{statusLabel}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground/70">
                        <FileText className="h-3 w-3" /> {formatCPF(contribuinte.cpf)}
                      </div>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                      <Badge variant="outline" className="h-5 text-[10px] font-bold border-muted-foreground/20">EXERCÍCIO {anoExercicio}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold border-muted-foreground/20 hover:bg-primary/5 transition-all group">
                        {exportando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4 text-primary group-hover:scale-110 transition-transform" />}
                        EXPORTAR
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 rounded-xl border-white/20 bg-background/80 backdrop-blur-md">
                      <DropdownMenuItem onClick={() => handleExportar("posicional")} className="cursor-pointer font-bold gap-3 py-2.5">
                        <Layout className="h-4 w-4 text-purple-600" /> 
                        <div className="flex flex-col">
                          <span>Importação PGD (.DEC)</span>
                          <span className="text-[9px] text-muted-foreground font-normal">Layout DIRP - Funciona s/ XML</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportar("dec")} className="cursor-pointer font-bold gap-3 py-2.5">
                        <Archive className="h-4 w-4 text-blue-600" />
                        <div className="flex flex-col">
                          <span>Pacote PGD (.DEC)</span>
                          <span className="text-[9px] text-muted-foreground font-normal">Requer XML Original</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportar("xml")} className="cursor-pointer font-bold gap-3 py-2.5">
                        <FileCode className="h-4 w-4 text-orange-600" />
                        <div className="flex flex-col">
                          <span>Arquivo XML (.xml)</span>
                          <span className="text-[9px] text-muted-foreground font-normal">Requer XML Original</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExportarPdf} className="cursor-pointer font-black gap-3 py-3 text-emerald-600">
                        <FileDown className="h-4 w-4" /> Dossiê PDF Completo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {declaration && (
                    <Button 
                      variant={isFinalized ? "secondary" : "default"}
                      size="sm" 
                      className="h-9 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 shadow-lg shadow-primary/10"
                      onClick={() => setIsFinalizeDialogOpen(true)}
                      disabled={finalizando}
                    >
                      {finalizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isFinalized ? <X className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {isFinalized ? "Reabrir Auditoria" : "Finalizar Auditoria"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* KPI / EMPTY BANNER */}
          {declaration ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Rendimentos" value={formatCurrency(declaration.totalRendPJ)} icon={<Landmark className="h-5 w-5" />} />
              <StatCard
                title="IRRF"
                value={
                  <span className={irrfColor}>
                    {formatCurrency(irrfValue)}
                  </span>
                }
                icon={<Calculator className="h-5 w-5" />}
              />             
              <StatCard title="Patrimônio" value={formatCurrency(localTotalBensAtual)} icon={<Building2 className="h-5 w-5" />} />
              <StatCard
                title="Variação"
                value={`${localVariation >= 0 ? "+" : ""}${formatPercent(localVariationPercent)}`}
                icon={localVariation >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
              />
            </div>
          ) : (
            <Card className="border-none shadow-xl overflow-hidden bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-yellow-500/10 border border-amber-500/20 rounded-[2.5rem]">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-3 max-w-2xl text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-widest">
                      <AlertCircle className="h-3.5 w-3.5" /> Declaração Não Iniciada
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-foreground">
                      Este contribuinte não possui nenhuma declaração ativa para o exercício atual.
                    </h3>
                    <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                      Inicie o preenchimento manual ou faça upload do XML anterior.
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
                      <Button size="sm" className="h-10 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md shadow-primary/10" onClick={handleCreateManualDeclaration} disabled={creatingManual}>
                        {creatingManual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Iniciar Manual"}
                      </Button>
                    </div>
                    <span className="text-xs font-black text-muted-foreground/60 uppercase">OU</span>
                    <div className="relative w-full sm:w-auto">
                      <input type="file" accept=".xml" className="hidden" id="xml-upload-empty-state"
                        onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleImportarXml(f) }}
                        disabled={importando}
                      />
                      <Button variant="outline" size="sm" className="h-10 w-full sm:w-auto px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 border-primary/20 bg-background/50 hover:bg-primary/5 hover:border-primary/40 transition-all gap-2" asChild>
                        <Label htmlFor="xml-upload-empty-state" className="cursor-pointer flex items-center justify-center h-full w-full">
                          {importando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
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
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 h-12 bg-muted/30 p-1 rounded-xl">
              {["dados", "checklist", "documentos", "bens", "agendamentos"].map((t) => (
                <TabsTrigger key={t} value={t} className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs capitalize">
                  {t === "dados" ? "Dados" : t === "checklist" ? "Checklist IR" : t === "documentos" ? "Documentos" : t === "bens" ? "Bens" : "Agendamentos"}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── DADOS ── */}
            <TabsContent value="dados">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <CardTitle className="text-lg font-bold">Identificação</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {savingField && <p className="text-[10px] text-muted-foreground flex items-center gap-1 pb-1"><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</p>}
                    <Field label="Nome Completo" value={contribuinte.nome} highlighted={highlightedField === "identificacao.nome_completo"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("identificacao.nome_completo", v)} />
                    <Field label="Natureza Ocupação" value={contribuinte.naturezaOcupacao} highlighted={highlightedField === "identificacao.natureza_ocupacao"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("identificacao.natureza_ocupacao", v)} />
                    <Field label="Ocupação Principal" value={contribuinte.ocupacaoPrincipal} highlighted={highlightedField === "identificacao.ocupacao_principal"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("identificacao.ocupacao_principal", v)} />
                    <Field label="CPF" value={formatCPF(contribuinte.cpf)} highlighted={highlightedField === "identificacao.cpf"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("identificacao.cpf", v)} />
                    <Field label="Data Nascimento" value={formatDate(contribuinte.dataNascimento)} highlighted={highlightedField === "identificacao.data_nascimento"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("identificacao.data_nascimento", v)} />
                    <Field label="Título de Eleitor" value={contribuinte.tituloEleitor} highlighted={highlightedField === "identificacao.titulo_eleitor"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("identificacao.titulo_eleitor", v)} />
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <CardTitle className="text-lg font-bold">Localização & Contato</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <Field label="CEP" value={formatCEP(contribuinte.enderecoCep)} highlighted={highlightedField === "endereco.cep"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("endereco.cep", v)} />
                    <Field label="Endereço" value={contribuinte.enderecoLogradouro} highlighted={highlightedField === "endereco.logradouro"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("endereco.logradouro", v)} />
                    <Field label="Complemento" value={contribuinte.enderecoComplemento} highlighted={highlightedField === "endereco.complemento"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("endereco.complemento", v)} />
                    <Field label="Cidade/UF" value={`${contribuinte.enderecoMunicipio || ""} - ${contribuinte.enderecoUf || ""}`} highlighted={highlightedField === "endereco"} />
                    <Field label="Email" value={contribuinte.email} highlighted={highlightedField === "contato.email"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("contato.email", v)} />
                    <Field label="Telefone/Celular" value={contribuinte.telefone} highlighted={highlightedField === "contato.celular"} editable={!!declaracaoId} onSave={(v) => handleFieldUpdate("contato.celular", v)} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── CHECKLIST ── */}
            <TabsContent value="checklist">
              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4 xl:col-span-3 space-y-6 h-[calc(100vh-4.5rem)] overflow-y-auto pr-2 scrollbar-none pb-10">
                  {["Dados Pessoais", "Documentos", "Financeiro", "Patrimônio"].map((category) => {
                    const items = cadastroItems.filter((i) => i.category === category)
                    if (items.length === 0) return null
                    return (
                      <div key={category} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between px-3 py-2 sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm rounded-t-2xl border-x border-t border-muted-foreground/10 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-1.5 rounded-full bg-primary" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{category}</h4>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge variant="outline" className="text-[10px] font-bold border-muted-foreground/10 bg-white/50">
                              {items.filter((i) => i.ok || manualChecks[i.fieldId] || getDocsForItem(i.fieldId).length > 0).length} / {items.length}
                            </Badge>
                            <div className="w-24 h-1 bg-muted-foreground/10 rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${(items.filter(i => i.ok || manualChecks[i.fieldId] || getDocsForItem(i.fieldId).length > 0).length / items.length) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="bg-background rounded-b-3xl border border-muted-foreground/10 overflow-hidden shadow-sm">
                          {items.map((item, idx) => {
                            const hasDocs = getDocsForItem(item.fieldId).length > 0
                            const isDone = item.ok || manualChecks[item.fieldId] || hasDocs
                            return (
                              <div key={idx} className={cn("p-4 flex items-start justify-between gap-4 transition-all border-b last:border-b-0 hover:bg-muted/5", isDone && "bg-emerald-50/10")}>
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                  <div className="flex items-center justify-center min-w-[24px] pt-0.5">
                                    <Checkbox id={`check-${item.fieldId}`} checked={isDone} onCheckedChange={() => toggleManualCheck(item.fieldId)} className="h-5 w-5 rounded-md data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
                                  </div>
                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <Label htmlFor={`check-${item.fieldId}`} className={cn("text-sm font-bold cursor-pointer transition-all break-words leading-tight", isDone ? "text-muted-foreground line-through opacity-50" : "text-foreground")}>
                                      {item.label}
                                      {item.ok && <CheckCircle2 className="inline ml-2 h-3 w-3 text-emerald-500" />}
                                      {!item.ok && hasDocs && <Badge variant="outline" className="ml-2 h-4 text-[8px] font-black uppercase border-emerald-200 text-emerald-600 bg-emerald-50/50">Auditado</Badge>}
                                    </Label>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight line-clamp-1">
                                      {item.ok ? `Valor: ${item.value}` : hasDocs ? "Documento anexado para conferência" : "Pendente de validação no sistema"}
                                    </p>
                                    {getDocsForItem(item.fieldId).length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in-50 duration-500">
                                        {getDocsForItem(item.fieldId).map((doc, dIdx) => (
                                          <Button key={dIdx} variant="secondary" size="sm"
                                            className="h-8 group/doc bg-primary/10 hover:bg-primary text-primary hover:text-white border-none rounded-xl transition-all gap-2 px-4 shadow-sm"
                                            onClick={() => { if (!doc.url) { toast.error("URL do arquivo não disponível."); return }; setViewerDoc(doc) }}
                                          >
                                            <FileText className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-black uppercase tracking-widest max-w-[120px] truncate">Ver {doc.tag || "Documento"}</span>
                                            <Maximize2 className="h-3 w-3 opacity-0 group-hover/doc:opacity-100 transition-all scale-0 group-hover/doc:scale-100" />
                                          </Button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0 self-start mt-1">
                                  {(!item.ok || manualChecks[item.fieldId]) && (
                                    <Button variant="ghost" size="sm"
                                      className={cn("h-7 pr-1 pl-3 rounded-lg text-[9px] font-black tracking-widest text-primary hover:bg-primary/10 transition-all group", manualChecks[item.fieldId] && "text-emerald-600 bg-emerald-50/50")}
                                      onClick={() => { if (item.type === "doc") { setTag(item.fieldId); handleTabChange("documentos") } else { handleTabChange("dados"); setHighlightedField(item.fieldId) } }}
                                    >
                                      {manualChecks[item.fieldId] ? "CONFERIDO" : item.type === "doc" ? "ANEXAR" : "PREENCHER"}
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
                  })}
                </div>

                {/* Viewer */}
                <div className={cn("lg:col-span-8 xl:col-span-9 sticky top-4 h-[calc(100vh-4rem)] pb-4 transition-all duration-500", isViewerMaximized && "fixed inset-0 z-[100] h-screen w-screen p-0 m-0 bg-background/80 backdrop-blur-2xl")}>
                  <Card className={cn("border-none shadow-sm overflow-hidden h-full flex flex-col bg-white/50 backdrop-blur-sm transition-all", isViewerMaximized && "rounded-none bg-background shadow-2xl")}>
                    <CardHeader className="px-6 py-3 border-b bg-muted/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><FileText className="h-4 w-4" /></div>
                          <div>
                            <CardTitle className="text-sm font-black tracking-tight">Visualizador</CardTitle>
                            <div className="flex items-center gap-2 mt-0.5">
                              <CardDescription className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 truncate max-w-[150px]">{viewerDoc?.nome_arquivo || "Selecione"}</CardDescription>
                              {viewerDoc && <span className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-tighter border-l pl-2 border-muted-foreground/10">{viewerDoc.origem} • {viewerDoc.recebido_em ? formatDate(viewerDoc.recebido_em) : "--"}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {viewerDoc && (
                            <>
                              <div className="flex items-center gap-1 mr-4 border-r pr-4 border-muted-foreground/10 bg-muted/5 p-1 rounded-lg">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-primary"><ZoomOut className="h-3.5 w-3.5" /></Button>
                                <span className="text-[10px] font-black text-muted-foreground px-1 min-w-[32px] text-center">100%</span>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-primary"><ZoomIn className="h-3.5 w-3.5" /></Button>
                                <div className="w-px h-3 bg-muted-foreground/20 mx-1" />
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-primary"><RotateCw className="h-3.5 w-3.5" /></Button>
                              </div>
                              {viewerDoc.tag && !manualChecks[viewerDoc.tag] && (
                                <Button variant="outline" size="sm" className="h-8 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 font-black text-[10px] gap-2 rounded-lg px-3 shadow-sm mr-2" onClick={() => { toggleManualCheck(viewerDoc.tag); toast.success("Documento validado!") }}>
                                  <CheckCircle2 className="h-3.5 w-3.5" /> VALIDAR
                                </Button>
                              )}
                              {viewerDoc.url && (
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all" onClick={() => window.open(viewerDoc.url!, "_blank")}>
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0 rounded-lg hover:bg-primary/5 transition-all text-muted-foreground", isViewerMaximized && "bg-primary/10 text-primary")} onClick={() => setIsViewerMaximized(!isViewerMaximized)}>
                                {isViewerMaximized ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-auto px-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all text-muted-foreground gap-2" onClick={() => { setViewerDoc(null); setIsViewerMaximized(false) }}>
                                <span className="text-[10px] font-black uppercase tracking-widest">Fechar</span>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                      {viewerDoc ? (
                        <div className="h-full bg-white">
                          {!viewerDoc.url ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm font-bold p-6 text-center"><AlertCircle className="h-10 w-10 mb-2 opacity-20" />URL do arquivo indisponível.</div>
                          ) : viewerDoc.media_type?.includes("pdf") ? (
                            <iframe title="viewer-pdf" src={viewerDoc.url} className="w-full h-full border-none bg-white" />
                          ) : (
                            <img src={viewerDoc.url} alt={viewerDoc.nome_arquivo} className="w-full h-full object-contain bg-white" />
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
                          <h3 className="text-lg font-black text-foreground/40 tracking-tight">Aguardando Documento</h3>
                          <p className="text-xs font-medium text-muted-foreground/50 mt-2 max-w-[200px] leading-relaxed">Selecione um anexo no checklist para visualizar.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ── DOCUMENTOS ── */}
            <TabsContent value="documentos">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-none shadow-sm h-full flex flex-col">
                  <CardHeader>
                    <div className="flex items-center gap-2"><FileUp className="h-4 w-4 text-primary" /><CardTitle className="text-lg font-bold">Fontes Externas</CardTitle></div>
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
                    <Button className="w-full h-12 rounded-xl font-bold transition-all" variant={xmlFile ? "default" : "outline"} onClick={() => handleImportarXml()} disabled={importando || !xmlFile}>
                      {importando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                      {xmlFile ? `IMPORTAR "${xmlFile.name}"` : "SELECIONE UM ARQUIVO XML"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm h-full flex flex-col">
                  <CardHeader>
                    <div className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /><CardTitle className="text-lg font-bold">Repositório de Documentos</CardTitle></div>
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
                    {extractionResult && (
                      <ExtractionResultBadge confianca={extractionResult.confianca} origem={extractionResult.confianca >= 0.5 ? "anchor_parser" : "claude_ocr"}
                        camposAtualizados={extractionResult.campos_simples_atualizados + extractionResult.bens_criados + extractionResult.rendimentos_pj_criados + extractionResult.meses_pf_criados}
                        alertas={extractionResult.alertas_revisao}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── BENS ── */}
            <TabsContent value="bens">
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/5 border-b py-6">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Building2 className="h-6 w-6" /></div>
                      <div>
                        <CardTitle className="text-xl font-black tracking-tight">Relação de Bens e Direitos</CardTitle>
                        <CardDescription className="text-xs font-bold text-primary flex items-center gap-1.5 mt-0.5">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> {filteredAssets.length} registros auditados
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button size="sm" className="h-11 rounded-xl font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-primary/20" onClick={openNewBemDialog} disabled={!declaracaoId}>
                        <Package className="mr-2 h-4 w-4" /> Novo Bem
                      </Button>
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
                  {!assets || assets.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center">
                      <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-6"><Package className="h-10 w-10 text-muted-foreground/20" /></div>
                      <h3 className="text-lg font-black text-foreground/40">Nenhum bem declarado</h3>
                      <p className="text-sm text-muted-foreground/60 mt-2 max-w-xs">{!declaracaoId ? "Inicialize a declaração para lançar bens manualmente." : "Os bens aparecerão aqui após a importação do XML ou lançamento manual."}</p>
                    </div>
                  ) : filteredAssets.length > 50 ? (
                    <div className="h-[700px] w-full">
                      <Virtuoso data={filteredAssets} itemContent={(_, asset) => (
                        <div className="p-6 border-b hover:bg-primary/[0.02] transition-all bg-background group cursor-default">
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
                                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.15em] mb-1.5 opacity-60">Anterior</p>
                                <p className="font-bold text-sm text-foreground/80 tracking-tight">{formatCurrency(asset.valorAnterior)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] uppercase font-black text-primary tracking-[0.15em] mb-1.5">Atual</p>
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
                            <div className="flex items-center gap-2 pl-6">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all" onClick={() => openEditBemDialog(asset)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all" onClick={() => handleDeleteBem(asset.id)} disabled={deletingBemId === asset.id}>
                                {deletingBemId === asset.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
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
                            <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl font-bold bg-background border-muted-foreground/20 hover:bg-primary/5" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}><ChevronLeft className="h-4 w-4 mr-2" /> ANTERIOR</Button>
                            <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl font-bold bg-background border-muted-foreground/20 hover:bg-primary/5" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>PRÓXIMO <ChevronRight className="h-4 w-4 ml-2" /></Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agendamentos">
              <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-muted/5 border-b py-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner"><CalendarDays className="h-6 w-6" /></div>
                      <div>
                        <CardTitle className="text-xl font-black tracking-tight">Dossiê de Agendamentos</CardTitle>
                        <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Histórico de consultas e status de documentos vinculados</CardDescription>
                      </div>
                    </div>
                    <Button size="sm" className="h-9 rounded-xl font-black text-[10px] uppercase tracking-widest" onClick={() => router.push("/agendamentos")}>NOVO AGENDAMENTO</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-3" />Carregando histórico...</div>
                  ) : schedulingHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="rounded-full bg-slate-100 p-4 mb-4"><CalendarDays className="h-8 w-8 text-slate-300" /></div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-relaxed px-10">Nenhum agendamento encontrado para este CPF.</h3>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {schedulingHistory.map((s) => (
                        <div key={s.id} className="p-6 transition-all hover:bg-slate-50 group">
                          <div className="flex flex-col gap-6 md:flex-row md:items-center">
                            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white border-2 border-slate-100 shadow-sm group-hover:border-primary/20 group-hover:shadow-md transition-all">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(parseISO(s.dataAgendamento), "MMM", { locale: ptBR })}</span>
                              <span className="text-xl font-black text-slate-900">{format(parseISO(s.dataAgendamento), "d")}</span>
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex items-center gap-3">
                                <h4 className="truncate text-lg font-black tracking-tight text-slate-900">{s.titulo}</h4>
                                <Badge className={cn("rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-wider", getStatusColor(s.status))}>{getStatusLabel(s.status)}</Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {s.horaInicio || "--:--"}</span>
                                {s.tipo && <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> {s.tipo}</span>}
                                {s.checklistProgress && (
                                  <span className={cn("px-2 py-0.5 rounded-lg border", s.checklistProgress.percentage >= 80 ? "border-emerald-200 text-emerald-600 bg-emerald-50" : "border-slate-100 text-slate-500")}>
                                    {s.checklistProgress.received}/{s.checklistProgress.total} DOCS
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 border-slate-100 hover:border-primary/20 bg-white shrink-0" onClick={() => router.push(`/agendamentos?id=${s.id}`)}>
                              DETALHES <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        <Dialog open={isBemDialogOpen} onOpenChange={setIsBemDialogOpen}>
  <DialogContent
    className="
      w-[300vw]
      h-[92vh]
      overflow-hidden
      rounded-[2rem]
      border border-primary/10
      bg-background
      shadow-2xl
      p-0
      flex
      flex-col
    "
  >
    {/* HEADER FIXO */}
    <DialogHeader
      className="
        shrink-0
        px-6
        py-5
        border-b
        border-muted/50
        bg-background
      "
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={cn(
              "h-11 w-11 rounded-2xl flex items-center justify-center shrink-0",
              editingBem
                ? "bg-amber-500/10 text-amber-600"
                : "bg-primary/10 text-primary"
            )}
          >
            {editingBem ? (
              <Pencil className="h-5 w-5" />
            ) : (
              <Package className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0">
            <DialogTitle className="text-xl font-black truncate">
              {editingBem
                ? "Editar Patrimônio"
                : "Novo Bem / Direito"}
            </DialogTitle>

            <DialogDescription
              className="
                mt-1
                flex
                items-center
                gap-2
                text-[10px]
                uppercase
                tracking-[0.18em]
                font-bold
                text-primary/50
              "
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
              Ficha IRPF {anoExercicio}
            </DialogDescription>
          </div>
        </div>

        {!editingBem && (
          <Button
            variant="outline"
            size="sm"
            onClick={generateDescricao}
            className="
              h-10
              rounded-xl
              px-4
              text-[10px]
              font-black
              tracking-widest
              border-primary/20
              hover:bg-primary/5
              shrink-0
            "
          >
            <Sparkles className="h-4 w-4 mr-2" />
            GERAR
          </Button>
        )}
      </div>
    </DialogHeader>

    <div
      className="
        flex-1
        overflow-y-auto
        px-6
        py-5
        scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20
      "
    >
      <div
        className="
          grid
          grid-cols-1
          lg:grid-cols-2
          gap-8
          h-full
        "
      >
        {/* COLUNA ESQUERDA */}
        <div className="space-y-5 min-h-0">
          {/* CLASSIFICAÇÃO */}
          <div className="rounded-3xl border border-muted/40 bg-muted/20 p-5">
            <h5
              className="
                mb-4
                flex
                items-center
                gap-2
                text-[10px]
                font-black
                uppercase
                tracking-widest
                text-muted-foreground
              "
            >
              <Filter className="h-3.5 w-3.5" />
              Classificação
            </h5>

            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Grupo">
                <Select
                  value={bemForm.grupo}
                  onValueChange={handleGrupoChange}
                >
                  <SelectTrigger
                    className="
                      h-12
                      rounded-2xl
                      border-muted-foreground/10
                      bg-background
                      font-bold
                      shadow-none
                    "
                  >
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent className="rounded-2xl" position="popper" sideOffset={4}>
                    {Object.entries(GRUPOS_BENS).map(
                      ([id, label]) => (
                        <SelectItem
                          key={id}
                          value={id}
                          className="text-xs font-semibold"
                        >
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </FieldGroup>

              <FieldGroup label="Código">
                <Select
                  value={bemForm.codigo}
                  onValueChange={handleBemSelect("codigo")}
                >
                  <SelectTrigger
                    className="
                      h-10
                      rounded-2xl
                      border-muted-foreground/10
                      bg-background
                      font-bold
                      shadow-none
                    "
                  >
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent className="rounded-2xl max-h-[260px]" position="popper" sideOffset={4}>
                    {Object.entries(
                      CODIGOS_BENS[bemForm.grupo] ?? {
                        "99": "Outros",
                      }
                    ).map(([id, label]) => (
                      <SelectItem
                        key={id}
                        value={id}
                        className="text-xs font-semibold"
                      >
                        <span className="mr-1.5 font-black text-primary/50">
                          {id}
                        </span>

                        {label as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldGroup>
            </div>
          </div>

          {/* CONDICIONAIS */}
          <div className="space-y-5">
            {showImovel && (
              <SecaoImovel
                form={bemForm}
                onChange={handleBemChange}
                onSelect={handleBemSelect}
                onCheckbox={handleBemCheckbox}
              />
            )}

            {showVeiculo && (
              <SecaoVeiculo
                form={bemForm}
                onChange={handleBemChange}
              />
            )}

            {showInst && (
              <SecaoInstituicao
                form={bemForm}
                onChange={handleBemChange}
              />
            )}

            {showCripto && (
              <SecaoCripto
                form={bemForm}
                onChange={handleBemChange}
                onCheckbox={handleBemCheckbox}
              />
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="flex flex-col gap-5 min-h-0">
          {/* DISCRIMINAÇÃO */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="mb-2 flex items-center justify-between">
              <Label
                className="
                  text-[10px]
                  font-black
                  uppercase
                  tracking-widest
                  text-muted-foreground/70
                "
              >
                Discriminação
              </Label>

              <span
                className="
                  text-[9px]
                  font-medium
                  text-muted-foreground/50
                  tabular-nums
                "
              >
                {bemForm.descricao.length} chars
              </span>
            </div>

            <Textarea
              value={bemForm.descricao}
              onChange={handleBemChange("descricao")}
              placeholder="Descreva o bem..."
              className="
                flex-1
                min-h-0
                resize-none
                rounded-3xl
                border-muted-foreground/10
                bg-muted/10
                p-5
                text-[13px]
                font-semibold
                leading-relaxed
                shadow-none
              "
            />
          </div>

          {/* VALORES */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label
                className="
                  ml-1
                  text-[10px]
                  font-black
                  uppercase
                  tracking-widest
                  text-muted-foreground/40
                "
              >
                Situação 31/12/{anoExercicio - 1}
              </Label>

              <Input
                value={bemForm.valorAnterior}
                onChange={handleBemBRL("valorAnterior")}
                className="
                  h-14
                  rounded-2xl
                  border-muted-foreground/10
                  bg-muted/10
                  px-5
                  text-lg
                  font-black
                  shadow-none
                "
              />
            </div>

            <div className="space-y-2">
              <Label
                className="
                  ml-1
                  text-[10px]
                  font-black
                  uppercase
                  tracking-widest
                  text-primary
                "
              >
                Situação 31/12/{anoExercicio}
              </Label>

              <div className="relative">
                <Input
                  value={bemForm.valorAtual}
                  onChange={handleBemBRL("valorAtual")}
                  className="
                    h-14
                    rounded-2xl
                    border-primary/20
                    bg-primary/[0.03]
                    px-5
                    pr-12
                    text-lg
                    font-black
                    text-primary
                    shadow-none
                  "
                />

                <TrendingUp
                  className="
                    absolute
                    right-4
                    top-1/2
                    h-5
                    w-5
                    -translate-y-1/2
                    text-primary/30
                  "
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* FOOTER FIXO */}
    <DialogFooter
      className="
        shrink-0
        border-t
        border-muted/50
        px-6
        py-5
        flex
        flex-row
        gap-3
      "
    >
      <Button
        variant="ghost"
        onClick={() => setIsBemDialogOpen(false)}
        className="
          h-12
          rounded-2xl
          px-6
          text-[10px]
          font-bold
          uppercase
          tracking-widest
        "
      >
        Descartar
      </Button>

      <Button
        onClick={handleSaveBem}
        disabled={savingBem}
        className="
          flex-1
          h-12
          rounded-2xl
          text-[11px]
          font-black
          uppercase
          tracking-widest
          shadow-lg
          shadow-primary/20
        "
      >
        {savingBem ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Finalizar e Salvar
          </>
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
        <AlertDialog open={isFinalizeDialogOpen} onOpenChange={setIsFinalizeDialogOpen}>
          <AlertDialogContent className="rounded-[2rem] border-primary/10 shadow-2xl overflow-hidden">
            <AlertDialogHeader className="p-8 pb-4">
              <AlertDialogTitle className="text-2xl font-black tracking-tight">
                {isFinalized ? "Reabrir Auditoria?" : "Finalizar Auditoria?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm font-bold text-muted-foreground/70 leading-relaxed">
                {isFinalized 
                  ? "Ao reabrir, você poderá editar todos os campos e documentos. O status da declaração voltará para 'Em Andamento'." 
                  : "Isso marcará o dossiê como concluído. O status da declaração mudará para 'Finalizada' na listagem geral."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="p-8 pt-4 bg-muted/30 gap-3">
              <AlertDialogCancel className="h-12 flex-1 rounded-2xl font-bold uppercase text-[10px] tracking-widest border-muted-foreground/10 hover:bg-background transition-all">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.preventDefault();
                  handleFinalizar();
                }}
                className="h-12 flex-1 rounded-2xl font-black uppercase text-[11px] tracking-widest bg-primary shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                disabled={finalizando}
              >
                {finalizando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
)

ContribuinteDetails.displayName = "ContribuinteDetails"

export default ContribuinteDetails
