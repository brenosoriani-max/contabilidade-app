"use client";

import { Ban, CheckCircle2, Circle, Plus, Save, Trash2 } from "lucide-react";
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
    <div className="space-y-4">
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar item
          </Button>

          <Button size="sm" onClick={onSave} disabled={!dirty || saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando" : "Salvar checklist"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const linkedDocuments = countDocuments(item);

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-lg border bg-background p-3 transition",
                item.status === "nao_aplica" && "bg-muted/40 opacity-75"
              )}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  {editable ? (
                    <Input
                      value={item.nome}
                      onChange={(event) =>
                        updateItem(item.id, {
                          nome: event.target.value,
                        })
                      }
                      className="h-8 border-transparent bg-transparent px-0 font-medium shadow-none focus-visible:border-input focus-visible:px-2"
                    />
                  ) : (
                    <div className="font-medium">{item.nome}</div>
                  )}

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge className={cn("rounded-full", getStatusBadge(item.status))}>
                      {STATUS_OPTIONS.find((option) => option.value === item.status)?.label}
                    </Badge>

                    {linkedDocuments > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {linkedDocuments} arquivo(s)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
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
                          "h-8 px-2",
                          option.className,
                          active && "ring-1 ring-border"
                        )}
                        title={option.label}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{option.label}</span>
                      </Button>
                    );
                  })}

                  {editable && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => removeItem(item.id)}
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
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
