"use client"

import {
  useEffect,
  useMemo,
  useState,
} from "react"

import dynamic from "next/dynamic"

import {
  useParams,
  useRouter,
} from "next/navigation"

import {
  ArrowLeft,
  RefreshCcw,
} from "lucide-react"

import { AppHeader } from "@/components/app-header"

import { Button } from "@/components/ui/button"

import {
  Card,
  CardContent,
} from "@/components/ui/card"

import { Skeleton } from "@/components/ui/skeleton"

import { contribuinteService } from "@/lib/api/services"

import type {
  BemDireito,
  ContribuinteSummary,
  Declaration,
} from "@/types"

const ContribuinteDetails = dynamic(
  () =>
    import(
      "@/components/contribuinte-details"
    ).then(
      (mod) =>
        mod.ContribuinteDetails
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    ),
  }
)

interface ApiResponse {
  contribuinte?: ContribuinteSummary
  declaracoes?: Declaration[]
  bens?: BemDireito[]
  rendimentos?: unknown[]
}

export default function ContribuintePage() {
  const params = useParams()
  const router = useRouter()

  const contribuinteId = useMemo(
    () => Number(params.id),
    [params.id]
  )

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contribuinte, setContribuinte] = useState<ContribuinteSummary | null>(null)
  const [declaration, setDeclaration] = useState<Declaration | null>(null)
  const [assets, setAssets] = useState<BemDireito[]>([])

  async function loadData(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const payload: ApiResponse =
        await contribuinteService.get(contribuinteId)

      if (!payload) {
        throw new Error("Nenhum dado retornado pela API")
      }

      const contribuinteData = payload.contribuinte || null
      const declarationData = payload.declaracoes?.[0] || null

      if (!contribuinteData) {
        throw new Error("Contribuinte não encontrado")
      }

      setContribuinte(contribuinteData)
      setDeclaration(declarationData)
      setAssets(
        Array.isArray(payload.bens)
          ? payload.bens
          : []
      )
    } catch (err: any) {
      console.error("ERRO COMPLETO:", err)
      setError(err?.message || "Erro ao carregar dados")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!contribuinteId) return
    loadData()
  }, [contribuinteId])

  return (
    <>
      <main className="flex-1 overflow-auto bg-background">
        <div className="w-full">
          {loading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : error ? (
            <div className="p-8">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-red-600">
                    Erro ao carregar contribuinte
                  </h3>
                  <p className="text-sm text-red-500">{error}</p>
                  <Button
                    className="mt-4"
                    onClick={() => loadData()}
                  >
                    Tentar novamente
                  </Button>
                </div>
              </div>
            </div>
          ) : contribuinte ? (
            <ContribuinteDetails
              contribuinte={contribuinte}
              declaration={declaration}
              assets={assets}
              onDataRefresh={() => loadData(true)}
            />
          ) : (
            <div className="p-20 text-center">
              <p className="text-muted-foreground text-lg">
                Contribuinte não encontrado.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => router.push("/contribuintes")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para lista
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}