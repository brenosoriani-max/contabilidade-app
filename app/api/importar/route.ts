import { NextRequest } from 'next/server';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';

const parseXml = promisify(parseString);



function attrs(node: unknown): Record<string, string> {
  if (!node || typeof node !== 'object') return {};

  const n = node as Record<string, unknown>;

  return (n.$ as Record<string, string>) ?? {};
}

function first<T = Record<string, unknown>>(arr: unknown): T {
  if (Array.isArray(arr) && arr.length > 0) {
    return arr[0] as T;
  }

  if (arr && typeof arr === 'object') {
    return arr as T;
  }

  return {} as T;
}

function items(node: unknown): unknown[] {
  const n = first(node) as Record<string, unknown>;

  const list = n.item;

  if (Array.isArray(list)) return list;

  if (list) return [list];

  return [];
}

function dec(value?: string): number {
  if (!value || value.trim() === '') {
    return 0;
  }

  return (
    parseFloat(
      value.replace(/\./g, '').replace(',', '.')
    ) || 0
  );
}

function cpfClean(value: string): string {
  return value.replace(/[\s.\-/]/g, '').trim();
}

// Gera CPF temporário válido para caber no VARCHAR(11)
function generateTempCpf(): string {
  const random = Math.floor(
    10000000 + Math.random() * 89999999
  );

  return `999${random}`;
}

