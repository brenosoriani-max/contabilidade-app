"use client"

import { useState, useCallback } from "react"

import { AppHeader } from "@/components/app-header"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { Badge } from "@/components/ui/badge"

import { Progress } from "@/components/ui/progress"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  UserPlus,
  FileUp,
  Trash2,
  FileSpreadsheet,
  X,
} from "lucide-react"

import {
  contribuinteService,
  importService,
} from "@/lib/api/services"

import {
  formatCPF,
  formatCurrency,
  getResultColor,
  getResultLabel,
} from "@/lib/format"

import type { Declaration } from "@/lib/types"

interface FileUploadState {
  file: File
  status: "pending" | "processing" | "success" | "error"
  result?: Partial<Declaration>
  error?: string
}

const EMPTY_FORM = {
  cpf: "",
  nome: "",
  exercicio: "2026",
  dataNascimento: "",
  endereco: "",
  bairro: "",
  municipio: "",
  uf: "",
  cep: "",
  totalRendPJ: "",
  totalIRRF: "",
  totalPrevOficial: "",
}

const UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]

export default function ImportarPage() {
  const [uploadedFiles, setUploadedFiles] =
    useState<FileUploadState[]>([])

  const [isProcessing, setIsProcessing] =
    useState(false)

  const [overallProgress, setOverallProgress] =
    useState(0)

  const [manualSubmitted, setManualSubmitted] =
    useState(false)

  const [manualForm, setManualForm] =
    useState(EMPTY_FORM)

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()

      const files = Array.from(
        e.dataTransfer.files
      ).filter((f) =>
        f.name.toLowerCase().endsWith(".xml")
      )

      addFiles(files)
    },
    []
  )

  const handleFileInput = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files) return

    const files = Array.from(
      e.target.files
    ).filter((f) =>
      f.name.toLowerCase().endsWith(".xml")
    )

    addFiles(files)
  }

  const addFiles = (files: File[]) => {
    const mapped: FileUploadState[] = files.map(
      (file) => ({
        file,
        status: "pending",
      })
    )

    setUploadedFiles((prev) => [
      ...prev,
      ...mapped,
    ])
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) =>
      prev.filter((_, i) => i !== index)
    )
  }

  const clearAll = () => {
    setUploadedFiles([])
    setOverallProgress(0)
  }

  const processFiles = async () => {
    setIsProcessing(true)
    setOverallProgress(0)

    const pending = uploadedFiles.filter(
      (f) => f.status === "pending"
    )

    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.status === "pending"
          ? {
              ...f,
              status: "processing",
            }
          : f
      )
    )

    try {
      const response = await importService.xml(
        pending.map((item) => item.file)
      )

      const results = response.results ?? []

      setUploadedFiles((prev) =>
        prev.map((fileState) => {
          const result = results.find(
            (item) =>
              item.file === fileState.file.name
          )

          if (!result) return fileState

          return result.success
            ? {
                ...fileState,
                status: "success",
                result: {
                  cpf: result.cpf,
                  nome: result.nome,
                  resultadoDeclaracao: null,
                  impostoRestituir: 0,
                  saldoPagar: 0,
                },
              }
            : {
                ...fileState,
                status: "error",
                error:
                  result.error ||
                  "Erro ao processar XML",
              }
        })
      )

      setOverallProgress(100)
    } catch (error) {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.status === "processing"
            ? {
                ...f,
                status: "error",
                error:
                  error instanceof Error
                    ? error.message
                    : "Erro desconhecido",
              }
            : f
        )
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const successCount = uploadedFiles.filter(
    (f) => f.status === "success"
  ).length

  const errorCount = uploadedFiles.filter(
    (f) => f.status === "error"
  ).length

  const pendingCount = uploadedFiles.filter(
    (f) => f.status === "pending"
  ).length

  const handleManualSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    await contribuinteService.create({
      cpf: manualForm.cpf,
      nome: manualForm.nome,
      dataNascimento:
        manualForm.dataNascimento,
      enderecoLogradouro:
        manualForm.endereco,
      enderecoBairro: manualForm.bairro,
      enderecoMunicipio:
        manualForm.municipio,
      enderecoUf: manualForm.uf,
      enderecoCep: manualForm.cep,
    })

    setManualSubmitted(true)

    setManualForm(EMPTY_FORM)

    setTimeout(() => {
      setManualSubmitted(false)
    }, 3000)
  }

  return (
    <>
      <AppHeader
        title="Importar Declarações"
        description="Importe arquivos XML ou cadastre contribuintes manualmente"
      />

      <main className="flex-1 overflow-auto p-6 space-y-6">
        <Tabs
          defaultValue="xml"
          className="space-y-6"
        >
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl bg-muted p-1">
            <TabsTrigger
              value="xml"
              className="gap-2 rounded-lg"
            >
              <FileUp className="h-4 w-4" />
              Importar XML
            </TabsTrigger>

            <TabsTrigger
              value="manual"
              className="gap-2 rounded-lg"
            >
              <UserPlus className="h-4 w-4" />
              Cadastro Manual
            </TabsTrigger>
          </TabsList>

          {/* XML */}
          <TabsContent
            value="xml"
            className="space-y-6"
          >
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>
                  Upload de Arquivos XML
                </CardTitle>

                <CardDescription>
                  Arraste os arquivos XML da
                  declaração IRPF
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) =>
                    e.preventDefault()
                  }
                  onClick={() =>
                    document
                      .getElementById(
                        "file-input"
                      )
                      ?.click()
                  }
                  className="group cursor-pointer rounded-2xl border-2 border-dashed border-primary/20 bg-gradient-to-b from-primary/5 to-background p-12 text-center transition-all hover:border-primary/40 hover:bg-primary/5"
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".xml"
                    multiple
                    className="hidden"
                    onChange={handleFileInput}
                  />

                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Upload className="h-10 w-10" />
                  </div>

                  <h3 className="text-xl font-semibold">
                    Arraste arquivos XML aqui
                  </h3>

                  <p className="mt-2 text-sm text-muted-foreground">
                    ou clique para selecionar
                    arquivos
                  </p>

                  <Badge className="mt-5">
                    Importação em massa
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {uploadedFiles.length > 0 && (
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>
                        Arquivos Selecionados
                      </CardTitle>

                      <CardDescription>
                        {
                          uploadedFiles.length
                        }{" "}
                        arquivo(s) •{" "}
                        {successCount} sucesso •{" "}
                        {errorCount} erro •{" "}
                        {pendingCount} pendente
                      </CardDescription>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={clearAll}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpar
                      </Button>

                      <Button
                        onClick={
                          processFiles
                        }
                        disabled={
                          isProcessing ||
                          pendingCount === 0
                        }
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processando
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Processar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  {isProcessing && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          Progresso geral
                        </span>

                        <span>
                          {overallProgress}%
                        </span>
                      </div>

                      <Progress
                        value={
                          overallProgress
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    {uploadedFiles.map(
                      (
                        fileState,
                        index
                      ) => (
                        <div
                          key={index}
                          className={`flex items-center gap-4 rounded-xl border p-4 transition-all ${
                            fileState.status ===
                            "success"
                              ? "border-emerald-200 bg-emerald-50/70"
                              : fileState.status ===
                                "error"
                              ? "border-red-200 bg-red-50/70"
                              : fileState.status ===
                                "processing"
                              ? "border-blue-200 bg-blue-50/70"
                              : "border-border bg-muted/30"
                          }`}
                        >
                          <div>
                            {fileState.status ===
                              "pending" && (
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            )}

                            {fileState.status ===
                              "processing" && (
                              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                            )}

                            {fileState.status ===
                              "success" && (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            )}

                            {fileState.status ===
                              "error" && (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {
                                fileState.file
                                  .name
                              }
                            </p>

                            {fileState.status ===
                              "success" &&
                              fileState.result && (
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">
                                    {formatCPF(
                                      fileState
                                        .result
                                        .cpf
                                    )}{" "}
                                    •{" "}
                                    {
                                      fileState
                                        .result
                                        .nome
                                    }
                                  </span>

                                  <Badge
                                    variant="secondary"
                                    className={getResultColor(
                                      fileState
                                        .result
                                        .resultadoDeclaracao ||
                                        null
                                    )}
                                  >
                                    {getResultLabel(
                                      fileState
                                        .result
                                        .resultadoDeclaracao ||
                                        null
                                    )}
                                  </Badge>

                                  {fileState.result
                                    .resultadoDeclaracao ===
                                    "RESTITUIR" && (
                                    <span className="font-medium text-emerald-600">
                                      +
                                      {formatCurrency(
                                        fileState
                                          .result
                                          .impostoRestituir
                                      )}
                                    </span>
                                  )}

                                  {fileState.result
                                    .resultadoDeclaracao ===
                                    "PAGAR" && (
                                    <span className="font-medium text-red-600">
                                      -
                                      {formatCurrency(
                                        fileState
                                          .result
                                          .saldoPagar
                                      )}
                                    </span>
                                  )}
                                </div>
                              )}

                            {fileState.status ===
                              "error" && (
                              <p className="mt-1 text-sm text-red-600">
                                {
                                  fileState.error
                                }
                              </p>
                            )}
                          </div>

                          {fileState.status ===
                            "pending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                removeFile(
                                  index
                                )
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )
                    )}
                  </div>

                  {successCount > 0 &&
                    !isProcessing && (
                      <Alert className="border-emerald-200 bg-emerald-50">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />

                        <AlertTitle>
                          Importação concluída
                        </AlertTitle>

                        <AlertDescription>
                          {
                            successCount
                          }{" "}
                          declaração(ões)
                          importada(s) com
                          sucesso.
                        </AlertDescription>
                      </Alert>
                    )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* MANUAL */}
          <TabsContent
            value="manual"
            className="space-y-6"
          >
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>
                  Cadastro Manual
                </CardTitle>

                <CardDescription>
                  Preencha os dados do
                  contribuinte
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form
                  onSubmit={
                    handleManualSubmit
                  }
                  className="space-y-8"
                >
                  {manualSubmitted && (
                    <Alert className="border-emerald-200 bg-emerald-50">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />

                      <AlertTitle>
                        Sucesso
                      </AlertTitle>

                      <AlertDescription>
                        Contribuinte
                        cadastrado com
                        sucesso.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* IDENTIFICAÇÃO */}
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Identificação
                      </h3>

                      <p className="text-sm text-muted-foreground">
                        Dados principais do
                        contribuinte
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="cpf">
                          CPF *
                        </Label>

                        <Input
                          id="cpf"
                          placeholder="000.000.000-00"
                          value={
                            manualForm.cpf
                          }
                          onChange={(e) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                cpf: e.target
                                  .value,
                              })
                            )
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="nome">
                          Nome Completo *
                        </Label>

                        <Input
                          id="nome"
                          placeholder="Nome do contribuinte"
                          value={
                            manualForm.nome
                          }
                          onChange={(e) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                nome: e.target
                                  .value,
                              })
                            )
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Exercício
                        </Label>

                        <Select
                          value={
                            manualForm.exercicio
                          }
                          onValueChange={(
                            value
                          ) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                exercicio:
                                  value,
                              })
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="2026">
                              2026
                            </SelectItem>

                            <SelectItem value="2025">
                              2025
                            </SelectItem>

                            <SelectItem value="2024">
                              2024
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Data de
                          Nascimento
                        </Label>

                        <Input
                          type="date"
                          value={
                            manualForm.dataNascimento
                          }
                          onChange={(e) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                dataNascimento:
                                  e.target
                                    .value,
                              })
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* ENDEREÇO */}
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Endereço
                      </h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-3">
                        <Label>
                          Logradouro
                        </Label>

                        <Input
                          placeholder="Rua, avenida, etc."
                          value={
                            manualForm.endereco
                          }
                          onChange={(e) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                endereco:
                                  e.target
                                    .value,
                              })
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Bairro
                        </Label>

                        <Input
                          placeholder="Bairro"
                          value={
                            manualForm.bairro
                          }
                          onChange={(e) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                bairro:
                                  e.target
                                    .value,
                              })
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Município
                        </Label>

                        <Input
                          placeholder="Cidade"
                          value={
                            manualForm.municipio
                          }
                          onChange={(e) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                municipio:
                                  e.target
                                    .value,
                              })
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>UF</Label>

                        <Select
                          value={
                            manualForm.uf
                          }
                          onValueChange={(
                            value
                          ) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                uf: value,
                              })
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>

                          <SelectContent>
                            {UF_OPTIONS.map(
                              (uf) => (
                                <SelectItem
                                  key={uf}
                                  value={uf}
                                >
                                  {uf}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>CEP</Label>

                        <Input
                          placeholder="00000-000"
                          value={
                            manualForm.cep
                          }
                          onChange={(e) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                cep: e.target
                                  .value,
                              })
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* RENDIMENTOS */}
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Rendimentos
                      </h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>
                          Rendimentos PJ
                        </Label>

                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={
                            manualForm.totalRendPJ
                          }
                          onChange={(e) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                totalRendPJ:
                                  e.target
                                    .value,
                              })
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>
                          IRRF Retido
                        </Label>

                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={
                            manualForm.totalIRRF
                          }
                          onChange={(e) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                totalIRRF:
                                  e.target
                                    .value,
                              })
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Previdência
                          Oficial
                        </Label>

                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={
                            manualForm.totalPrevOficial
                          }
                          onChange={(e) =>
                            setManualForm(
                              (
                                prev
                              ) => ({
                                ...prev,
                                totalPrevOficial:
                                  e.target
                                    .value,
                              })
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />

                    <AlertTitle>
                      Informação
                    </AlertTitle>

                    <AlertDescription>
                      Os campos marcados
                      com * são
                      obrigatórios.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setManualForm(
                          EMPTY_FORM
                        )
                      }
                    >
                      Limpar
                    </Button>

                    <Button type="submit">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Cadastrar
                      Contribuinte
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}