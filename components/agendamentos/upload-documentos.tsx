"use client";

import { useMemo, useState } from "react";
import { FileText, Loader2, Trash2, Eye, Download } from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { schedulingService } from "@/lib/api/services";
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_FILE_SIZE,
} from "@/lib/scheduling-checklist";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  Scheduling,
  SchedulingChecklistItem,
  SchedulingDocument,
} from "@/types";

type UploadDocumentosProps = {
  agendamentoId: number;
  documents: SchedulingDocument[];
  checklist: SchedulingChecklistItem[];
  onUpdated: (scheduling: Scheduling) => void;
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function validateClientFile(file: File) {
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(getFileExtension(file.name))) {
    return `${file.name}: tipo nao permitido`;
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    return `${file.name}: maximo de 10MB`;
  }

  return null;
}

type ViewerState =
  | { open: true; document: SchedulingDocument; src: string }
  | { open: false; document: null; src: '' };

export function UploadDocumentos({
  agendamentoId,
  documents,
  checklist,
  onUpdated,
}: UploadDocumentosProps) {
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState("none");
  const [viewer, setViewer] = useState<ViewerState>({
    open: false,
    document: null,
    src: '',
  });

  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const totalSize = useMemo(
    () => documents.reduce((sum, document) => sum + (document.tamanhoBytes || 0), 0),
    [documents]
  );

  const checklistById = useMemo(
    () => new Map(checklist.map((item) => [item.id, item.nome])),
    [checklist]
  );

  async function handleUpload(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;

    const validationError = selectedFiles.map(validateClientFile).find(Boolean);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setUploading(true);

      const response = await schedulingService.uploadDocuments(
        agendamentoId,
        selectedFiles,
        selectedChecklistItemId === "none" ? null : Number(selectedChecklistItemId)
      );

      onUpdated(response.agendamento);
      toast.success("Documento(s) anexado(s)");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar documentos");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(document: SchedulingDocument) {
    if (!confirm(`Excluir ${document.nome}?`)) return;

    try {
      setDeletingId(document.id);
      const response = await schedulingService.deleteDocument(agendamentoId, document.id);
      onUpdated(response.agendamento);
      toast.success("Documento excluido");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir documento");
    } finally {
      setDeletingId(null);
    }
  }

  const viewerSrc = viewer.open ? viewer.src : null;

  return (
    <>
      <Dialog
        open={viewer.open}
        onOpenChange={(open) => {
          if (!open) setViewer({ open: false, document: null, src: '' });
        }}
      >
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="px-6 pt-5">
            <DialogTitle className="text-base font-semibold">
              {viewer.open ? viewer.document.nome : 'Documento'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Visualizando no navegador
            </DialogDescription>
          </DialogHeader>

          <div className="h-[70vh] w-full px-6 pb-6">
            {viewerSrc && viewer.open && viewer.document?.tipo === 'application/pdf' ? (
              <iframe
                className="h-full w-full rounded-md border"
                src={viewerSrc}
              />
            ) : viewerSrc && viewer.open && viewer.document?.tipo?.startsWith('image/') ? (
              <img
                className="h-full w-full rounded-md border object-contain"
                src={viewerSrc}
                alt={viewer.document.nome}
              />
            ) : viewerSrc && viewer.open ? (
              <iframe
                className="h-full w-full rounded-md border"
                src={viewerSrc}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div className="rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-[1fr_240px] md:items-end">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                <FileText className="h-3.5 w-3.5" />
                Selecionar Arquivos
              </div>
              <Input
                type="file"
                multiple
                className="h-12 border-2 border-dashed border-slate-200 bg-slate-50/50 p-2 hover:border-primary/50 hover:bg-white transition-all cursor-pointer"
                accept=".pdf,.jpg,.jpeg,.png,.xml,application/pdf,image/jpeg,image/png,application/xml,text/xml"
                onChange={(event) => {
                  void handleUpload(event.target.files);
                  event.target.value = "";
                }}
                disabled={uploading}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                Checklist
              </div>
              <Select
                value={selectedChecklistItemId}
                onValueChange={setSelectedChecklistItemId}
                disabled={uploading}
              >
                <SelectTrigger className="h-12 rounded-xl border-2 border-slate-100 bg-slate-50/30 font-bold text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-2">
                  <SelectItem value="none" className="font-bold">Sem vínculo direto</SelectItem>
                  {checklist.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)} className="font-medium">
                      {item.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-50 pt-4">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/20 px-3 border-0 font-black tracking-widest uppercase text-[10px]">
                {documents.length} ARQUIVOS
              </Badge>
            </div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Espaço Utilizado: <span className="text-slate-900 ml-1">{formatBytes(totalSize)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-100 bg-slate-50/20 p-12 text-center">
              <div className="rounded-full bg-slate-100 p-4 mb-4">
                <FileText className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Nenhum documento anexado ainda.
              </p>
            </div>
          ) : (
            documents.map((document) => (
              <div
                key={document.id}
                className="group flex flex-col gap-4 rounded-[2rem] border-2 border-slate-100 bg-white p-5 transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-slate-200/30 md:flex-row md:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-2 shadow-inner group-hover:bg-primary/5 transition-colors">
                    <FileText className="h-7 w-7 text-slate-400 group-hover:text-primary transition-colors" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="truncate text-sm font-black text-slate-900 tracking-tight">{document.nome}</div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-slate-500">{document.tipo || getFileExtension(document.nome).replace(".", "").toUpperCase()}</span>
                      <span>{formatBytes(document.tamanhoBytes)}</span>
                      <span>{new Date(document.createdAt).toLocaleDateString("pt-BR")}</span>
                      {document.checklistItemId && (
                        <Badge className="bg-emerald-500 text-white border-0 text-[10px] px-3 rounded-full font-black tracking-widest">
                          {checklistById.get(document.checklistItemId) ?? "Checklist"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2 border-t border-slate-50 pt-4 md:border-0 md:pt-0">
                  {document.url && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-11 w-11 rounded-2xl hover:bg-primary/5 hover:text-primary text-slate-400 transition-all"
                        title="Visualizar"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setViewer({
                            open: true,
                            document,
                            src: `/api/agendamentos/${agendamentoId}/documentos/${document.id}/view`,
                          });
                        }}
                      >
                        <Eye className="h-5 w-5" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-11 w-11 rounded-2xl hover:bg-slate-100 text-slate-400 transition-all"
                        title="Download"
                        asChild
                      >
                        <a
                          href={`/api/agendamentos/${agendamentoId}/documentos/${document.id}/view`}
                          download
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Download: ${document.nome}`}
                        >
                          <Download className="h-5 w-5" />
                        </a>
                      </Button>
                    </>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 rounded-2xl hover:bg-red-50 hover:text-red-500 text-slate-400 transition-all"
                    title="Excluir"
                    onClick={() => handleDelete(document)}
                    disabled={deletingId === document.id}
                  >
                    {deletingId === document.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Trash2 className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
