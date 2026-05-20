"use client";

import { useMemo, useState } from "react";
import { Copy, ExternalLink, Link2, Loader2, RefreshCw, CalendarDays, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { schedulingService } from "@/lib/api/services";
import type { Scheduling, SchedulingUploadLink } from "@/types";

type LinkEnvioClienteProps = {
  agendamentoId: number;
  link: SchedulingUploadLink | null;
  onUpdated: (scheduling: Scheduling) => void;
};

export function LinkEnvioCliente({
  agendamentoId,
  link,
  onUpdated,
}: LinkEnvioClienteProps) {
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [loading, setLoading] = useState(false);

  const publicUrl = useMemo(() => {
    if (!link) return "";
    if (typeof window === "undefined") return link.url;
    return `${window.location.origin}${link.url}`;
  }, [link]);

  async function generateLink() {
    try {
      setLoading(true);
      const response = await schedulingService.generateUploadLink(
        agendamentoId,
        expiresInDays
      );

      onUpdated(response.agendamento);
      toast.success("Link de envio gerado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar link");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;

    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado para a área de transferência");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border-2 border-slate-100 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <Link2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Portal do Cliente</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gere um link seguro para o cliente enviar documentos</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[160px_1fr] md:items-end">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" />
              Expira em (Dias)
            </div>
            <Input
              type="number"
              min={1}
              max={60}
              className="h-12 rounded-xl border-2 border-slate-100 bg-slate-50/50 font-bold text-slate-700 focus:bg-white"
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
            />
          </div>

          <Button 
            onClick={generateLink} 
            disabled={loading} 
            className="h-12 rounded-xl bg-primary font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-3 overflow-hidden group"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : link ? (
              <RefreshCw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {link ? "Regerar Link de Acesso" : "Criar Link de Acesso Seguro"}
          </Button>
        </div>

        {link && (
          <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-50 pt-6">
              <div className="flex items-center gap-3">
                <Badge className={cn(
                  "rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest border-0",
                  link.expired ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                )}>
                  {link.expired ? "Expirado" : "Link Ativo"}
                </Badge>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  VÁLIDO ATÉ {new Date(link.expiresAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:flex-row">
              <div className="flex-1 overflow-hidden relative group">
                <Input 
                  value={publicUrl} 
                  readOnly 
                  className="h-12 w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-4 font-mono text-[11px] text-slate-600 focus:ring-0" 
                />
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none" />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="h-12 w-12 rounded-xl border-2 border-slate-100 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all shadow-sm" 
                  onClick={copyLink} 
                  title="Copiar Link"
                  size="icon"
                >
                  <Copy className="h-5 w-5" />
                </Button>
                
                <Button 
                  asChild 
                  variant="outline" 
                  className="h-12 w-12 rounded-xl border-2 border-slate-100 hover:bg-slate-100 text-slate-400 transition-all shadow-sm" 
                  title="Abrir no Navegador"
                  size="icon"
                >
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {!link && (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200">
          <ShieldCheck className="h-12 w-12 text-slate-200 mb-4" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest max-w-[240px]">
            Nenhum link ativo. Gere um link para enviar ao cliente.
          </p>
        </div>
      )}
    </div>
  );
}
