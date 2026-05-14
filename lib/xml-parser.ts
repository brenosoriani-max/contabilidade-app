import { parseStringPromise } from 'xml2js'
import type { Declaration } from './types'

interface XMLDeclaration {
  classe: {
    $: {
      dataHoraSalvamento: string
      utlimoCPFAutenticado: string
    }
    contribuinte: [{
      $: {
        bairro: string
        cep: string
        dataNascimento: string
        logradouro: string
        municipio: string
        naturezaOcupacao: string
        numero: string
        ocupacaoPrincipal: string
        tipoLogradouro: string
        uf: string
        complemento?: string
      }
    }]
    rendPJ?: [{
      colecaoRendPJTitular?: [{
        $: {
          totaisContribuicaoPrevOficial: string
          totaisDecimoTerceiro: string
          totaisImpostoRetidoFonte: string
          totaisRendRecebidoPJ: string
        }
      }]
    }]
    rendIsentos?: [{
      $: {
        total: string
        lucroRecebido?: string
        poupanca?: string
        outros?: string
      }
    }]
    rendTributacaoExclusiva?: [{
      $: {
        total: string
        rendAplicacoes?: string
        ganhosCapital?: string
      }
    }]
    bens?: [{
      $: {
        totalExercicioAnterior: string
        totalExercicioAtual: string
      }
      item?: Array<Record<string, unknown>>
    }]
    dividas?: [{
      $: {
        totalExercicioAnterior: string
        totalExercicioAtual: string
      }
    }]
    resumoDeclaracao?: [{
      $: {
        baseCalculo?: string
        impostoDevido?: string
        impostoRestituir?: string
        saldoImpostoPagar?: string
        aliquotaEfetiva?: string
        totalImpostoPago?: string
      }
    }]
    identificacao?: [{
      $: {
        nome: string
        cpf: string
        exercicio: string
        tipoDeclaracao?: string
      }
    }]
  }
}

function parseDecimalBR(value: string | undefined): number {
  if (!value || value.trim() === '') return 0
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0
}

function determineResult(impostoRestituir: number, saldoPagar: number): 'RESTITUIR' | 'PAGAR' | 'ZERO' {
  if (impostoRestituir > 0) return 'RESTITUIR'
  if (saldoPagar > 0) return 'PAGAR'
  return 'ZERO'
}

