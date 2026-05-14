"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"
import type { DashboardMetrics } from "@/lib/types"
import { formatCurrency } from "@/lib/format"

interface DashboardChartsProps {
  metrics: DashboardMetrics
}

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b']

export function DashboardCharts({ metrics }: DashboardChartsProps) {
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Rendimentos por Fonte */}
      <Card>
        <CardHeader>
          <CardTitle>Rendimentos por Fonte</CardTitle>
          <CardDescription>Distribuicao dos rendimentos por categoria</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.rendimentosPorFonte} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                type="number" 
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                className="text-xs"
              />
              <YAxis 
                dataKey="fonte" 
                type="category" 
                width={120}
                className="text-xs"
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="valor" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distribuicao de Resultados */}
      <Card>
        <CardHeader>
          <CardTitle>Resultado das Declaracoes</CardTitle>
          <CardDescription>Proporcao por tipo de resultado</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={metrics.distribuicaoResultado}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                label={({ tipo, count, percent }) => 
                  `${tipo}: ${count} (${(percent * 100).toFixed(0)}%)`
                }
              >
                {metrics.distribuicaoResultado.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name) => [value, name === 'count' ? 'Declaracoes' : name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Evolucao Patrimonial */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Evolucao Patrimonial</CardTitle>
          <CardDescription>Comparativo de bens e direitos ao longo dos exercicios</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={metrics.evolucaoPatrimonial}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="ano" className="text-xs" />
              <YAxis 
                tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(1)}M`}
                className="text-xs"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="anterior"
                stackId="1"
                stroke="#94a3b8"
                fill="#94a3b8"
                fillOpacity={0.6}
                name="Ano Anterior"
              />
              <Area
                type="monotone"
                dataKey="atual"
                stackId="2"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
                name="Ano Atual"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
