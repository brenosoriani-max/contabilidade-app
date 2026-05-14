"use client"

import { useEffect, useMemo, useState } from "react"

import { AppHeader } from "@/components/app-header"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { Loader2, Save } from "lucide-react"

type Configuracoes = {
  id: number
  nomeEmpresa: string | null
  cnpjEmpresa: string | null
  emailSuporte: string | null
  corTema: string | null
}

export default function ConfiguracoesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    nomeEmpresa: "",
    cnpjEmpresa: "",
    emailSuporte: "",
    corTema: "#2563eb",
  })

  const normalizeHex = (value: string) => {
    const v = value.trim().toLowerCase()
    if (!v) return null
    const withHash = v.startsWith('#') ? v : `#${v}`
    const hex = withHash.length === 7 ? withHash : null
    return hex
  }

  const themePreview = useMemo(() => {
    return normalizeHex(form.corTema) ?? "#2563eb"
  }, [form.corTema])


  useEffect(() => {
    ;(async () => {
      try {
        setIsLoading(true)
        setError(null)

        const res = await fetch("/api/configuracoes", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })

        if (!res.ok) {
          throw new Error(`Falha ao carregar configurações (${res.status})`)
        }

        const json = await res.json()
        const cfg: Configuracoes | null = json?.configuracoes ?? null

        setForm({
          nomeEmpresa: cfg?.nomeEmpresa ?? "",
          cnpjEmpresa: cfg?.cnpjEmpresa ?? "",
          emailSuporte: cfg?.emailSuporte ?? "",
          corTema: cfg?.corTema ?? "#2563eb",
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido")
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsSaving(true)
      setError(null)

      const payload = {
        nomeEmpresa: form.nomeEmpresa.trim() || null,
        cnpjEmpresa: form.cnpjEmpresa.trim() || null,
        emailSuporte: form.emailSuporte.trim() || null,
        corTema: form.corTema.trim() || null,
      }

      const res = await fetch("/api/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`Falha ao salvar configurações (${res.status})`)
      }

      // Opcional: recarrega (garante consistência)
      const reload = await fetch("/api/configuracoes")
      const json = await reload.json()
      const cfg: Configuracoes | null = json?.configuracoes ?? null

      setForm({
        nomeEmpresa: cfg?.nomeEmpresa ?? "",
        cnpjEmpresa: cfg?.cnpjEmpresa ?? "",
        emailSuporte: cfg?.emailSuporte ?? "",
        corTema: cfg?.corTema ?? "#2563eb",
      })
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Erro desconhecido")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <AppHeader title="Configurações" description="Ajustes do sistema e preferências" />

      <main className="flex-1 overflow-auto p-6 space-y-6">
        {error && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando configurações...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Configurações da Empresa</CardTitle>
                    <CardDescription>Informações usadas no sistema</CardDescription>
                  </div>

                  <div className="hidden md:flex items-center gap-2">
                    <div className="h-10 w-10 rounded-xl border bg-muted/20 flex items-center justify-center">
                      <div
                        className="h-5 w-5 rounded-full"
                        style={{ background: themePreview }}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="nomeEmpresa">Nome da empresa</Label>
                    <Input
                      id="nomeEmpresa"
                      value={form.nomeEmpresa}
                      onChange={(e) => setForm((p) => ({ ...p, nomeEmpresa: e.target.value }))}
                      placeholder="Ex: Contabilidade Contec"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cnpjEmpresa">CNPJ (opcional)</Label>
                    <Input
                      id="cnpjEmpresa"
                      value={form.cnpjEmpresa}
                      onChange={(e) => setForm((p) => ({ ...p, cnpjEmpresa: e.target.value }))}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emailSuporte">Email do suporte (opcional)</Label>
                    <Input
                      id="emailSuporte"
                      type="email"
                      value={form.emailSuporte}
                      onChange={(e) => setForm((p) => ({ ...p, emailSuporte: e.target.value }))}
                      placeholder="suporte@empresa.com"
                    />
                  </div>

                  

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="submit" disabled={isSaving} className="gap-2">
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Salvar alterações
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preferências</CardTitle>
                  <CardDescription>Exemplos de configurações futuras</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={""}
                      onChange={() => {}}
                      placeholder="(em breve)"
                      disabled
                      className="opacity-60"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>Gerencie credenciais no seu perfil</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Para trocar senha e dados pessoais, utilize a página de <b>Meu Perfil</b>.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

