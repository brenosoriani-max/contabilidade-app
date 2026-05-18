/**
 * ExtractionResultBadge
 * Exibe status de extração com confiança e origem (anchor parser vs Claude)
 */

import { AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExtractionResultBadgeProps {
  confianca: number;
  origem?: "anchor_parser" | "claude_ocr";
  camposAtualizados?: number;
  alertas?: string[];
  className?: string;
}

export function ExtractionResultBadge({
  confianca,
  origem,
  camposAtualizados,
  alertas,
  className,
}: ExtractionResultBadgeProps) {
  const isAlta = confianca >= 0.8;
  const eMedia = confianca >= 0.6 && confianca < 0.8;
  const eBaixa = confianca < 0.6;

  const bgColor = isAlta
    ? "bg-emerald-100 text-emerald-700"
    : eMedia
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";

  const borderColor = isAlta
    ? "border-emerald-200"
    : eMedia
      ? "border-amber-200"
      : "border-red-200";

  const IconComponent = isAlta ? CheckCircle2 : eBaixa ? AlertCircle : AlertCircle;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-2 items-center">
        {/* Confiança principal */}
        <Badge
          variant="outline"
          className={`${bgColor} ${borderColor} border font-semibold flex items-center gap-1`}
        >
          <IconComponent className="h-3 w-3" />
          {Math.round(confianca * 100)}% confiança
        </Badge>

        {/* Origem da extração */}
        {origem && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {origem === "anchor_parser" ? "Sem IA" : "Claude OCR"}
          </Badge>
        )}

        {/* Campos atualizados */}
        {camposAtualizados !== undefined && camposAtualizados > 0 && (
          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
            {camposAtualizados} campo{camposAtualizados > 1 ? "s" : ""} extraído{camposAtualizados > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Alertas */}
      {alertas && alertas.length > 0 && (
        <div className="space-y-1">
          {alertas.map((alerta, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded-md">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{alerta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
