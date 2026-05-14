"use client";

import { useCallback, useState } from "react";

import { toast } from "sonner";
import {
  FileDown,
  FileText,
  FileUp,
  ListChecks,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { declaracaoIrpfService } from "@/lib/api/services";

const TAGS = [
  "RG / CNH",
  "CPF",
  "Comprovante de residência",
  "Informe de rendimentos",
  "Extrato bancário",
  "Carnê-leão / Recibo autônomo",
  "Nota de corretagem / Informe de investimentos",
] as const;

type DeclaracaoIrpfAssistenteProps = {
  declaracaoId: number;
  anoExercicio?: number;
  agendamentoId?: number | null;
};

export function DeclaracaoIrpfAssistente({
  declaracaoId,
  anoExercicio = new Date().getFullYear(),
  agendamentoId = null,
}: DeclaracaoIrpfAssistenteProps) {
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);

  const [docFile, setDocFile] = useState<File | null>(null);
  const [tag, setTag] = useState<string>("");
  const [docLoading, setDocLoading] = useState(false);

  const [campo, setCampo] = useState("identificacao.cpf");
  const [valorCampo, setValorCampo] = useState("");
  const [campoLoading, setCampoLoading] = useState(false);

  const [checklist, setChecklist] = useState<Record<string, unknown> | null>(
    null
  );
  const [checklistLoading, setChecklistLoading] = useState(false);

  const [exportando, setExportando] = useState(false);
  const [formatoExport, setFormatoExport] = useState<"dec" | "xml">("dec");

  const carregarChecklist = useCallback(async () => {
    setChecklistLoading(true);
    try {
      const data = await declaracaoIrpfService.getChecklist(declaracaoId);
      setChecklist(data);
      toast.success("Checklist atualizado");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Nao foi possivel carregar o checklist"
      );
    } finally {
      setChecklistLoading(false);
    }
  }, [declaracaoId]);

  async function handleImportarXml() {
    if (!xmlFile) {
      toast.error("Selecione um arquivo XML");
      return;
    }
    setImportando(true);
    try {
      await declaracaoIrpfService.importarXml(
        declaracaoId,
        xmlFile,
        anoExercicio
      );
      toast.success("Modelo canônico atualizado a partir do XML");
      setXmlFile(null);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha ao importar o XML"
      );
    } finally {
      setImportando(false);
    }
  }

  async function handleDocumento() {
    if (!docFile || !tag) {
      toast.error("Selecione arquivo e tipo do documento");
      return;
    }
    setDocLoading(true);
    try {
      const out = await declaracaoIrpfService.uploadDocumento(
        declaracaoId,
        docFile,
        tag,
        agendamentoId ?? undefined
      );
      const resumo = out.resumo as Record<string, unknown> | undefined;
      const alertas = resumo?.alertas_revisao as unknown[] | undefined;
      const nAlertas = Array.isArray(alertas) ? alertas.length : 0;
      toast.success(
        nAlertas > 0
          ? "Arquivo arquivado. Revise a ficha e complete os dados manualmente se necessário."
          : "Documento registrado."
      );
      setDocFile(null);
      setTag("");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha no upload ou arquivamento"
      );
    } finally {
      setDocLoading(false);
    }
  }

  async function handleSalvarCampo() {
    if (!campo.trim()) {
      toast.error("Informe o caminho do campo");
      return;
    }
    setCampoLoading(true);
    try {
      await declaracaoIrpfService.putCampo(declaracaoId, {
        campo: campo.trim(),
        valor: valorCampo,
      });
      toast.success("Campo validado e salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validacao falhou");
    } finally {
      setCampoLoading(false);
    }
  }

  async function handleExportar() {
    setExportando(true);
    try {
      const res = await fetch(
        `/api/declaracoes/${declaracaoId}/exportar`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anoExercicio,
            tipo: "O",
            formato: formatoExport,
          }),
        }
      );

      const ct = res.headers.get("content-type") || "";

      if (!res.ok) {
        if (ct.includes("application/json")) {
          const j = (await res.json()) as {
            error?: string;
            data?: { erros?: unknown[] };
          };
          const erros = j.data?.erros;
          const msg =
            typeof j.error === "string"
              ? j.error
              : "Exportacao bloqueada";
          toast.error(
            erros && Array.isArray(erros)
              ? `${msg} (${erros.length} itens)`
              : msg
          );
        } else {
          toast.error(await res.text());
        }
        return;
      }

      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(dispo);
      const nome =
        match?.[1] ??
        (formatoExport === "xml"
          ? `IRPF${anoExercicio}.xml`
          : `IRPF${anoExercicio}.DEC`);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        formatoExport === "xml"
          ? "Arquivo XML baixado"
          : "Arquivo .DEC baixado"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na exportacao");
    } finally {
      setExportando(false);
    }
  }

  const pct =
    typeof checklist?.percentual_completo === "number"
      ? checklist.percentual_completo
      : 0;

  return (
    <Card className="border-primary/15 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">
              Declaração IRPF
            </CardTitle>
            <CardDescription>
              Reimportação do XML PGD, arquivamento de documentos, checklist e
              exportação para o programa da Receita — exercício {anoExercicio}.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        <section className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Reimportar XML (modelo canônico)
          </h4>
          <p className="text-xs text-muted-foreground">
            Atualiza o modelo a partir do arquivo PGD e grava o XML nesta
            declaração para exportação.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="xml-irpf">Arquivo XML</Label>
              <Input
                id="xml-irpf"
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={(e) =>
                  setXmlFile(e.target.files?.[0] ?? null)
                }
              />
            </div>
            <Button
              type="button"
              disabled={importando || !xmlFile}
              onClick={handleImportarXml}
            >
              {importando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Processar XML
            </Button>
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Documento (arquivamento)
          </h4>
          <p className="text-xs text-muted-foreground">
            O arquivo fica registrado para conferência; não há extração
            automática de dados a partir da imagem ou PDF.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Arquivo</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) =>
                  setDocFile(e.target.files?.[0] ?? null)
                }
              />
              <p className="text-xs text-muted-foreground">
                Imagens ilegiveis ou PDFs corrompidos serão rejeitados com
                mensagem clara.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TAGS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            disabled={docLoading || !docFile || !tag}
            onClick={handleDocumento}
          >
            {docLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Enviar e arquivar
          </Button>
        </section>

        <Separator />

        <section className="space-y-3">
          <h4 className="text-sm font-medium">Editar campo (validado)</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Caminho</Label>
              <Input
                value={campo}
                onChange={(e) => setCampo(e.target.value)}
                placeholder="identificacao.cpf"
              />
            </div>
            <div className="space-y-1">
              <Label>Valor</Label>
              <Input
                value={valorCampo}
                onChange={(e) => setValorCampo(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={campoLoading}
            onClick={handleSalvarCampo}
          >
            {campoLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Validar e gravar
          </Button>
        </section>

        <Separator />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Checklist IR
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={checklistLoading}
              onClick={carregarChecklist}
            >
              {checklistLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Gerar / atualizar
            </Button>
          </div>
          {checklist && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{pct}%</span>
              </div>
              <Progress value={pct} />
              {typeof checklist.status_pipeline === "string" && (
                <p className="text-xs text-muted-foreground">
                  Pipeline: {checklist.status_pipeline}
                </p>
              )}
              {typeof checklist.proxima_acao === "string" && (
                <p className="text-sm">
                  Próxima ação: {checklist.proxima_acao}
                </p>
              )}
            </div>
          )}
        </section>

        <Separator />

        <section className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Exportar para o IRPF
          </h4>
          <p className="text-xs text-muted-foreground">
            Valida dados mínimos, usa o XML gravado na declaração e gera o pacote
            .DEC ou o XML bruto para o aplicativo da Receita.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label>Formato</Label>
              <Select
                value={formatoExport}
                onValueChange={(v) =>
                  setFormatoExport(v === "xml" ? "xml" : "dec")
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dec">Pacote .DEC</SelectItem>
                  <SelectItem value="xml">XML bruto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              disabled={exportando}
              onClick={handleExportar}
            >
              {exportando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Baixar
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
