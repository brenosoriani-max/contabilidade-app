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
import { cn } from "@/lib/utils";

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
      <main className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <header className="relative overflow-hidden rounded-[2.5rem] border-0 bg-white p-8 shadow-xl shadow-slate-200/50">
             <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
             <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl" />
             
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 p-2 shadow-inner">
                  <Image
                    src="/logo-contec.png"
                    alt="CONTEC"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                </div>

                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                    Portal de Envio
                  </h1>

                  <div className="mt-1 flex flex-col space-y-0.5">
                    <p className="text-sm font-bold text-primary">
                      {data.agendamento.nome}
                    </p>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                       {data.agendamento.titulo}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Badge
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest shadow-sm",
                    progressTone.bgClass,
                    progressTone.textClass
                  )}
                >
                  {progress.received} / {progress.total} DOCUMENTOS
                </Badge>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   Status da Entrega
                </span>
              </div>
            </div>

            <div className="mt-8 space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                 <span>Progresso Atual</span>
                 <span>{progress.percentage}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
                <div
                  className={cn("h-full transition-all duration-1000 ease-out", progressTone.barClass)}
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          </header>

          {error && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300 rounded-2xl border-2 border-red-100 bg-red-50/50 p-4 text-sm font-bold text-red-700 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              {error}
            </div>
          )}

          <section className="grid gap-4">
            <div className="flex items-center gap-2 px-2 text-xs font-black uppercase tracking-widest text-slate-400">
               <FileUp className="h-3 w-3" />
               Checklist de Documentação
            </div>
            {data.agendamento.checklist.map((item) => {
              const itemDocuments = documentsForItem(item);
              const disabled = item.status === "nao_aplica";
              const isUploading = uploadingItemId === item.id;
              const isReceived = item.status === "recebido";

              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative overflow-hidden rounded-[2rem] border-2 bg-white p-6 transition-all",
                    isReceived ? "border-emerald-100 shadow-emerald-100/20" : "border-slate-100 hover:border-primary/20 hover:shadow-xl hover:shadow-slate-200/40",
                    disabled && "opacity-50 grayscale bg-slate-50"
                  )}
                >
                  <div className="flex flex-col gap-6 md:flex-row md:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className={cn("text-lg font-black tracking-tight", isReceived ? "text-emerald-900" : "text-slate-900")}>
                          {item.nome}
                        </h2>

                        <Badge className={cn(
                          "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border-0",
                          isReceived ? "bg-emerald-500 text-white" : 
                          disabled ? "bg-slate-200 text-slate-500" : "bg-amber-400 text-amber-900"
                        )}>
                          {isReceived ? "Recebido" : disabled ? "N/A" : "Pendente"}
                        </Badge>
                      </div>

                      {itemDocuments.length > 0 && (
                        <div className="mt-4 grid gap-2">
                          {itemDocuments.map((document) => (
                            <div
                              key={document.id}
                              className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="rounded-lg bg-white p-2 shadow-sm">
                                   <FileUp className="h-4 w-4 text-primary" />
                                </div>
                                <span className="truncate text-xs font-bold text-slate-600 uppercase tracking-tight text-ellipsis overflow-hidden">
                                  {document.nome}
                                </span>
                              </div>

                              <button
                                type="button"
                                className="group/btn flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all shrink-0"
                                onClick={() => setDeleteConfirm(document)}
                                disabled={deletingDocumentId === document.id}
                                title="Excluir arquivo"
                              >
                                {deletingDocumentId === document.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative w-full md:w-72 shrink-0">
                      <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 transition-all hover:border-primary hover:bg-white disabled:opacity-50">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.xml"
                          disabled={disabled || isUploading}
                          onChange={(event) => {
                            void uploadFiles(item, event.target.files);
                            event.target.value = "";
                          }}
                        />
                        
                        {isUploading ? (
                          <div className="flex flex-col items-center gap-2">
                             <Loader2 className="h-8 w-8 animate-spin text-primary" />
                             <span className="text-[10px] font-black uppercase tracking-widest text-primary">Enviando...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-center">
                             <UploadCloud className="h-8 w-8 text-slate-300 group-hover:text-primary transition-colors" />
                             <div className="space-y-0.5">
                                <span className="block text-xs font-bold text-slate-900 leading-none">Anexar Arquivo</span>
                                <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest">PDF, JPG, PNG, XML</span>
                             </div>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <footer className="flex flex-col items-center justify-center gap-4 py-8 border-t border-slate-200">
             <div className="flex items-center gap-3 grayscale opacity-30">
               <Image src="/logo-contec.png" alt="CONTEC" width={24} height={24} />
               <span className="text-xs font-black tracking-widest">CONTEC CONTABILIDADE</span>
             </div>
             
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <UploadCloud className="h-3 w-3" />
              Link seguro e válido até {new Date(data.expiresAt).toLocaleDateString("pt-BR")}
            </div>
          </footer>
        </div>
      </main>

      {deleteConfirm && (
        <AlertDialog
          open={!!deleteConfirm}
          onOpenChange={() => setDeleteConfirm(null)}
        >
          <AlertDialogContent className="rounded-[2rem] border-0 shadow-2xl">
            <AlertDialogHeader className="space-y-3">
              <AlertDialogTitle className="text-xl font-black text-slate-900">
                Confirmar Exclusão
              </AlertDialogTitle>

              <AlertDialogDescription className="font-medium text-slate-500 leading-relaxed">
                Tem certeza que deseja excluir o arquivo 
                <strong className="mx-1 text-slate-900 break-all">
                  {deleteConfirm.nome}
                </strong>
                ? Esta ação não pode ser desfeita e o status do item pode voltar para pendente.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="mt-8 gap-3 sm:gap-0">
              <AlertDialogCancel className="rounded-2xl border-slate-200 font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all px-6 border-2">
                Cancelar
              </AlertDialogCancel>

              <AlertDialogAction
                className="rounded-2xl bg-red-500 font-black uppercase tracking-widest text-white hover:bg-red-600 shadow-lg shadow-red-200 transition-all px-8"
                onClick={() => void deleteDocument(deleteConfirm.id)}
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
