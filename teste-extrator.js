const text = `
Informe de Rendimentos
Ficha da Declaração: Bens e Direitos
Contas de depósito, pagamento e aplicações financeiras
Fonte Pagadora: Itaú Vida E Previdência S.A. CNPJ: 92.661.388/0001-90
Ag/Conta Grupo Código Produto Situação em 31/12/2024 Situação em 31/12/2025
5285/0003987-0 99 06 VIDA GERADOR DE BENEFICIO LIVRE - VGBL 2.394,38 0,00
Total: 2.394,38 0,00

Fonte Pagadora: Itaú Unibanco S.A. CNPJ: 60.701.190/0001-04
Ag/Conta     Grupo     Código     Produto     Situação em 31/12/2024 Situação em 31/12/2025
5285/0003987-0 06 01 CONTA CORRENTE 1.471,52 0,00 
`;

function extractMoneyValues(raw) {
  if (!raw) return [];
  const matches = raw.match(/-?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|-?\s*(?:R\$\s*)?\d+,\d{2}/g) ?? [];
  return matches
    .map((match) => {
      const cleaned = match
        .replace(/R\$\s*/g, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      const value = Number(cleaned);
      return Number.isFinite(value) ? value : null;
    })
    .filter((value) => value !== null);
}

const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

let contextCnpj = null;
let contextFonte = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Update Contexts
  const cnpjMatch = line.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  if (cnpjMatch) contextCnpj = cnpjMatch[0];
  
  const fonteMatch = line.match(/Fonte Pagadora:\s*(.*?)(?:\s+CNPJ:|$)/i);
  if (fonteMatch) {
     contextFonte = fonteMatch[1].trim();
  }

  const values = extractMoneyValues(line);
  if (values.length < 2) continue; // we expect valor_anterior and valor_atual at minimum

  // Remove the money values from the end of the string to parse what's left
  let textWithoutMoney = line;
  const moneyMatches = line.match(/-?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|-?\s*(?:R\$\s*)?\d+,\d{2}/g) || [];
  moneyMatches.forEach(m => {
    textWithoutMoney = textWithoutMoney.replace(m, '');
  });
  textWithoutMoney = textWithoutMoney.trim();

  // Try to match: [Ag/Conta opcional] [Grupo DD] [Código DD] [Produto/Descrição]
  // Let's use a regex to see if it matches tabular data:
  // e.g. "5285/0003987-0 99 06 VIDA GERADOR DE BENEFICIO LIVRE - VGBL"
  // or "99 06 VIDA GERADOR..."
  const explicitMatch = textWithoutMoney.match(/^(?:([A-Za-z0-9/.-]+)\s+)?(\d{2})\s+(\d{2})\s+(.+)$/);
  
  if (explicitMatch) {
     const agConta = explicitMatch[1] || '';
     const grupo = explicitMatch[2];
     const codigo = explicitMatch[3];
     const desc = explicitMatch[4].trim();
     
     let fullDesc = desc;
     if (contextFonte) fullDesc += ` - ${contextFonte}`;
     if (agConta) fullDesc += ` (Ag/Conta: ${agConta})`;

     console.log('--- EXPLICIT MATCH DETECTED ---');
     console.log('Grupo:', grupo);
     console.log('Código:', codigo);
     console.log('Descrição:', fullDesc);
     console.log('CNPJ:', contextCnpj);
     console.log('Valor Anterior:', values[values.length - 2]);
     console.log('Valor Atual:', values[values.length - 1]);
  }
}
