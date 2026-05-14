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

      <div className="space-y-4">
      
      <div className="rounded-lg border bg-background p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px] md:items-end">
          <div className="space-y-2">
            <div className="text-sm font-medium">Arquivos</div>
            <Input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.xml,application/pdf,image/jpeg,image/png,application/xml,text/xml"
              onChange={(event) => {
                void handleUpload(event.target.files);
                event.target.value = "";
              }}
              disabled={uploading}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Vincular ao checklist</div>
            <Select
              value={selectedChecklistItemId}
              onValueChange={setSelectedChecklistItemId}
              disabled={uploading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem vinculo</SelectItem>
                {checklist.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{documents.length} arquivo(s)</Badge>
          <span>Total: {formatBytes(totalSize)}</span>
        </div>
      </div>

      <div className="space-y-2">
        {documents.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum documento anexado.
          </div>
        ) : (
          documents.map((document) => (
            <div
              key={document.id}
              className="flex flex-col gap-3 rounded-lg border bg-background p-3 md:flex-row md:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="rounded-md bg-muted p-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{document.nome}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{document.tipo || getFileExtension(document.nome).replace(".", "").toUpperCase()}</span>
                    <span>{formatBytes(document.tamanhoBytes)}</span>
                    <span>
                      {new Date(document.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                    {document.checklistItemId && (
                      <Badge variant="outline">
                        {checklistById.get(document.checklistItemId) ?? "Checklist"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                {document.url && (
                  <>
                    <Button
                      size="icon-sm"
                      variant="outline"
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
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      size="icon-sm"
                      variant="outline"
                      title="Download"
                      asChild
                    >
                      <a
                        href={`/api/agendamentos/${agendamentoId}/documentos/${document.id}/view`}
                        download
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Download: ${document.nome}`}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>

                  </>
                )}

                <Button
                  size="icon-sm"
                  variant="outline"
                  title="Excluir"
                  onClick={() => handleDelete(document)}
                  disabled={deletingId === document.id}
                >
                  {deletingId === document.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-red-600" />
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