// ─────────────────────────────────────────────
// ROUTE
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    if (!auth) {
      return fail('Nao autenticado', 401);
    }

    const formData = await request.formData();

    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return fail('Nenhum arquivo enviado', 400);
    }

    const results = [];

    for (const file of files) {
      try {
        // ─────────────────────────────────────
        // XML
        // ─────────────────────────────────────

        const content = await file.text();

        const xml = (await parseXml(content)) as Record<
          string,
          unknown
        >;

        // suporta <classe> e <declaracao>
        const root = first(
          xml.classe ??
            xml.declaracao ??
            xml
        ) as Record<string, unknown>;

        const rootAttrs = attrs(root);

        // ─────────────────────────────────────
        // CONTRIBUINTE
        // ─────────────────────────────────────

        const contribuinteNode = first(
          root.contribuinte
        );

        const c = attrs(contribuinteNode);

        // Busca CPF em múltiplos layouts possíveis
        const possibleCpf =
          rootAttrs.utlimoCPFAutenticado ||
          rootAttrs.ultimoCPFAutenticado ||
          c.cpf ||
          c.cpfTitular ||
          c.niTitular ||
          c.numeroCpf ||
          c.cpfDeclarante ||
          '';

        const cpf = cpfClean(possibleCpf);

        const isCpfValid =
          /^\d{11}$/.test(cpf) &&
          !cpf.startsWith('000');

        // Se não houver CPF válido,
        // gera um CPF temporário
        const finalCpf = isCpfValid
          ? cpf
          : generateTempCpf();

        if (!isCpfValid) {
          console.warn(
            `[IMPORTADOR XML] CPF nao encontrado em ${file.name}. Utilizando CPF temporario: ${finalCpf}`
          );
        }

        // ─────────────────────────────────────
        // IDENTIFICAÇÃO
        // ─────────────────────────────────────

        const resumoNode = first(
          root.resumo
        ) as Record<string, unknown>;

        const calcImpNode = first(
          resumoNode.calculoImposto
        );

        const calcImpAttrs =
          attrs(calcImpNode);

        const identNode = first(
          (calcImpNode as Record<
            string,
            unknown
          >).identificadorDec ??
            (calcImpNode as Record<
              string,
              unknown
            >)
              .identificadorDeclaracao ??
            resumoNode.identificadorDeclaracao
        );

        const identAttrs = attrs(identNode);

        const nome =
          identAttrs.nome ||
          c.nome ||
          'Contribuinte Importado';

        const anoExercicio =
          parseInt(
            identAttrs.exercicio || '',
            10
          ) || new Date().getFullYear();

        const anoCalendario =
          anoExercicio - 1;

        // ─────────────────────────────────────
        // RESUMO FINANCEIRO
        // ─────────────────────────────────────

        const rendDeducNode = first(
          resumoNode.rendimentosTributaveisDeducoes
        );

        const rendDeducAttrs =
          attrs(rendDeducNode);

        const totalRendTributaveis = dec(
          calcImpAttrs.rendPJRecebidoTitular ||
            rendDeducAttrs.totalRendimentos ||
            rendDeducAttrs.rendRecebidoPJTitular
        );

        const totalDeducoes = dec(
          rendDeducAttrs.totalDeducoes
        );

        const baseCalculo =
          dec(calcImpAttrs.baseCalculo) ||
          totalRendTributaveis -
            totalDeducoes;

        const impostoDevido = dec(
          calcImpAttrs.impostoDevido
        );

        const impostoPago = dec(
          calcImpAttrs.totalImpostoPago ||
            calcImpAttrs.impostoRetidoFonteTitular
        );

        const impostoRestituir = dec(
          calcImpAttrs.impostoRestituir
        );

        const impostoPagar = dec(
          calcImpAttrs.saldoImpostoPagar
        );

        // ─────────────────────────────────────
        // BENS
        // ─────────────────────────────────────

        const bensNode = first(
          root.bens
        ) as Record<string, unknown>;

        const bensAttrs = attrs(bensNode);

        const totalBens = dec(
          bensAttrs.totalExercicioAtual
        );

        const bensItems = items(bensNode);

        // ─────────────────────────────────────
        // RENDIMENTOS PJ
        // ─────────────────────────────────────

        const rendPJNode = first(
          root.rendPJ
        ) as Record<string, unknown>;

        const colecaoPJNode = first(
          rendPJNode.colecaoRendPJTitular
        );

        const rendPJItems =
          items(colecaoPJNode);

        // ─────────────────────────────────────
        // PERSISTÊNCIA
        // ─────────────────────────────────────

        const imported = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
              // CONTRIBUINTE

              const contribuinte =
                await tx.contribuinte.upsert({
                  where: {
                    cpf: finalCpf,
                  },

                  create: {
                    cpf: finalCpf,

                    nome,

                    enderecoUf:
                      c.uf || null,

                    enderecoMunicipio:
                      c.municipio ||
                      null,

                    enderecoCep:
                      c.cep || null,

                    enderecoBairro:
                      c.bairro || null,

                    enderecoLogradouro:
                      c.logradouro ||
                      null,

                    enderecoNumero:
                      c.numero || null,

                    enderecoComplemento:
                      c.complemento ||
                      null,

                    ocupacaoPrincipal:
                      c.ocupacaoPrincipal ||
                      null,

                    naturezaOcupacao:
                      c.naturezaOcupacao ||
                      null,
                  },

                  update: {
                    nome,

                    enderecoUf:
                      c.uf || null,

                    enderecoMunicipio:
                      c.municipio ||
                      null,

                    enderecoCep:
                      c.cep || null,

                    enderecoBairro:
                      c.bairro || null,

                    enderecoLogradouro:
                      c.logradouro ||
                      null,

                    enderecoNumero:
                      c.numero || null,

                    enderecoComplemento:
                      c.complemento ||
                      null,
                  },
                });

              // DECLARAÇÃO

              const declaracaoRecord =
                await tx.declaracao.upsert({
                  where: {
                    contribuinteId_anoExercicio_tipoDeclaracao:
                      {
                        contribuinteId:
                          contribuinte.id,

                        anoExercicio,

                        tipoDeclaracao:
                          'original',
                      },
                  },

                  create: {
                    contribuinteId:
                      contribuinte.id,

                    anoExercicio,

                    anoCalendario,

                    tipoDeclaracao:
                      'original',

                    modelo: 'completo',

                    situacao:
                      'processada',

                    totalRendimentosTributaveis:
                      totalRendTributaveis,

                    totalDeducoes,

                    baseCalculo,

                    impostoDevido,

                    impostoPago,

                    impostoRestituir,

                    impostoPagar,

                    totalBens,

                    xmlOriginal:
                      content,

                    dadosJson:
                      JSON.stringify(
                        xml
                      ),
                  },

                  update: {
                    totalRendimentosTributaveis:
                      totalRendTributaveis,

                    totalDeducoes,

                    baseCalculo,

                    impostoDevido,

                    impostoPago,

                    impostoRestituir,

                    impostoPagar,

                    totalBens,

                    xmlOriginal:
                      content,

                    dadosJson:
                      JSON.stringify(
                        xml
                      ),
                  },
                });

              // limpa dados antigos

              await Promise.all([
                tx.rendimentoTributavel.deleteMany(
                  {
                    where: {
                      declaracaoId:
                        declaracaoRecord.id,
                    },
                  }
                ),

                tx.bemDireito.deleteMany({
                  where: {
                    declaracaoId:
                      declaracaoRecord.id,
                  },
                }),
              ]);

              // RENDIMENTOS PJ

              if (rendPJItems.length) {
                await tx.rendimentoTributavel.createMany(
                  {
                    data: rendPJItems.map(
                      (item) => {
                        const a =
                          attrs(item);

                        return {
                          declaracaoId:
                            declaracaoRecord.id,

                          tipo: 'PJ',

                          cnpjFonte:
                            a.NIFontePagadora ||
                            null,

                          nomeFonte:
                            a.nomeFontePagadora ||
                            null,

                          valorRendimento:
                            dec(
                              a.rendRecebidoPJ
                            ),

                          valorIrrf:
                            dec(
                              a.impostoRetidoFonte
                            ),
                        };
                      }
                    ),
                  }
                );
              }

              // BENS E DIREITOS

              if (bensItems.length) {
                await tx.bemDireito.createMany(
                  {
                    data: bensItems.map(
                      (item) => {
                        const a =
                          attrs(item);

                        return {
                          declaracaoId:
                            declaracaoRecord.id,

                          grupo:
                            parseInt(
                              a.grupo || '0',
                              10
                            ) || 0,

                          codigo:
                            parseInt(
                              a.codigo || '0',
                              10
                            ) || 0,

                          descricao:
                            a.discriminacao ||
                            a.descricao ||
                            null,

                          valorAnterior:
                            dec(
                              a.valorExercicioAnterior
                            ),

                          valorAtual:
                            dec(
                              a.valorExercicioAtual
                            ),
                        };
                      }
                    ),
                  }
                );
              }

              return contribuinte;
            }
          );

        // ─────────────────────────────────────
        // RESULTADO
        // ─────────────────────────────────────

        results.push({
          file: file.name,

          success: true,

          contribuinteId:
            imported.id,

          nome: imported.nome,

          cpf: isCpfValid
            ? imported.cpf
            : null,

          cpfTemporario:
            !isCpfValid,
        });
      } catch (fileError) {
        console.error(
          `Erro ao processar ${file.name}:`,
          fileError
        );

        results.push({
          file: file.name,

          success: false,

          error:
            fileError instanceof Error
              ? fileError.message
              : 'Erro ao processar XML',
        });
      }
    }

    // ─────────────────────────────────────
    // RESUMO
    // ─────────────────────────────────────

    const successCount = results.filter(
      (r) => r.success
    ).length;

    const errorCount = results.filter(
      (r) => !r.success
    ).length;

    return ok({
      success: true,

      message: `${successCount} arquivo(s) importado(s) com sucesso. ${errorCount} erro(s).`,

      results,
    });
  } catch (error) {
    console.error(
      'Erro na importacao:',
      error
    );

    return fail(
      'Erro interno do servidor',
      500
    );
  }
}