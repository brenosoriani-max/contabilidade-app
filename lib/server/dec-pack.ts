import AdmZip from 'adm-zip';

export async function packDEC(xmlConteudo: string, nomeArquivoInterno = 'declaracao.xml') {
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>\n<manifest xmlns="http://www.receita.fazenda.gov.br/manifest">\n    <file-entry\n        full-path="${nomeArquivoInterno}"\n        media-type="text/xml"/>\n</manifest>`;

  const zip = new AdmZip();
  zip.addFile(nomeArquivoInterno, Buffer.from(xmlConteudo, 'utf8'));
  zip.addFile('META-INF/manifest.xml', Buffer.from(manifest, 'utf8'));

  return zip.toBuffer();
}
