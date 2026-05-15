import JSZip from 'jszip';
import iconv from 'iconv-lite';

export async function packDEC(xmlConteudo: string, nomeArquivoInterno = 'declaracao.xml') {
  // 1. Ensure the XML header claims ISO-8859-1
  let content = xmlConteudo;
  if (content.includes('encoding="UTF-8"')) {
    content = content.replace('encoding="UTF-8"', 'encoding="ISO-8859-1"');
  } else if (!content.includes('encoding=')) {
    // Inject encoding if missing
    content = content.replace('?>', ' encoding="ISO-8859-1"?>');
  }

  // 2. Encode to ISO-8859-1 Buffer (Crucial for Brazilian tax software)
  const xmlBuffer = iconv.encode(content, 'ISO-8859-1');

  // 3. Create standardized manifest
  const manifest = `<?xml version="1.0" encoding="UTF-8"?><manifest xmlns="http://www.receita.fazenda.gov.br/manifest"><file-entry full-path="${nomeArquivoInterno}" media-type="text/xml"/></manifest>`;
  
  const zip = new JSZip();
  zip.file(nomeArquivoInterno, xmlBuffer, { compression: 'DEFLATE' });
  zip.file('META-INF/manifest.xml', manifest, { compression: 'DEFLATE' });

  return Buffer.from(
    await zip.generateAsync({ type: 'nodebuffer' })
  );
}
