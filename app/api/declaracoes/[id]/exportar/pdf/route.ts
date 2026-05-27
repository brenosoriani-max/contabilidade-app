import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
        rendimentosIsentos: true,
        dividasOnus: true,
        deducoes: true,
        dependentes: true,
      },
    });

    if (!decl) return fail('Declaração não encontrada', 404);

    const doc = new jsPDF() as jsPDFWithPlugin;
    const { contribuinte } = decl;
    const fmt = (val: any) =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(val));
    const toNumber = (val: any) => Number(val?.toString?.() ?? val) || 0;
    const totalRendimentos = decl.rendimentosTributaveis.reduce(
      (sum, item) => sum + toNumber(item.valorRendimento),
      0
    );
    const totalIRRF = decl.rendimentosTributaveis.reduce(
      (sum, item) => sum + toNumber(item.valorIrrf),
      0
    );
    const totalDecimoTerceiro = decl.rendimentosTributaveis.reduce(
      (sum, item) => sum + toNumber(item.valor13o),
      0
    );
    const totalRendimentosResumo =
      toNumber(decl.totalRendimentosTributaveis) || totalRendimentos;

    // --- PAGE 1: COVER & SUMMARY ---
    // Header background
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 50, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTEC', 15, 25);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('TECNOLOGIA CONTÁBIL AVANÇADA', 15, 32);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`DOSSIÊ FISCAL IRPF ${decl.anoExercicio}`, 140, 25, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, 140, 32, { align: 'right' });

    // Contribuinte Header
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(contribuinte.nome.toUpperCase(), 15, 65);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`CPF: ${contribuinte.cpf}`, 15, 72);
    doc.text(`NASCIMENTO: ${contribuinte.dataNascimento ? contribuinte.dataNascimento.toLocaleDateString('pt-BR') : '---'}`, 60, 72);
    doc.text(`EXERCÍCIO: ${decl.anoExercicio} (ANO-CALENDÁRIO: ${decl.anoExercicio - 1})`, 120, 72);

    // Summary Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(15, 85, 180, 62, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(15, 85, 180, 62, 3, 3, 'D');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO DA DECLARAÇÃO', 25, 95);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('RENDIMENTOS TRIBUTAVEIS:', 25, 105);
    doc.text(fmt(totalRendimentosResumo), 90, 105);

    doc.text('BASE DE CÁLCULO:', 25, 112);
    doc.text(fmt(totalIRRF), 90, 112);

    doc.text('IMPOSTO DEVIDO:', 25, 119);
    doc.text(fmt(totalDecimoTerceiro), 90, 119);
    doc.setFillColor(248, 250, 252);
    doc.rect(24, 108, 55, 14, 'F');
    doc.text('IRRF:', 25, 112);
    doc.text('13 SALARIO:', 25, 119);

    const resultado = Number(decl.impostoRestituir) > 0;
    doc.setFont('helvetica', 'bold');
    doc.text('BASE DE CALCULO:', 25, 126);
    doc.text(fmt(decl.baseCalculo), 90, 126);

    doc.text('IMPOSTO DEVIDO:', 25, 133);
    doc.text(fmt(decl.impostoDevido), 90, 133);

    doc.text(resultado ? 'SALDO A RESTITUIR:' : 'SALDO A PAGAR:', 25, 143);
    if (resultado) doc.setTextColor(5, 150, 105); // emerald-600
    else doc.setTextColor(220, 38, 38); // red-600
    doc.text(fmt(resultado ? decl.impostoRestituir : decl.impostoPagar), 90, 143);
    doc.setTextColor(0, 0, 0);

    // Status / Metadata
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SITUAÇÃO DO DOSSIÊ:', 125, 105);
    doc.setFont('helvetica', 'normal');
    doc.text(decl.situacao.toUpperCase(), 165, 105);
    doc.text('TIPO:', 125, 112);
    doc.text(decl.tipoDeclaracao.toUpperCase(), 165, 112);
    doc.text('MODELO:', 125, 119);
    doc.text(decl.modelo.toUpperCase(), 165, 119);
    doc.setFont('helvetica', 'bold');
    doc.text('FONTES PJ:', 125, 126);
    doc.setFont('helvetica', 'normal');
    doc.text(String(decl.rendimentosTributaveis.length), 165, 126);

    // --- SECTIONS ---
    let currentY = 162;

    // 1. RENDIMENTOS TRIBUTÁVEIS
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. RENDIMENTOS TRIBUTÁVEIS (PJ)', 15, currentY);
    
    if (decl.rendimentosTributaveis.length > 0) {
      const rendData = decl.rendimentosTributaveis.map(r => [
        r.cnpjFonte || '',
        r.nomeFonte || '',
        fmt(r.valorRendimento),
        fmt(r.valorIrrf),
        fmt(r.valor13o)
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['CNPJ', 'Fonte Pagadora', 'Rendimento', 'IRRF', '13º Salário']],
        body: rendData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7 },
        margin: { left: 15, right: 15 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Nenhum rendimento tributável lançado.', 15, currentY + 10);
      currentY += 25;
    }

    // 2. RENDIMENTOS ISENTOS
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. RENDIMENTOS ISENTOS / NÃO TRIBUTÁVEIS', 15, currentY);

    if (decl.rendimentosIsentos.length > 0) {
        const isentosData = decl.rendimentosIsentos.map(r => [
          r.codigo || '',
          r.descricao || '',
          r.nomeFonte || '',
          fmt(r.valor)
        ]);
  
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Cód', 'Descrição', 'Fonte', 'Valor']],
          body: isentosData,
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
          styles: { fontSize: 7 },
          margin: { left: 15, right: 15 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Nenhum rendimento isento lançado.', 15, currentY + 10);
      currentY += 25;
    }

    // 3. BENS E DIREITOS
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. BENS E DIREITOS', 15, currentY);

    if (decl.bensDireitos.length > 0) {
      const bensData = decl.bensDireitos.map(b => [
        `G${b.grupo} C${b.codigo}`,
        b.descricao || '',
        fmt(b.valorAnterior),
        fmt(b.valorAtual)
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Ref', 'Discriminação', `31/12/${decl.anoExercicio - 1}`, `31/12/${decl.anoExercicio}`]],
        body: bensData,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7 },
        columnStyles: { 1: { cellWidth: 100 } },
        margin: { left: 15, right: 15 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Nenhum bem lançado.', 15, currentY + 10);
      currentY += 25;
    }

    // 4. DÍVIDAS E ÔNUS
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('4. DÍVIDAS E ÔNUS REAIS', 15, currentY);

    if (decl.dividasOnus.length > 0) {
      const divData = decl.dividasOnus.map(d => [
        d.codigo || '',
        d.descricao || '',
        fmt(d.valorAnterior),
        fmt(d.valorAtual),
        fmt(d.valorPago)
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Cód', 'Discriminação', 'Sit. Anterior', 'Sit. Atual', 'Total Pago']],
        body: divData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7 },
        margin: { left: 15, right: 15 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('Nenhuma dívida lançada.', 15, currentY + 10);
        currentY += 25;
    }

    // 5. DEPENDENTES
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('5. DEPENDENTES', 15, currentY);

    if (decl.dependentes.length > 0) {
      const depData = decl.dependentes.map(d => [
        d.tipo || '',
        d.nome || '',
        d.cpf || '',
        d.dataNascimento ? d.dataNascimento.toLocaleDateString('pt-BR') : ''
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Tipo', 'Nome', 'CPF', 'Nascimento']],
        body: depData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7 },
        margin: { left: 15, right: 15 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('Nenhum dependente lançado.', 15, currentY + 10);
        currentY += 25;
    }

    // Footer on all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Folha ${i} de ${pageCount} | Dossiê Gerado p/ Sistema CONTEC`, 105, 285, { align: 'center' });
    }

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
    const msg = error instanceof Error ? error.message : 'Erro interno ao gerar PDF';
    return fail(msg, 500);
  }
}
