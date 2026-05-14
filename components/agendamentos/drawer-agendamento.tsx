"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit,
  Loader2,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { ChecklistDocumentos } from "@/components/agendamentos/checklist-documentos";
import { LinkEnvioCliente } from "@/components/agendamentos/link-envio-cliente";
import { UploadDocumentos } from "@/components/agendamentos/upload-documentos";
import { DeclaracaoIrpfAssistente } from "@/components/declaracao-irpf-assistente";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { schedulingService, contribuinteService } from "@/lib/api/services";
import { formatCPF, getStatusColor, getStatusLabel } from "@/lib/format";
import { getProgressTone } from "@/lib/scheduling-checklist";
import type {
  Scheduling,
  SchedulingChecklistItem,
  SchedulingStatus,
} from "@/types";

type DrawerAgendamentoProps = {
  open: boolean;
  scheduling: Scheduling | null;
  actionLoading?: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (scheduling: Scheduling) => void;
  onDelete: (id: number) => void;
  onStatusChange: (
    scheduling: Scheduling,
    status: SchedulingStatus
  ) => Promise<Scheduling | void> | Scheduling | void;
  onUpdated: (scheduling: Scheduling) => void;
};

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value || "-"}</div>
    </div>
  );
}

export function DrawerAgendamento({
  open,
  scheduling,
  actionLoading = false,
  onOpenChange,
  onEdit,
  onDelete,
  onStatusChange,
  onUpdated,
}: DrawerAgendamentoProps) {
  const [checklistDraft, setChecklistDraft] = useState<SchedulingChecklistItem[]>([]);
  const [checklistDirty, setChecklistDirty] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const { data, isLoading, mutate } = useSWR(
    open && scheduling ? ["agendamento-detail", scheduling.id] : null,
    () => schedulingService.get(scheduling!.id),
    { revalidateOnFocus: false }
  );

  const detail = data?.agendamento ?? scheduling;

  const { data: contribData } = useSWR(
    open && detail?.contribuinteId
      ? ["contribuinte-irpf", detail.contribuinteId]
      : null,
    () => contribuinteService.get(detail!.contribuinteId as number),
    { revalidateOnFocus: false }
  );

  const declaracaoIrpfId = contribData?.declaracoes?.[0]?.id;

  useEffect(() => {
    if (!detail || checklistDirty) return;
    setChecklistDraft(detail.checklist ?? []);
  }, [detail, checklistDirty]);

  const progress = detail?.checklistProgress ?? {
    received: 0,
    total: 12,
    percentage: 0,
  };

  const progressTone = getProgressTone(progress.percentage);

  const formattedDate = useMemo(() => {
    if (!detail?.dataAgendamento) return "-";

    return format(parseISO(detail.dataAgendamento), "EEEE, d 'de' MMMM 'de' yyyy", {
      locale: ptBR,
    });
  }, [detail?.dataAgendamento]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && checklistDirty) {
      setConfirmCloseOpen(true);
      return;
    }

    onOpenChange(nextOpen);
  }

  function handleUpdated(updated: Scheduling, resetDraft = false) {
    void mutate({ agendamento: updated }, false);
    onUpdated(updated);

    if (resetDraft) {
      setChecklistDraft(updated.checklist);
      setChecklistDirty(false);
    }
  }

  async function saveChecklist() {
    if (!detail) return;

    try {
      setSavingChecklist(true);
      const response = await schedulingService.updateChecklist(
        detail.id,
        checklistDraft
      );
      handleUpdated(response.agendamento, true);
      toast.success("Checklist salvo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar checklist");
    } finally {
      setSavingChecklist(false);
    }
  }

  function updateChecklistDraft(items: SchedulingChecklistItem[]) {
    setChecklistDraft(items);
    setChecklistDirty(true);
  }

  async function changeStatus(status: SchedulingStatus) {
    if (!detail) return;

    const updated = await onStatusChange(detail, status);
    if (updated) {
      handleUpdated(updated, true);
    }
  }

  function discardAndClose() {
    setChecklistDirty(false);
    setConfirmCloseOpen(false);
    onOpenChange(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {detail && (
            <>
              <SheetHeader className="border-b px-6 py-5">
                <div className="mr-8 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={getStatusColor(detail.status)}>
                      {getStatusLabel(detail.status)}
                    </Badge>
                    <Badge className={`${progressTone.bgClass} ${progressTone.textClass}`}>
                      {progress.received} / {progress.total} documentos
                    </Badge>
                  </div>

                  <div>
                    <SheetTitle className="text-xl">{detail.titulo}</SheetTitle>
                    <SheetDescription className="mt-1">
                      {formattedDate}
                    </SheetDescription>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${progressTone.barClass} transition-all`}
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              </SheetHeader>

              {isLoading ? (
                <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando detalhes...
                </div>
              ) : (
                <Tabs defaultValue="resumo" className="min-h-0 flex-1 gap-0">
                  <div className="border-b px-6 py-3">
                    <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-5">
                      <TabsTrigger value="resumo">Resumo</TabsTrigger>
                      <TabsTrigger value="documentos">Docs</TabsTrigger>
                      <TabsTrigger value="checklist">Checklist</TabsTrigger>
                      <TabsTrigger value="assistente">Assistente</TabsTrigger>
                      <TabsTrigger value="historico">Historico</TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    <TabsContent value="resumo" className="mt-0 space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <DetailLine
                          label="Contribuinte"
                          value={
                            <span className="inline-flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {detail.nome}
                            </span>
                          }
                        />
                        <DetailLine label="CPF" value={formatCPF(detail.cpf)} />
                        <DetailLine
                          label="Data"
                          value={
                            <span className="inline-flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-muted-foreground" />
                              {detail.dataAgendamento
                                ? format(parseISO(detail.dataAgendamento), "dd/MM/yyyy")
                                : "-"}
                            </span>
                          }
                        />
                        <DetailLine
                          label="Horario"
                          value={
                            <span className="inline-flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {detail.horaInicio || "-"} {detail.horaFim ? `- ${detail.horaFim}` : ""}
                            </span>
                          }
                        />
                        <DetailLine label="Responsavel" value={detail.responsavel} />
                        <DetailLine label="Tipo" value={detail.tipo} />
                      </div>

                      {(detail.descricao || detail.observacoes) && (
                        <div className="space-y-3 rounded-lg border bg-background p-4">
                          {detail.descricao && (
                            <DetailLine label="Descricao" value={detail.descricao} />
                          )}
                          {detail.observacoes && (
                            <DetailLine label="Observacoes" value={detail.observacoes} />
                          )}
                        </div>
                      )}

                      <LinkEnvioCliente
                        agendamentoId={detail.id}
                        link={detail.envioLink}
                        onUpdated={(updated) => handleUpdated(updated, true)}
                      />
                    </TabsContent>

                    <TabsContent value="documentos" className="mt-0">
                      <UploadDocumentos
                        agendamentoId={detail.id}
                        documents={detail.documents}
                        checklist={checklistDirty ? checklistDraft : detail.checklist}
                        onUpdated={(updated) => handleUpdated(updated)}
                      />
                    </TabsContent>

                    <TabsContent value="checklist" className="mt-0">
                      <ChecklistDocumentos
                        items={checklistDraft}
                        documents={detail.documents}
                        dirty={checklistDirty}
                        saving={savingChecklist}
                        onChange={updateChecklistDraft}
                        onSave={saveChecklist}
                      />
                    </TabsContent>

                    <TabsContent value="assistente" className="mt-0 space-y-4">
                      {!detail.contribuinteId ? (
                        <p className="text-sm text-muted-foreground">
                          Vincule um contribuinte ao agendamento para usar o
                          assistente IRPF.
                        </p>
                      ) : !declaracaoIrpfId ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma declaração encontrada para este contribuinte.
                          Importe um XML na tela de importação primeiro.
                        </p>
                      ) : (
                        <DeclaracaoIrpfAssistente
                          declaracaoId={declaracaoIrpfId}
                          anoExercicio={
                            contribData?.declaracoes?.[0]?.anoExercicio
                          }
                          agendamentoId={detail.id}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="historico" className="mt-0">
                      <div className="space-y-3">
                        {detail.history?.length ? (
                          detail.history.map((item) => (
                            <div key={item.id} className="rounded-lg border bg-background p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-medium">{item.acao}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                                </div>
                              </div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                {item.detalhes || "Sem detalhes"}
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {item.responsavel || "Cliente"}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Nenhuma acao registrada.
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              )}

              <div className="flex flex-wrap gap-2 border-t px-6 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(detail)}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>

                {detail.status === "agendado" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void changeStatus("cancelado")}
                      disabled={actionLoading}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void changeStatus("confirmado")}
                      disabled={actionLoading}
                      className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar
                    </Button>
                  </>
                )}

                {detail.status === "confirmado" && (
                  <Button
                    size="sm"
                    onClick={() => void changeStatus("concluido")}
                    disabled={actionLoading}
                    className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Concluir
                  </Button>
                )}

                {detail.status === "cancelado" && (
                  <Badge variant="outline" className="gap-2">
                    <XCircle className="h-4 w-4" />
                    Cancelado
                  </Badge>
                )}

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(detail.id)}
                  disabled={actionLoading}
                  className="ml-auto gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alteracoes?</AlertDialogTitle>
            <AlertDialogDescription>
              O checklist possui alteracoes nao salvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={discardAndClose}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
