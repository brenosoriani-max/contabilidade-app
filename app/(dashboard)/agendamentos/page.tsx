"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  XCircle,
} from "lucide-react";

import { DrawerAgendamento } from "@/components/agendamentos/drawer-agendamento";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { contribuinteService, schedulingService } from "@/lib/api/services";
import { formatCPF, getStatusColor, getStatusLabel } from "@/lib/format";
import { getProgressTone } from "@/lib/scheduling-checklist";
import type { ContribuinteSummary, Scheduling, SchedulingStatus } from "@/types";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

type SchedulingFilter = SchedulingStatus | "all";

function ProgressIndicator({ scheduling }: { scheduling: Scheduling }) {
  const progress = scheduling.checklistProgress ?? {
    received: 0,
    total: 12,
    percentage: 0,
  };
  
  // Cores semânticas conforme requisito:
  // Vermelho: < 40%
  // Amarelo: 40% - 79%
  // Verde: >= 80%
  const colors = 
    progress.percentage < 40 
      ? { text: "text-red-600", bar: "bg-red-500" }
      : progress.percentage < 80
        ? { text: "text-amber-600", bar: "bg-amber-500" }
        : { text: "text-emerald-600", bar: "bg-emerald-500" };

  return (
    <div className="mt-1.5 w-full space-y-1">
      <div className={`flex justify-between items-center text-[10px] font-bold ${colors.text}`}>
        <span>{progress.received} / {progress.total} documentos</span>
        <span>{progress.percentage}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 shadow-inner">
        <div
          className={`h-full ${colors.bar} transition-all duration-500 ease-out`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function AgendamentosPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedScheduling, setSelectedScheduling] = useState<Scheduling | null>(null);
  const [statusFilter, setStatusFilter] = useState<SchedulingFilter>("all");
  const [actionLoading, setActionLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingScheduling, setEditingScheduling] = useState<Scheduling | null>(null);
  const [allForDay, setAllForDay] = useState<Scheduling[]>([]);

  // Combobox
  const [comboOpen, setComboOpen] = useState(false);
  const [contribuinteSearch, setContribuinteSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Scheduling | null>(null);

  const [formData, setFormData] = useState({
    contribuinteId: "",
    titulo: "",
    descricao: "",
    dataAgendamento: "",
    horaInicio: "",
    horaFim: "",
    tipo: "declaracao",
    observacoes: "",
  });

  // Debounce da busca — dispara a chamada à API só 300ms após parar de digitar
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(contribuinteSearch), 300);
    return () => clearTimeout(timer);
  }, [contribuinteSearch]);

  const { data, mutate, isLoading } = useSWR(
    ["agendamentos", statusFilter],
    () => schedulingService.list({ status: statusFilter === "all" ? undefined : statusFilter }),
    { revalidateOnFocus: false }
  );

  // Abrir agendamento se vier ID na URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("id");
    if (id && data?.agendamentos) {
      const found = data.agendamentos.find((s) => s.id === Number(id));
      if (found) {
        setSelectedScheduling(found);
        // Limpar a URL para não reabrir ao atualizar
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [data?.agendamentos]);

  const { data: contributorsData } = useSWR(
    ["contribuintes-agendamento", debouncedSearch],
    () =>
      contribuinteService.list({
        search: debouncedSearch,
        page: 1,
        limit: 20,
      }),
    { revalidateOnFocus: false }
  );

  const schedulings = data?.agendamentos || [];
  const contributors = contributorsData?.contribuintes || [];

  const filteredSchedulings = useMemo(() => {
    return schedulings.filter(
      (scheduling) => statusFilter === "all" || scheduling.status === statusFilter
    );
  }, [schedulings, statusFilter]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const pendingCount = filteredSchedulings.filter((s) => s.status === "agendado").length;
  const confirmedCount = filteredSchedulings.filter((s) => s.status === "confirmado").length;
  const completedCount = filteredSchedulings.filter((s) => s.status === "concluido").length;
  const canceledCount = filteredSchedulings.filter((s) => s.status === "cancelado").length;

  function getSchedulingsForDay(date: Date) {
    return filteredSchedulings.filter((scheduling) =>
      isSameDay(parseISO(scheduling.dataAgendamento), date)
    );
  }

  function resetForm(date?: string) {
    setFormData({
      contribuinteId: "",
      titulo: "",
      descricao: "",
      dataAgendamento: date || "",
      horaInicio: "",
      horaFim: "",
      tipo: "declaracao",
      observacoes: "",
    });
    setContribuinteSearch("");
    setDebouncedSearch("");
  }

  function handleCreateScheduling(date?: string) {
    resetForm(date);
    setEditingScheduling(null);
    setFormOpen(true);
  }

  function handleUpdatePage(){
    window.location.reload();
  }

  function handleEditScheduling(scheduling: Scheduling) {
    setEditingScheduling(scheduling);
    setContribuinteSearch(scheduling.nome || "");
    setDebouncedSearch(scheduling.nome || "");
    setFormData({
      contribuinteId: scheduling.contribuinteId?.toString() || "",
      titulo: scheduling.titulo || "",
      descricao: scheduling.descricao || "",
      dataAgendamento: scheduling.dataAgendamento?.slice(0, 10) || "",
      horaInicio: scheduling.horaInicio || "",
      horaFim: scheduling.horaFim || "",
      tipo: scheduling.tipo || "declaracao",
      observacoes: scheduling.observacoes || "",
    });
    setFormOpen(true);
  }

  function selectContributor(value: string) {
    const contributor = contributors.find(
      (item: ContribuinteSummary) => String(item.id) === value
    );

    setFormData((current) => ({
      ...current,
      contribuinteId: value,
      titulo: current.titulo || (contributor ? `Declaração IRPF - ${contributor.nome}` : ""),
    }));
  }

  async function saveScheduling() {
    try {
      setFormLoading(true);

      if (!formData.titulo) {
        alert("Informe o titulo");
        return;
      }

      if (!formData.dataAgendamento) {
        alert("Informe a data");
        return;
      }

      const response = editingScheduling
        ? await schedulingService.update(editingScheduling.id, formData)
        : await schedulingService.create(formData);

      await mutate();
      setSelectedScheduling(response.agendamento);
      setFormOpen(false);
      setEditingScheduling(null);
      resetForm();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar agendamento");
    } finally {
      setFormLoading(false);
    }
  }

  async function updateSchedulingStatus(
    scheduling: Scheduling,
    status: SchedulingStatus
  ) {
    try {
      setActionLoading(true);

      const response = await schedulingService.update(scheduling.id, {
        ...scheduling,
        status,
      });

      await mutate();
      setSelectedScheduling(response.agendamento);
      return response.agendamento;
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar status");
    } finally {
      setActionLoading(false);
    }
  }


async function deleteScheduling(id: number) {
  try {
    setActionLoading(true);

    await schedulingService.remove(id);

    await mutate();

    setSelectedScheduling(null);

    setDeleteConfirm(null);
  } catch (error) {
    console.error(error);
    alert("Erro ao excluir agendamento");
  } finally {
    setActionLoading(false);
  }
}

  function handleSchedulingUpdated(scheduling: Scheduling) {
    setSelectedScheduling((current) =>
      current?.id === scheduling.id ? scheduling : current
    );
    void mutate();
  }

  function getStatusIcon(status: SchedulingStatus) {
    switch (status) {
      case "agendado":
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case "confirmado":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "concluido":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "cancelado":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  }

  // Label do contribuinte selecionado para exibir no botão do combobox
  const selectedContributorLabel = useMemo(() => {
    if (!formData.contribuinteId) return null;
    return contributors.find((c) => String(c.id) === formData.contribuinteId) ?? null;
  }, [formData.contribuinteId, contributors]);

  if (isLoading) {
    return (
      <>
        <AppHeader
          title="Agendamentos IRPF"
          description="Carregando agendamentos"
        />

        <main className="flex items-center justify-center p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando...
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Agendamentos IRPF"
        description="Gerencie os agendamentos"
      />

      <main className="space-y-6 p-6">
        <div className="flex justify-end gap-4">
          <Button onClick={() => handleCreateScheduling()} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>

           <Button onClick={() => handleUpdatePage()} className="gap-2" variant="secondary">
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="mt-2 text-3xl font-bold">{filteredSchedulings.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Agendados</div>
              <div className="mt-2 text-3xl font-bold text-amber-600">{pendingCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Confirmados</div>
              <div className="mt-2 text-3xl font-bold text-emerald-600">
                {confirmedCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Concluidos</div>
              <div className="mt-2 text-3xl font-bold text-blue-600">
                {completedCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Cancelados</div>
              <div className="mt-2 text-3xl font-bold text-red-600">{canceledCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <h2 className="min-w-[220px] text-center text-2xl font-bold capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </h2>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as SchedulingFilter)}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="agendado">Agendados</SelectItem>
                  <SelectItem value="confirmado">Confirmados</SelectItem>
                  <SelectItem value="concluido">Concluidos</SelectItem>
                  <SelectItem value="cancelado">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-hidden rounded-xl border">
              <div className="grid grid-cols-7 bg-muted/40">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="border-b p-3 text-center text-sm font-semibold"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const daySchedulings = getSchedulingsForDay(day);
                  const current = isSameMonth(day, currentMonth);
                  const today = isToday(day);

                  return (
                    <div
                      key={index}
                      className={`min-h-[152px] cursor-pointer border-b border-r p-2 ${
                        !current ? "bg-muted/20" : ""
                      } ${today ? "bg-primary/5" : ""}`}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).tagName === "BUTTON") return;
                        handleCreateScheduling(format(day, "yyyy-MM-dd"));
                      }}
                      tabIndex={0}
                      aria-label={`Criar agendamento em ${format(day, "dd/MM/yyyy")}`}
                    >
                      <div
                        className={`mb-2 text-sm ${
                          today ? "font-bold text-primary" : ""
                        }`}
                      >
                        {format(day, "d")}
                      </div>

                      <div className="flex flex-col gap-1">
                        {daySchedulings.slice(0, 2).map((scheduling) => (
                          <button
                            key={scheduling.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedScheduling(scheduling);
                            }}
                            className={`group relative min-h-[72px] w-full rounded-xl border border-slate-200/60 p-2.5 text-left text-xs transition-all hover:border-primary/50 hover:bg-white hover:shadow-md focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 ${
                              scheduling.status === "confirmado"
                                ? "bg-emerald-50/50"
                                : scheduling.status === "agendado"
                                  ? "bg-amber-50/50"
                                  : scheduling.status === "concluido"
                                    ? "bg-blue-50/50"
                                    : "bg-red-50/50"
                            }`}
                            type="button"
                          >
                            <span className="block font-semibold">
                              {scheduling.horaInicio || "--:--"}
                            </span>
                            <span className="block truncate">{scheduling.nome}</span>
                            <ProgressIndicator scheduling={scheduling} />
                          </button>
                        ))}

                        {daySchedulings.length > 2 && (
                          <button
                            type="button"
                            className="mt-1 w-full text-xs text-primary underline hover:opacity-80"
                            onClick={(event) => {
                              event.stopPropagation();
                              setAllForDay(daySchedulings);
                            }}
                          >
                            +{daySchedulings.length - 2} mais
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proximos Agendamentos</CardTitle>
            <CardDescription>Lista organizada por data</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {filteredSchedulings.map((scheduling) => (
                <button
                  key={scheduling.id}
                  onClick={() => setSelectedScheduling(scheduling)}
                  className="w-full rounded-xl border bg-background p-4 text-left transition-all hover:bg-muted/50"
                  type="button"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10">
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(scheduling.dataAgendamento), "MMM", {
                          locale: ptBR,
                        })}
                      </span>
                      <span className="text-lg font-bold">
                        {format(parseISO(scheduling.dataAgendamento), "d")}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{scheduling.nome}</span>
                        {getStatusIcon(scheduling.status)}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {scheduling.horaInicio || "--:--"}
                        </span>
                        <span className="font-mono">{formatCPF(scheduling.cpf)}</span>
                      </div>

                      <div className="mt-3 max-w-sm">
                        <ProgressIndicator scheduling={scheduling} />
                      </div>
                    </div>

                    <Badge className={getStatusColor(scheduling.status)}>
                      {getStatusLabel(scheduling.status)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      <DrawerAgendamento
        open={!!selectedScheduling && allForDay.length === 0}
        scheduling={selectedScheduling}
        actionLoading={actionLoading}
        onOpenChange={(open) => {
          if (!open) setSelectedScheduling(null);
        }}
        onEdit={handleEditScheduling}
       onDelete={(id) => {
        const scheduling = schedulings.find(
          (item) => item.id === id
        );

        if (scheduling) {
          setDeleteConfirm(scheduling);
        }
      }}
        onStatusChange={updateSchedulingStatus}
        onUpdated={handleSchedulingUpdated}
      />

      {/* Dialog: múltiplos agendamentos no dia */}
      <Dialog open={allForDay.length > 0} onOpenChange={() => setAllForDay([])}>
        <DialogContent className="max-w-md border-0 bg-gradient-to-br from-white to-slate-50 shadow-lg">
          <DialogHeader className="border-b border-slate-200 pb-4">
            <DialogTitle className="text-xl font-bold text-slate-900">
              Agendamentos do dia
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-96 space-y-3 overflow-y-auto">
            {allForDay.map((scheduling) => (
              <button
                key={scheduling.id}
                onClick={() => {
                  setSelectedScheduling(scheduling);
                  setAllForDay([]);
                }}
                className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all hover:shadow-md ${
                  scheduling.status === "confirmado"
                    ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400"
                    : scheduling.status === "agendado"
                      ? "border-amber-200 bg-amber-50 hover:border-amber-400"
                      : scheduling.status === "concluido"
                        ? "border-blue-200 bg-blue-50 hover:border-blue-400"
                        : "border-red-200 bg-red-50 hover:border-red-400"
                }`}
                type="button"
              >
                <div className="flex items-start gap-3">
                  <div className="flex min-w-max flex-col">
                    <span className="text-sm font-bold text-slate-900">
                      {scheduling.horaInicio || "--:--"}
                    </span>
                    <span className="text-xs text-slate-500">{scheduling.horaFim}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{scheduling.nome}</p>
                    <p className="truncate text-xs text-slate-600">
                      {formatCPF(scheduling.cpf)}
                    </p>
                    <ProgressIndicator scheduling={scheduling} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: criar / editar agendamento */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setComboOpen(false);
        }}
      >
        <DialogContent className="max-w-xl border-0 bg-gradient-to-br from-white to-slate-50 shadow-lg">
          <DialogHeader className="border-b border-slate-200 pb-0">
            <DialogTitle className="text-2xl font-bold text-slate-900">
              {editingScheduling ? "Editar Agendamento" : "Novo Agendamento"}
            </DialogTitle>
            <DialogDescription className="mt-0 text-slate-500">
              {editingScheduling
                ? "Atualize os dados do agendamento"
                : "Preencha os dados para criar um novo agendamento"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Combobox de contribuinte */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">
                Contribuinte
              </Label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between border-slate-200 font-normal text-slate-700"
                  >
                    {selectedContributorLabel ? (
                      <span className="truncate">
                        {selectedContributorLabel.nome}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatCPF(selectedContributorLabel.cpf)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Buscar por nome ou CPF...
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                  side="bottom"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Digite o nome ou CPF..."
                      value={contribuinteSearch}
                      onValueChange={setContribuinteSearch}
                    />
                    <CommandEmpty>Nenhum contribuinte encontrado.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          selectContributor("");
                          setComboOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            !formData.contribuinteId ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        Sem contribuinte
                      </CommandItem>

                      {contributors.map((contributor) => (
                        <CommandItem
                          key={contributor.id}
                          value={String(contributor.id)}
                          onSelect={() => {
                            selectContributor(String(contributor.id));
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 shrink-0 ${
                              formData.contribuinteId === String(contributor.id)
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />
                          <span className="truncate font-medium">{contributor.nome}</span>
                          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                            {formatCPF(contributor.cpf)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Titulo</Label>
              <Input
                placeholder="Ex: Declaracão de IRPF"
                value={formData.titulo}
                onChange={(event) =>
                  setFormData({ ...formData, titulo: event.target.value })
                }
                className="border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Descricao</Label>
              <Textarea
                placeholder="Descreva os detalhes do agendamento..."
                value={formData.descricao}
                onChange={(event) =>
                  setFormData({ ...formData, descricao: event.target.value })
                }
                className="min-h-24 border-slate-200"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Data</Label>
                <Input
                  type="date"
                  value={formData.dataAgendamento}
                  onChange={(event) =>
                    setFormData({ ...formData, dataAgendamento: event.target.value })
                  }
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Inicio</Label>
                <Input
                  type="time"
                  value={formData.horaInicio}
                  onChange={(event) =>
                    setFormData({ ...formData, horaInicio: event.target.value })
                  }
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Fim</Label>
                <Input
                  type="time"
                  value={formData.horaFim}
                  onChange={(event) =>
                    setFormData({ ...formData, horaFim: event.target.value })
                  }
                  className="border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">
                Observacoes
              </Label>
              <Textarea
                placeholder="Adicione observacoes..."
                value={formData.observacoes}
                onChange={(event) =>
                  setFormData({ ...formData, observacoes: event.target.value })
                }
                className="min-h-20 border-slate-200"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <Button
                variant="outline"
                onClick={() => setFormOpen(false)}
                className="hover:bg-slate-100"
              >
                Cancelar
              </Button>
              <Button onClick={saveScheduling} disabled={formLoading} className="gap-2">
                {formLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingScheduling ? "Atualizar" : "Criar"}
                  </>
                )}
              </Button>
            </div>

            
          </div>
        </DialogContent>
        
      </Dialog>
       

        {deleteConfirm && (
          <Dialog
            open={!!deleteConfirm}
            onOpenChange={(open) => {
              if (!open) {
                setDeleteConfirm(null);
              }
            }}
            modal={true}
          >
            <DialogContent className="max-w-xl
             border-0 bg-gradient-to-br from-white to-slate-50 shadow-lg max-h-[200px]">
              <DialogHeader className="border-b border-slate-200 pb-0">
                <DialogTitle className="text-xl font-bold text-slate-900">
                  Confirmar exclusão
                </DialogTitle>

                <DialogDescription className="text-slate-600">
                  Tem certeza que deseja excluir o agendamento{" "}
                  <strong>{deleteConfirm.nome}</strong>?
                </DialogDescription>
              </DialogHeader>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancelar
                </Button>

                <Button
                  variant="destructive"
                  disabled={actionLoading}
                  onClick={() =>
                    deleteScheduling(deleteConfirm.id)
                  }
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Excluir"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}        
    </>
  );
}