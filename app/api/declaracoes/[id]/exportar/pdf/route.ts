import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF with autotable types for TS
interface jsPDFWithPlugin extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth) return fail('Não autenticado', 401);

    const { id } = await params;
    const declaracaoId = Number.parseInt(id, 10);

    const decl = await prisma.declaracao.findUnique({
      where: { id: declaracaoId },
      include: {
        contribuinte: true,
        bensDireitos: true,
        rendimentosTributaveis: true,
      },
    });

    if (!decl) return fail('Declaração não encontrada', 404);

    const doc = new jsPDF() as jsPDFWithPlugin;
    const { contribuinte } = decl;

    // Header
    doc.setFillColor(0, 51, 102);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTEC - SISTEMA CONTÁBIL', 15, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`DOSSIÊ FISCAL - EXERCÍCIO ${decl.anoExercicio}`, 15, 30);
    doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, 140, 30);

    // Dados do Contribuinte
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. DADOS DO CONTRIBUINTE', 15, 55);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`NOME: ${contribuinte.nome}`, 15, 65);
    doc.text(`CPF: ${contribuinte.cpf}`, 15, 72);
    doc.text(`DATA NASCIMENTO: ${contribuinte.dataNascimento ? contribuinte.dataNascimento.toLocaleDateString('pt-BR') : 'N/A'}`, 15, 79);
    doc.text(`EMAIL: ${contribuinte.email || 'N/A'}`, 15, 86);
    doc.text(`TELEFONE: ${contribuinte.telefone || 'N/A'}`, 110, 86);

    // Resumo Financeiro
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. RESUMO DA DECLARAÇÃO', 15, 105);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const fmt = (val: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
    
    doc.text(`TOTAL RENDIMENTOS: ${fmt(decl.totalRendimentosTributaveis)}`, 15, 115);
    doc.text(`BASE DE CÁLCULO: ${fmt(decl.baseCalculo)}`, 15, 122);
    doc.text(`IMPOSTO DEVIDO: ${fmt(decl.impostoDevido)}`, 110, 115);
    
    if (Number(decl.impostoRestituir) > 0) {
      doc.setTextColor(0, 128, 0);
      doc.text(`IMPOSTO A RESTITUIR: ${fmt(decl.impostoRestituir)}`, 110, 122);
    } else {
      doc.setTextColor(200, 0, 0);
      doc.text(`IMPOSTO A PAGAR: ${fmt(decl.impostoPagar)}`, 110, 122);
    }
    doc.setTextColor(0, 0, 0);

    // Bens e Direitos Table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. BENS E DIREITOS', 15, 140);

    const bensData = decl.bensDireitos.map(b => [
      b.grupo || '',
      b.codigo || '',
      b.descricao || '',
      fmt(b.valorAnterior),
      fmt(b.valorAtual)
    ]);

    doc.autoTable({
      startY: 145,
      head: [['Grupo', 'Cód', 'Descrição', 'Sit. Anterior', 'Sit. Atual']],
      body: bensData,
      theme: 'striped',
      headStyles: { fillColor: [0, 51, 102] },
      styles: { fontSize: 8 },
      columnStyles: {
        2: { cellWidth: 80 }
      }
    });

    const pdfOutput = doc.output('arraybuffer');

    return new NextResponse(pdfOutput, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DOSSIE-${contribuinte.cpf}-${decl.anoExercicio}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return fail('Erro interno ao gerar PDF', 500);
  }
}
