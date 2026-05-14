"use client";

import { useMemo, useState } from "react";
import { Copy, ExternalLink, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

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
    toast.success("Link copiado");
  }

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="w-32 space-y-2">
          <div className="text-sm font-medium">Validade</div>
          <Input
            type="number"
            min={1}
            max={60}
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(Number(event.target.value))}
          />
        </div>

        <Button onClick={generateLink} disabled={loading} className="gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : link ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {link ? "Regerar link" : "Gerar link de envio"}
        </Button>
      </div>

      {link && (
        <div className="space-y-3 rounded-md bg-muted/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={link.expired ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
              {link.expired ? "Expirado" : "Ativo"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Valido ate {new Date(link.expiresAt).toLocaleDateString("pt-BR")}
            </span>
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <Input value={publicUrl} readOnly className="font-mono text-xs" />
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={copyLink} title="Copiar">
                <Copy className="h-4 w-4" />
              </Button>
              <Button asChild variant="outline" size="icon" title="Abrir">
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
