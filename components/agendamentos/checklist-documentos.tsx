"use client";

import { Ban, CheckCircle2, Circle, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  SchedulingChecklistItem,
  SchedulingChecklistStatus,
  SchedulingDocument,
} from "@/types";

type ChecklistDocumentosProps = {
  items: SchedulingChecklistItem[];
  documents?: SchedulingDocument[];
  editable?: boolean;
  dirty?: boolean;
  saving?: boolean;
  onChange?: (items: SchedulingChecklistItem[]) => void;
  onSave?: () => void;
};

const STATUS_OPTIONS: Array<{
  value: SchedulingChecklistStatus;
  label: string;
  icon: ComponentType<{ className?: string }>;
  className: string;
}> = [
  {
    value: "pendente",
    label: "Pendente",
    icon: Circle,
    className: "text-slate-600 hover:bg-slate-100",
  },
  {
    value: "recebido",
    label: "Recebido",
    icon: CheckCircle2,
    className: "text-emerald-700 hover:bg-emerald-50",
  },
  {
    value: "nao_aplica",
    label: "N/A",
    icon: Ban,
    className: "text-slate-400 hover:bg-slate-100",
  },
];

function getStatusBadge(status: SchedulingChecklistStatus) {
  switch (status) {
    case "recebido":
      return "bg-emerald-100 text-emerald-700";
    case "nao_aplica":
      return "bg-slate-100 text-slate-500";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function reorder(items: SchedulingChecklistItem[]) {
  return items.map((item, index) => ({
    ...item,
    ordem: index,
  }));
}

export function ChecklistDocumentos({
  items,
  documents = [],
  editable = true,
  dirty = false,
  saving = false,
  onChange,
  onSave,
}: ChecklistDocumentosProps) {
  function updateItem(
    itemId: number,
    patch: Partial<SchedulingChecklistItem>
  ) {
    onChange?.(
      reorder(
        items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                ...patch,
              }
            : item
        )
      )
    );
  }

  function addItem() {
    const id = -Date.now();
    onChange?.(
      reorder([
        ...items,
        {
          id,
          schedulingId: items[0]?.schedulingId ?? 0,
          chave: `custom-${Math.abs(id)}`,
          nome: "Novo documento",
          status: "pendente",
          ordem: items.length,
          updatedAt: new Date().toISOString(),
        },
      ])
    );
  }

  function removeItem(itemId: number) {
    onChange?.(reorder(items.filter((item) => item.id !== itemId)));
  }

  function countDocuments(item: SchedulingChecklistItem) {
    return documents.filter(
      (doc) => doc.checklistItemId === item.id || doc.checklistItemKey === item.chave
    ).length;
  }

  return (
    <div className="space-y-5">
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-muted/30 border border-muted/50">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-foreground">Gestão de Documentos</h3>
            <p className="text-[11px] text-muted-foreground uppercase font-black tracking-widest">Controle total dos arquivos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addItem} className="h-9 gap-2 shadow-sm bg-background">
              <Plus className="h-4 w-4" />
              Adicionar item
            </Button>

            <Button size="sm" onClick={onSave} disabled={!dirty || saving} className="h-9 gap-2 shadow-md">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando" : "Salvar checklist"}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {items.map((item) => {
          const linkedDocuments = countDocuments(item);
          const isPending = item.status === "pendente";
          const isReceived = item.status === "recebido";
          const isNa = item.status === "nao_aplica";

          return (
            <div
              key={item.id}
              className={cn(
                "group relative overflow-hidden rounded-2xl border-2 bg-background p-4 transition-all hover:shadow-lg",
                isReceived ? "border-emerald-100 bg-emerald-50/20" : 
                isNa ? "border-slate-100 opacity-60 grayscale" : 
                "border-slate-100 hover:border-primary/20",
                "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
                isReceived ? "before:bg-emerald-500" : 
                isNa ? "before:bg-slate-300" : 
                isPending ? "before:bg-amber-400" : "before:bg-slate-200"
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {editable ? (
                      <Input
                        value={item.nome}
                        onChange={(event) =>
                          updateItem(item.id, {
                            nome: event.target.value,
                          })
                        }
                        className="h-7 border-0 bg-transparent p-0 text-sm font-bold text-foreground shadow-none focus-visible:ring-0 focus-visible:bg-slate-100/50 focus-visible:px-2 rounded-md"
                      />
                    ) : (
                      <div className="text-sm font-bold text-foreground">{item.nome}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider", getStatusBadge(item.status))}>
                      {STATUS_OPTIONS.find((option) => option.value === item.status)?.label}
                    </Badge>

                    {linkedDocuments > 0 && (
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        {linkedDocuments} ARQUIVO(S) VINCULADO(S)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-1.5 sm:border-l sm:pl-4">
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = item.status === option.value;

                    return (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={active ? "secondary" : "ghost"}
                        disabled={!editable}
                        onClick={() =>
                          updateItem(item.id, {
                            status: option.value,
                          })
                        }
                        className={cn(
                          "h-9 px-3 rounded-xl transition-all",
                          active ? "shadow-md ring-1 ring-border" : "hover:bg-muted font-medium",
                          active && option.value === "recebido" && "bg-emerald-500 text-white hover:bg-emerald-600",
                          active && option.value === "pendente" && "bg-amber-400 text-amber-900 hover:bg-amber-500",
                          active && option.value === "nao_aplica" && "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        )}
                        title={option.label}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:ml-2 sm:inline text-[11px] font-bold uppercase tracking-wider">
                           {option.label}
                        </span>
                      </Button>
                    );
                  })}

                  {editable && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeItem(item.id)}
                      className="h-9 w-9 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
