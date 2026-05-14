"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileUp,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_FILE_SIZE,
  calculateChecklistProgress,
  getProgressTone,
} from "@/lib/scheduling-checklist";

import type {
  ApiResponse,
  SchedulingChecklistItem,
  SchedulingDocument,
} from "@/types";

type PublicSchedulingPayload = {
  token: string;
  expiresAt: string;

  agendamento: {
    id: number;
    titulo: string;
    nome: string;
    dataAgendamento: string;
    checklist: SchedulingChecklistItem[];
    documents: SchedulingDocument[];
  };
};

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");

  return index >= 0
    ? fileName.slice(index).toLowerCase()
    : "";
}

function validateFile(file: File) {
  if (
    !ALLOWED_DOCUMENT_EXTENSIONS.includes(
      getFileExtension(file.name)
    )
  ) {
    return `${file.name}: tipo nao permitido`;
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    return `${file.name}: maximo de 10MB`;
  }

  return null;
}

async function unwrapPublic<T>(
  response: Response
) {
  const payload =
    (await response.json()) as ApiResponse<T>;

  if (!payload.success) {
    throw new Error(payload.error);
  }

  return payload.data;
}

export default function EnviarDocumentosPage() {
  const params = useParams<{
    token: string;
  }>();

  const token = params.token;

  const [data, setData] =
    useState<PublicSchedulingPayload | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  const [uploadingItemId, setUploadingItemId] =
    useState<number | null>(null);

  const [
    deletingDocumentId,
    setDeletingDocumentId,
  ] = useState<number | null>(null);

  const [deleteConfirm, setDeleteConfirm] =
    useState<SchedulingDocument | null>(
      null
    );

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const payload =
          await unwrapPublic<PublicSchedulingPayload>(
            await fetch(
              `/api/envio-documentos/${token}`
            )
          );

        setData(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Erro ao carregar link"
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [token]);

  const progress = useMemo(
    () =>
      calculateChecklistProgress(
        data?.agendamento.checklist
      ),
    [data?.agendamento.checklist]
  );

  const progressTone = getProgressTone(
    progress.percentage
  );

  async function uploadFiles(
    item: SchedulingChecklistItem,
    files: FileList | null
  ) {
    const selectedFiles = Array.from(
      files ?? []
    );

    if (!selectedFiles.length || !data)
      return;

    const validationError = selectedFiles
      .map(validateFile)
      .find(Boolean);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError("");

      setUploadingItemId(item.id);

      const formData = new FormData();

      formData.append(
        "checklistItemId",
        String(item.id)
      );

      selectedFiles.forEach((file) =>
        formData.append("files", file)
      );

      const payload =
        await unwrapPublic<PublicSchedulingPayload>(
          await fetch(
            `/api/envio-documentos/${token}`,
            {
              method: "POST",
              body: formData,
            }
          )
        );

      setData(payload);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Erro ao enviar arquivo"
      );
    } finally {
      setUploadingItemId(null);
    }
  }

  async function deleteDocument(
    documentId: number
  ) {
    if (!data) return;

    try {
      setError("");

      setDeletingDocumentId(documentId);

      const payload =
        await unwrapPublic<PublicSchedulingPayload>(
          await fetch(
            `/api/envio-documentos/${token}/${documentId}`,
            {
              method: "DELETE",
            }
          )
        );

      setData(payload);

      setDeleteConfirm(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Erro ao excluir documento"
      );
    } finally {
      setDeletingDocumentId(null);
    }
  }

  function documentsForItem(
    item: SchedulingChecklistItem
  ) {
    return (
      data?.agendamento.documents.filter(
        (document) =>
          document.checklistItemId ===
            item.id ||
          document.checklistItemKey ===
            item.chave
      ) ?? []
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando...
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md rounded-lg border bg-background p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">
            Link indisponivel
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {error ||
              "Nao foi possivel carregar este envio de documentos."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-muted/30 p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <header className="rounded-lg border bg-background p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo-contec.png"
                  alt="CONTEC"
                  width={44}
                  height={44}
                />

                <div>
                  <h1 className="text-xl font-semibold">
                    Envio de documentos
                  </h1>

                  <p className="text-sm text-muted-foreground">
                    {data.agendamento.nome} -{" "}
                    {data.agendamento.titulo}
                  </p>
                </div>
              </div>

              <Badge
                className={`${progressTone.bgClass} ${progressTone.textClass}`}
              >
                {progress.received} /{" "}
                {progress.total} recebidos
              </Badge>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${progressTone.barClass} transition-all`}
                style={{
                  width: `${progress.percentage}%`,
                }}
              />
            </div>
          </header>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="space-y-3">
            {data.agendamento.checklist.map(
              (item) => {
                const itemDocuments =
                  documentsForItem(item);

                const disabled =
                  item.status ===
                  "nao_aplica";

                const uploading =
                  uploadingItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-background p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-medium">
                            {item.nome}
                          </h2>

                          {item.status ===
                            "recebido" && (
                            <Badge className="bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Recebido
                            </Badge>
                          )}

                          {item.status ===
                            "pendente" && (
                            <Badge className="bg-slate-100 text-slate-600">
                              Pendente
                            </Badge>
                          )}

                          {disabled && (
                            <Badge className="bg-slate-100 text-slate-500">
                              Nao se aplica
                            </Badge>
                          )}
                        </div>

                        {itemDocuments.length >
                          0 && (
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {itemDocuments.map(
                              (document) => (
                                <div
                                  key={
                                    document.id
                                  }
                                  className="flex flex-wrap items-center gap-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <FileUp className="h-3 w-3" />

                                    <span className="truncate">
                                      {
                                        document.nome
                                      }
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-md border border-transparent bg-red-100 px-2 py-1 text-[11px] font-medium text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() =>
                                      setDeleteConfirm(
                                        document
                                      )
                                    }
                                    disabled={
                                      deletingDocumentId ===
                                      document.id
                                    }
                                  >
                                    {deletingDocumentId ===
                                    document.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}

                                    Excluir
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>

                      <div className="w-full md:w-64">
                        <Input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.xml,application/pdf,image/jpeg,image/png,application/xml,text/xml"
                          disabled={
                            disabled ||
                            uploading
                          }
                          onChange={(
                            event
                          ) => {
                            void uploadFiles(
                              item,
                              event.target
                                .files
                            );

                            event.target.value =
                              "";
                          }}
                        />

                        {uploading && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />

                            Enviando...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </section>

          <footer className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <UploadCloud className="h-4 w-4" />

            Link valido ate{" "}
            {new Date(
              data.expiresAt
            ).toLocaleDateString(
              "pt-BR"
            )}
          </footer>
        </div>
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
                Confirmar Exclusao
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
                  void deleteDocument(
                    deleteConfirm.id
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
  );
}