export async function parseIRPFXML(xmlContent: string): Promise<Partial<Declaration>> {
  try {
    const result = await parseStringPromise(xmlContent, {
      explicitArray: true,
      ignoreAttrs: false,
      attrkey: '$',
      charkey: '_'
    }) as XMLDeclaration
    
    const classe = result.classe
    const contribuinte = classe.contribuinte?.[0]?.$
    const rendPJ = classe.rendPJ?.[0]?.colecaoRendPJTitular?.[0]?.$
    const rendIsentos = classe.rendIsentos?.[0]?.$
    const rendTribExclusiva = classe.rendTributacaoExclusiva?.[0]?.$
    const bens = classe.bens?.[0]?.$
    const dividas = classe.dividas?.[0]?.$
    const resumo = classe.resumoDeclaracao?.[0]?.$
    const identificacao = classe.identificacao?.[0]?.$
    
    // Extract CPF from attributes
    const cpfRaw = classe.$?.utlimoCPFAutenticado || identificacao?.cpf || ''
    const cpf = cpfRaw.trim()
    
    // Build address
    const endereco = contribuinte ? 
      `${contribuinte.tipoLogradouro || ''} ${contribuinte.logradouro || ''}, ${contribuinte.numero || ''}${contribuinte.complemento ? ', ' + contribuinte.complemento : ''}`.trim() 
      : null
    
    // Parse numeric values
    const totalRendPJ = parseDecimalBR(rendPJ?.totaisRendRecebidoPJ)
    const totalIRRF = parseDecimalBR(rendPJ?.totaisImpostoRetidoFonte)
    const totalPrevOficial = parseDecimalBR(rendPJ?.totaisContribuicaoPrevOficial)
    const totalDecimoTerceiro = parseDecimalBR(rendPJ?.totaisDecimoTerceiro)
    const totalRendIsentos = parseDecimalBR(rendIsentos?.total)
    const totalTribExclusiva = parseDecimalBR(rendTribExclusiva?.total)
    const rendAplicacoes = parseDecimalBR(rendTribExclusiva?.rendAplicacoes)
    const ganhosCapital = parseDecimalBR(rendTribExclusiva?.ganhosCapital)
    const totalBensAnterior = parseDecimalBR(bens?.totalExercicioAnterior)
    const totalBensAtual = parseDecimalBR(bens?.totalExercicioAtual)
    const totalDividasAnterior = parseDecimalBR(dividas?.totalExercicioAnterior)
    const totalDividasAtual = parseDecimalBR(dividas?.totalExercicioAtual)
    
    // Calculate tax figures if not in summary
    let baseCalculo = parseDecimalBR(resumo?.baseCalculo)
    let impostoDevido = parseDecimalBR(resumo?.impostoDevido)
    let impostoRestituir = parseDecimalBR(resumo?.impostoRestituir)
    let saldoPagar = parseDecimalBR(resumo?.saldoImpostoPagar)
    const aliquotaEfetiva = parseDecimalBR(resumo?.aliquotaEfetiva)
    const totalImpostoPago = parseDecimalBR(resumo?.totalImpostoPago) || totalIRRF
    
    // If no summary, calculate estimates
    if (!resumo) {
      baseCalculo = totalRendPJ - totalPrevOficial
      // Progressive tax calculation (simplified Brazilian IRPF 2026)
      if (baseCalculo <= 26963.20) {
        impostoDevido = 0
      } else if (baseCalculo <= 33919.80) {
        impostoDevido = (baseCalculo - 26963.20) * 0.075
      } else if (baseCalculo <= 45012.60) {
        impostoDevido = 521.75 + (baseCalculo - 33919.80) * 0.15
      } else if (baseCalculo <= 55976.16) {
        impostoDevido = 2184.67 + (baseCalculo - 45012.60) * 0.225
      } else {
        impostoDevido = 4649.96 + (baseCalculo - 55976.16) * 0.275
      }
      
      const impDiff = totalIRRF - impostoDevido
      if (impDiff > 0) {
        impostoRestituir = impDiff
        saldoPagar = 0
      } else {
        impostoRestituir = 0
        saldoPagar = Math.abs(impDiff)
      }
    }
    
    const qtdBens = classe.bens?.[0]?.item?.length || 0
    
    const resultadoDeclaracao = determineResult(impostoRestituir, saldoPagar)
    
    // Get nome from identification or other sources
    let nome = identificacao?.nome || ''
    if (!nome) {
      // Try to extract from other sources in rawData if needed
      nome = 'CONTRIBUINTE'
    }
    
    return {
      cpf,
      nome,
      exercicio: identificacao?.exercicio || '2026',
      dataCriacao: classe.$?.dataHoraSalvamento || null,
      resultadoDeclaracao,
      tipoDeclaracao: identificacao?.tipoDeclaracao || 'IRPF',
      dataNascimento: contribuinte?.dataNascimento || null,
      endereco,
      municipio: contribuinte?.municipio || null,
      uf: contribuinte?.uf || null,
      bairro: contribuinte?.bairro || null,
      cep: contribuinte?.cep || null,
      ocupacao: contribuinte?.ocupacaoPrincipal || null,
      naturezaOcupacao: contribuinte?.naturezaOcupacao || null,
      totalRendPJ,
      totalIRRF,
      totalPrevOficial,
      totalDecimoTerceiro,
      totalRendIsentos,
      totalTribExclusiva,
      rendAplicacoes,
      ganhosCapital,
      totalBensAnterior,
      totalBensAtual,
      qtdBens,
      totalDividasAnterior,
      totalDividasAtual,
      baseCalculo,
      impostoDevido,
      impostoRestituir,
      saldoPagar,
      aliquotaEfetiva: aliquotaEfetiva || (baseCalculo > 0 ? (impostoDevido / baseCalculo) * 100 : 0),
      totalImpostoPago,
      rawData: result as unknown as Record<string, unknown>
    }
  } catch (error) {
    console.error('Error parsing XML:', error)
    throw new Error('Erro ao processar o arquivo XML. Verifique se o arquivo esta no formato correto.')
  }
}
