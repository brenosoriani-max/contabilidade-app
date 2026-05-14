import JSZip from 'jszip';

export async function packDEC(xmlConteudo: string, nomeArquivoInterno = 'declaracao.xml') {
  const manifest = `<?xml version='1.0'?><manifest><file-entry full-path='${nomeArquivoInterno}' media-type='text/xml'/></manifest>`;
  const zip = new JSZip();
  zip.file(nomeArquivoInterno, xmlConteudo, { compression: 'DEFLATE' });
  zip.file('META-INF/manifest.xml', manifest, { compression: 'DEFLATE' });
  return Buffer.from(
    await zip.generateAsync({ type: 'nodebuffer' })
  );
}
