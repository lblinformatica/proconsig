'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeft,
  CheckCircle2,
  Search,
  AlertTriangle,
  UserPlus,
  ListFilter,
  Calculator,
  Loader2,
  Landmark,
  Wallet,
  X,
  Plus,
  Minus,
  Layers
} from 'lucide-react';
import { validateCPF, formatCPF, formatAgencia } from '@/lib/cpf';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getPrazoByCoef, Coeficiente } from '@/lib/coeficientes';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fs = { display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.85rem' } as const;
const ls = {
  fontSize: '1rem',
  fontWeight: 600,
  color: 'var(--color-primary)',
  marginBottom: '1.25rem',
  display: 'block',
  width: '100%',
  borderBottom: '1px solid var(--color-border)',
  paddingBottom: '0.25rem'
} as const;
const readonlyStyle = {
  background: 'var(--color-bg-body)',
  color: 'var(--color-text-muted)',
  cursor: 'default',
  width: '100%'
} as const;

interface ParcelaProcessada {
  id: number;
  operacao: string;
  cpf: string;
  vencimento: string;
  valor: number;
  parcela_valor: number;
  contrato: number;
  coef: number;
  grupo: number | null;
  contacobranca: string;
  vendedor: string;
  num_parcela: number;
  numParcela: number;
  dias: number;
  percDesconto: string;
  valorDesconto: number;
  valorComDesconto: number;
  isBaixada: boolean;
}

interface ContratoAgrupado {
  operacao: string;
  grupo: string;
  conta_ativacao: string;
  empresa_ativacao: string;
  empresa_credora: string;
  vendedor_raw: string;
  valor_contrato: number;
  parcela_valor: number;
  coef: number;
  prazo: number;
  semParcelas: boolean;
  parcelas: ParcelaProcessada[];
  parcelasAbertas: ParcelaProcessada[];
  parcelasSelecionadas: ParcelaProcessada[];
  somaBrutaAberta: number;
  somaLiquidaAberta: number;
  somaBrutaSelecionada: number;
  somaLiquidaSelecionada: number;
}

const MONTH_NAMES: { [key: string]: string } = {
  '01': 'JANEIRO',
  '02': 'FEVEREIRO',
  '03': 'MARÇO',
  '04': 'ABRIL',
  '05': 'MAIO',
  '06': 'JUNHO',
  '07': 'JULHO',
  '08': 'AGOSTO',
  '09': 'SETEMBRO',
  '10': 'OUTUBRO',
  '11': 'NOVEMBRO',
  '12': 'DEZEMBRO'
};

export default function NovaVendaLote() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateModal, setDuplicateModal] = useState<{ open: boolean; contratos: string[] }>({ open: false, contratos: [] });
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string }>({
    show: false,
    title: '',
    message: ''
  });

  const [vendedores, setVendedores] = useState<any[]>([]);
  const [contasMap, setContasMap] = useState<any[]>([]);
  const [gruposDisponiveis, setGruposDisponiveis] = useState<(number | string)[]>([]);
  const [coeficientesList, setCoeficientesList] = useState<Coeficiente[]>([]);

  useEffect(() => {
    const fetchVendedores = async () => {
      const { data } = await supabase
        .schema('pro_consig')
        .from('vendedores')
        .select('codigo, nome')
        .eq('ativo', true)
        .order('codigo', { ascending: true });
      if (data) setVendedores(data);
    };
    const fetchContas = async () => {
      const { data } = await supabase
        .schema('pro_consig')
        .from('contas')
        .select('*')
        .order('grupo', { ascending: true });
      if (data) {
        setContasMap(data);
        const unique = Array.from(new Set(data.map(d => d.grupo).filter(Boolean)));
        setGruposDisponiveis(unique);
      }
    };
    const fetchCoeficientes = async () => {
      const { data } = await supabase
        .schema('pro_consig')
        .from('coeficientes')
        .select('*')
        .eq('ativo', true)
        .order('prazo', { ascending: true });
      if (data) setCoeficientesList(data);
    };
    fetchVendedores();
    fetchContas();
    fetchCoeficientes();
  }, []);

  const [cpf, setCpf] = useState('');
  const [clientFound, setClientFound] = useState<any>(null);
  const [searchInitiated, setSearchInitiated] = useState(false);
  const [operacoesDisponiveis, setOperacoesDisponiveis] = useState<any[]>([]);
  const [selectedOpIds, setSelectedOpIds] = useState<number[]>([]);
  const [expandedContratos, setExpandedContratos] = useState<string[]>([]);
  const [baixasCliente, setBaixasCliente] = useState<any[]>([]);
  const [hasOperationsButAllSold, setHasOperationsButAllSold] = useState(false);
  const [lastAutoObs, setLastAutoObs] = useState('');

  const [form, setForm] = useState({
    orgao: '',
    empresa: '',
    operacao: 'REFIN',
    corretor: '',
    carteira: '',
    valor: '0,00',
    saldo: '0,00',
    valor_liquido: '0,00',
    coef: '',
    parcela: '0,00',
    prazo: '',
    banco: '',
    agencia: '',
    agencia_dv: '',
    op: '',
    conta: '',
    conta_dv: '',
    tipo_conta: 'corrente',
    contrato: '',
    grupo: '',
    empresa_ativacao: '',
    conta_ativacao: '',
    inicio_mes: '',
    inicio_ano: new Date().getFullYear().toString(),
    dia_util: '',
    empresa_credora: '',
    observacao: '',
    forma_credito: 'conta',
    pix_tipo_chave: '',
    pix_chave: '',
    credito_banco: '',
    credito_agencia: '',
    credito_agencia_dv: '',
    credito_conta: '',
    credito_conta_dv: '',
    credito_tipo_conta: 'corrente',
    novo_cliente: '',
    atualizacao_cadastral: ''
  });

  const [sumModalData, setSumModalData] = useState<{ cpf: string; name: string; vendas: any[]; total: number } | null>(null);
  const [loadingSumModal, setLoadingSumModal] = useState(false);

  const showAlert = (title: string, message: string) => {
    setAlertModal({ show: true, title, message });
  };

  const parseNumericVal = (raw: any): number => {
    if (raw === undefined || raw === null || raw === '') return 0;
    if (typeof raw === 'number') return raw;
    const str = String(raw).trim();
    if (str.includes(',')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(str) || 0;
  };

  const resolveContaInfo = (grupoVal: string | number | null, contaVal: string | number | null) => {
    if (!grupoVal || !contaVal) return { empresa_ativacao: '', empresa_credora: '' };
    const numGrupo = Number(grupoVal);
    const numConta = Number(contaVal);
    const found = contasMap.find(c => Number(c.grupo) === numGrupo && Number(c.conta_ativacao) === numConta);
    return {
      empresa_ativacao: found?.empresa_ativacao || '',
      empresa_credora: found?.empresa_credora || ''
    };
  };

  const handleOpenSumModal = async () => {
    if (!cpf) return;
    const formattedCpf = formatCPF(cpf);
    const clientName = clientFound?.nome || '-';
    setLoadingSumModal(true);
    try {
      const { data, error } = await supabase
        .schema('pro_consig')
        .from('vendas')
        .select('id, operacao, codigo_operacao, abat, status')
        .eq('cpf', formattedCpf);

      if (error) throw error;

      const openSales = (data || []).filter(s => {
        const sLower = s.status?.toLowerCase();
        return sLower !== 'pago' && sLower !== 'paga';
      });

      const totalAbat = openSales.reduce((acc, curr) => {
        return acc + parseNumericVal(curr.abat);
      }, 0);

      setSumModalData({
        cpf: formattedCpf,
        name: clientName,
        vendas: openSales,
        total: totalAbat
      });
    } catch (e: any) {
      showAlert('Erro', 'Falha ao buscar vendas do cliente: ' + e.message);
    } finally {
      setLoadingSumModal(false);
    }
  };

  const resetScreen = () => {
    setClientFound(null);
    setSearchInitiated(false);
    setOperacoesDisponiveis([]);
    setSelectedOpIds([]);
    setExpandedContratos([]);
    setHasOperationsButAllSold(false);
    setForm(f => ({
      ...f,
      orgao: '',
      empresa: '',
      corretor: '',
      carteira: '',
      valor: '0,00',
      saldo: '0,00',
      valor_liquido: '0,00',
      coef: '',
      parcela: '0,00',
      prazo: '',
      banco: '',
      agencia: '',
      agencia_dv: '',
      op: '',
      conta: '',
      conta_dv: '',
      contrato: '',
      grupo: '',
      empresa_ativacao: '',
      conta_ativacao: '',
      inicio_mes: '',
      dia_util: '',
      empresa_credora: '',
      observacao: '',
      forma_credito: 'conta',
      pix_tipo_chave: '',
      pix_chave: '',
      credito_banco: '',
      credito_agencia: '',
      credito_agencia_dv: '',
      credito_conta: '',
      credito_conta_dv: '',
      novo_cliente: '',
      atualizacao_cadastral: ''
    }));
  };

  const buscarEmpresasPorGrupoEConta = async (grupoVal: string, contaVal: string, silent: boolean = false) => {
    if (!grupoVal || !contaVal) {
      setForm(f => ({ ...f, empresa_ativacao: '', empresa_credora: '' }));
      return;
    }
    const numGrupo = parseInt(grupoVal, 10);
    const numConta = parseInt(contaVal, 10);
    if (isNaN(numGrupo) || isNaN(numConta)) {
      setForm(f => ({ ...f, empresa_ativacao: '', empresa_credora: '' }));
      return;
    }

    const { data } = await supabase
      .schema('pro_consig')
      .from('contas')
      .select('empresa_ativacao, empresa_credora')
      .eq('grupo', numGrupo)
      .eq('conta_ativacao', numConta)
      .maybeSingle();

    if (data) {
      setForm(f => ({
        ...f,
        empresa_ativacao: data.empresa_ativacao || '',
        empresa_credora: data.empresa_credora || ''
      }));
    } else {
      setForm(f => ({
        ...f,
        empresa_ativacao: '',
        empresa_credora: ''
      }));
      if (!silent) {
        showAlert(
          'Conta Ativação não localizada',
          `A Conta Ativação ${contaVal} não foi encontrada para o Grupo ${grupoVal} na tabela de contas.`
        );
      }
    }
  };

  const buscarCliente = async () => {
    if (!validateCPF(cpf)) {
      setClientFound(null);
      setSearchInitiated(false);
      return showAlert('CPF Inválido', 'Por favor, informe um CPF válido para realizar a busca.');
    }

    setSearchLoading(true);
    setSearchInitiated(true);
    setError('');
    setClientFound(null);
    setSelectedOpIds([]);
    setExpandedContratos([]);

    const formattedCpf = formatCPF(cpf);
    const rawCpf = formattedCpf.replace(/[^\d]/g, '');

    // Verificar Inadimplência
    const { data: inadimplente } = await supabase
      .schema('pro_consig')
      .from('inadimplentes')
      .select('id')
      .eq('cpf', rawCpf)
      .limit(1)
      .maybeSingle();

    if (inadimplente) {
      setSearchLoading(false);
      setSearchInitiated(false);
      return showAlert(
        'Cliente com restritivo interno (Inadimplência)',
        'Este CPF possui restrição interna e não é permitido prosseguir com a venda.'
      );
    }

    // Buscar Baixas (Parcelas já pagas)
    const { data: baixas } = await supabase.schema('pro_consig').from('baixas').select('*').eq('cpf', rawCpf);
    setBaixasCliente(baixas || []);

    const { data: cliente } = await supabase.schema('pro_consig').from('clientes').select('*').eq('cpf', formattedCpf).single();

    if (cliente) {
      setClientFound(cliente);
      setForm(f => ({
        ...f,
        banco: cliente.banco || '',
        agencia: formatAgencia(cliente.agencia),
        agencia_dv: cliente.agencia_dv || '',
        conta: cliente.conta || '',
        conta_dv: cliente.conta_dv || '',
        tipo_conta: cliente.tipo_conta || 'corrente',
        op: cliente.op || '',
        credito_banco: '',
        credito_agencia: '',
        credito_agencia_dv: '',
        credito_conta: '',
        credito_conta_dv: '',
        credito_tipo_conta: 'corrente',
        pix_tipo_chave: '',
        pix_chave: ''
      }));

      // Busca operações disponíveis que NÃO têm venda registrada
      const { data: ops } = await supabase.schema('pro_consig').from('operacoes').select('*').eq('cpf', formattedCpf);
      const { data: existingVendas } = await supabase.schema('pro_consig').from('vendas').select('contrato, codigo_operacao').eq('cpf', formattedCpf);

      if (ops) {
        const soldContracts = new Set<string>();
        (existingVendas || []).forEach(v => {
          if (v.contrato) soldContracts.add(String(v.contrato).trim());
          if (v.codigo_operacao) soldContracts.add(String(v.codigo_operacao).trim());
        });

        const disponiveis = ops.filter(o => !soldContracts.has(String(o.operacao).trim()));
        setOperacoesDisponiveis(disponiveis);

        // Preenche automaticamente o Vendedor/Carteira com base na primeira operação disponível
        if (disponiveis.length > 0) {
          const firstOp = disponiveis[0];
          const rawVendedorName = firstOp.vendedor ? firstOp.vendedor.trim().toUpperCase() : '';
          let matchingVendedor = '';
          if (rawVendedorName) {
            const foundVendedor = vendedores.find(v => {
              const formatted = `${v.codigo} - ${v.nome}`.toUpperCase();
              return (
                v.nome.toUpperCase() === rawVendedorName ||
                formatted === rawVendedorName ||
                rawVendedorName.includes(v.nome.toUpperCase())
              );
            });
            if (foundVendedor) {
              matchingVendedor = foundVendedor.codigo;
            }
          }
          const grupoOp = firstOp.grupo ? String(firstOp.grupo) : '';
          const contaOp = firstOp.contacobranca ? String(firstOp.contacobranca) : '';
          setForm(f => ({
            ...f,
            corretor: matchingVendedor || f.corretor,
            carteira: matchingVendedor || f.carteira,
            grupo: grupoOp,
            conta_ativacao: contaOp
          }));
          if (grupoOp && contaOp) {
            buscarEmpresasPorGrupoEConta(grupoOp, contaOp, true);
          }
        }

        if (ops.length > 0 && disponiveis.length === 0) {
          setHasOperationsButAllSold(true);
          showAlert(
            'Contratos Já Cadastrados',
            'Todos os contratos deste CPF já constam registrados em Vendas.'
          );
        } else {
          setHasOperationsButAllSold(false);
        }
      } else {
        setHasOperationsButAllSold(false);
      }
    } else {
      setClientFound(null);
      setOperacoesDisponiveis([]);
      setHasOperationsButAllSold(false);
    }
    setSearchLoading(false);
  };

  // Agrupamento de contratos somados com suas respectivas parcelas calculadas
  const contratosAgrupados = useMemo<ContratoAgrupado[]>(() => {
    if (operacoesDisponiveis.length === 0) return [];

    const map = new Map<string, any[]>();
    operacoesDisponiveis.forEach(o => {
      const key = String(o.operacao).trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });

    const result: ContratoAgrupado[] = [];

    map.forEach((rawParcelas, opKey) => {
      const sorted = [...rawParcelas].sort(
        (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
      );
      const first = sorted[0];
      const semParcelas = sorted.some(p => Number(p.num_parcela) === 0);

      const parcelas: ParcelaProcessada[] = sorted.map((o, idx) => {
        const hoje = new Date();
        const venc = new Date(o.vencimento);
        const diffTime = venc.getTime() - hoje.getTime();
        const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const rate = Number(o.grupo) === 2 ? 0.0022 : 0;
        const percDesconto = dias > 0 ? dias * rate : 0;
        const valorParcelaLinha = parseNumericVal(o.valor);
        const valorDesconto = valorParcelaLinha * percDesconto;

        const rawOCpf = (o.cpf || '').replace(/[^\d]/g, '');
        const isBaixada = baixasCliente.some(b => {
          const bMesAno = b.vencimento ? b.vencimento.substring(0, 7) : '';
          const oMesAno = o.vencimento ? o.vencimento.substring(0, 7) : '';
          return (
            b.cpf === rawOCpf &&
            String(b.operacao).trim() === opKey &&
            bMesAno &&
            oMesAno &&
            bMesAno === oMesAno
          );
        });

        return {
          ...o,
          operacao: opKey,
          valor: valorParcelaLinha,
          parcela_valor: parseNumericVal(o.parcela_valor) || valorParcelaLinha,
          contrato: parseNumericVal(o.contrato),
          coef: parseNumericVal(o.coef),
          numParcela: idx + 1,
          dias: dias > 0 ? dias : 0,
          percDesconto: (percDesconto * 100).toFixed(2),
          valorDesconto,
          valorComDesconto: valorParcelaLinha - valorDesconto,
          isBaixada
        };
      });

      const parcelasAbertas = semParcelas ? [] : parcelas.filter(p => !p.isBaixada);
      const parcelasSelecionadas = parcelasAbertas.filter(p => selectedOpIds.includes(p.id));

      const valorContratoNum = parseNumericVal(first.contrato);
      const parcelaValorNum = parseNumericVal(first.parcela_valor) || parseNumericVal(first.valor);
      const rawCoef = valorContratoNum > 0 && parcelaValorNum > 0 ? parcelaValorNum / valorContratoNum : parseNumericVal(first.coef);
      const roundedCoef = Math.round(rawCoef * 1000) / 1000;
      const prazoCalc = Number(getPrazoByCoef(roundedCoef, coeficientesList)) || 0;

      const grupoStr = first.grupo !== undefined && first.grupo !== null ? String(first.grupo) : '';
      const contaStr = first.contacobranca ? String(first.contacobranca) : '';
      const contaInfo = resolveContaInfo(grupoStr, contaStr);

      result.push({
        operacao: opKey,
        grupo: grupoStr,
        conta_ativacao: contaStr,
        empresa_ativacao: contaInfo.empresa_ativacao,
        empresa_credora: contaInfo.empresa_credora,
        vendedor_raw: first.vendedor || '',
        valor_contrato: valorContratoNum,
        parcela_valor: parcelaValorNum,
        coef: roundedCoef,
        prazo: prazoCalc,
        semParcelas,
        parcelas,
        parcelasAbertas,
        parcelasSelecionadas,
        somaBrutaAberta: parcelasAbertas.reduce((acc, curr) => acc + curr.valor, 0),
        somaLiquidaAberta: parcelasAbertas.reduce((acc, curr) => acc + curr.valorComDesconto, 0),
        somaBrutaSelecionada: parcelasSelecionadas.reduce((acc, curr) => acc + curr.valor, 0),
        somaLiquidaSelecionada: parcelasSelecionadas.reduce((acc, curr) => acc + curr.valorComDesconto, 0)
      });
    });

    return result.sort((a, b) => Number(a.operacao) - Number(b.operacao));
  }, [operacoesDisponiveis, baixasCliente, selectedOpIds, coeficientesList, contasMap]);

  // Contratos que possuem ao menos 1 parcela selecionada
  const contratosSelecionados = useMemo(() => {
    return contratosAgrupados.filter(c => c.parcelasSelecionadas.length > 0);
  }, [contratosAgrupados]);

  // Totais gerais das parcelas selecionadas no lote
  const totaisLote = useMemo(() => {
    const totalParcelasAbertas = contratosAgrupados.reduce((acc, c) => acc + c.parcelasAbertas.length, 0);
    const qtdParcelasSelecionadas = contratosSelecionados.reduce((acc, c) => acc + c.parcelasSelecionadas.length, 0);
    const somaContratos = contratosSelecionados.reduce((acc, c) => acc + c.valor_contrato, 0);
    const somaParcelasBase = contratosSelecionados.reduce((acc, c) => acc + c.parcela_valor, 0);
    const saldoBruto = contratosSelecionados.reduce((acc, c) => acc + c.somaBrutaSelecionada, 0);
    const saldoLiquido = contratosSelecionados.reduce((acc, c) => acc + c.somaLiquidaSelecionada, 0);
    const valorLiquidoCliente = somaContratos - saldoLiquido;

    return {
      totalContratos: contratosAgrupados.length,
      contratosMarcados: contratosSelecionados.length,
      totalParcelasAbertas,
      qtdParcelasSelecionadas,
      somaContratos,
      somaParcelasBase,
      saldoBruto,
      saldoLiquido,
      valorLiquidoCliente
    };
  }, [contratosAgrupados, contratosSelecionados]);

  // Todas as parcelas abertas de todos os contratos
  const allOpenIds = useMemo(() => {
    return contratosAgrupados.flatMap(c => c.parcelasAbertas.map(p => p.id));
  }, [contratosAgrupados]);

  const isAllGlobalSelected = useMemo(() => {
    return allOpenIds.length > 0 && allOpenIds.every(id => selectedOpIds.includes(id));
  }, [allOpenIds, selectedOpIds]);

  const handleToggleAllGlobal = () => {
    if (isAllGlobalSelected) {
      setSelectedOpIds([]);
    } else {
      setSelectedOpIds(allOpenIds);
    }
  };

  const handleToggleContrato = (contrato: ContratoAgrupado) => {
    const openIds = contrato.parcelasAbertas.map(p => p.id);
    if (openIds.length === 0) return;

    const allContractSelected = openIds.every(id => selectedOpIds.includes(id));
    if (allContractSelected) {
      setSelectedOpIds(prev => prev.filter(id => !openIds.includes(id)));
    } else {
      setSelectedOpIds(prev => Array.from(new Set([...prev, ...openIds])));
    }
  };

  const handleToggleParcela = (id: number) => {
    setSelectedOpIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  };

  const toggleExpandContrato = (operacao: string) => {
    setExpandedContratos(prev =>
      prev.includes(operacao) ? prev.filter(op => op !== operacao) : [...prev, operacao]
    );
  };

  // Atualiza automaticamente os campos calculados de Valores e Condições, Ativação e Início quando a seleção muda
  useEffect(() => {
    if (contratosSelecionados.length === 0) {
      setForm(f => ({
        ...f,
        contrato: '',
        valor: '0,00',
        saldo: '0,00',
        valor_liquido: '0,00',
        parcela: '0,00',
        coef: '',
        prazo: '',
        inicio_mes: '',
        inicio_ano: ''
      }));
      return;
    }

    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const contratosNomes = contratosSelecionados.map(c => c.operacao).join(', ');

    // Coeficiente e Prazo exibidos no resumo
    const firstSelected = contratosSelecionados[0];
    const sameCoef = contratosSelecionados.every(c => Math.abs(c.coef - firstSelected.coef) < 0.0001);
    const samePrazo = contratosSelecionados.every(c => c.prazo === firstSelected.prazo);

    const coefStr = sameCoef ? firstSelected.coef.toFixed(3).replace('.', ',') : 'VÁRIOS';
    const prazoStr = samePrazo ? (firstSelected.prazo ? String(firstSelected.prazo) : '') : 'VÁRIOS';

    // Parcela mais antiga selecionada para definir Mês/Ano de início
    const todasSelecionadas = contratosSelecionados.flatMap(c => c.parcelasSelecionadas);
    const maisAntiga = [...todasSelecionadas].sort(
      (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
    )[0];

    let mes = '';
    let ano = '';
    if (maisAntiga?.vencimento) {
      const dataVenc = new Date(maisAntiga.vencimento + 'T12:00:00');
      mes = (dataVenc.getMonth() + 1).toString().padStart(2, '0');
      ano = dataVenc.getFullYear().toString();
    }

    const grupoOp = firstSelected.grupo || '';
    const contaOp = firstSelected.conta_ativacao || '';

    setForm(f => ({
      ...f,
      contrato: contratosNomes,
      valor: fmt(totaisLote.somaContratos),
      saldo: fmt(totaisLote.saldoLiquido),
      valor_liquido: fmt(totaisLote.valorLiquidoCliente),
      parcela: fmt(totaisLote.somaParcelasBase),
      coef: coefStr,
      prazo: prazoStr,
      inicio_mes: mes,
      inicio_ano: ano,
      grupo: f.grupo || grupoOp,
      conta_ativacao: f.conta_ativacao || contaOp
    }));

    if (grupoOp && contaOp && !form.empresa_ativacao) {
      buscarEmpresasPorGrupoEConta(grupoOp, contaOp, true);
    }
  }, [contratosSelecionados, totaisLote]);

  // Geração automática da Observação padrão
  useEffect(() => {
    const parts: string[] = [];
    if (form.conta_ativacao || form.empresa_ativacao) {
      if (form.conta_ativacao && form.empresa_ativacao) {
        parts.push(`ATIVAÇÃO ${form.conta_ativacao.trim()} - ${form.empresa_ativacao.trim().toUpperCase()}`);
      } else if (form.conta_ativacao) {
        parts.push(`ATIVAÇÃO ${form.conta_ativacao.trim()}`);
      } else if (form.empresa_ativacao) {
        parts.push(`ATIVAÇÃO ${form.empresa_ativacao.trim().toUpperCase()}`);
      }
    }

    const mesNome = form.inicio_mes ? MONTH_NAMES[form.inicio_mes] || '' : '';
    if (mesNome && form.inicio_ano) {
      parts.push(`INICIO ${mesNome}/${form.inicio_ano}`);
    }

    if (contratosSelecionados.length > 0) {
      const restamTotal = contratosSelecionados.reduce((acc, c) => acc + c.parcelasAbertas.length, 0);
      const abatidasTotal = Math.min(
        contratosSelecionados.reduce((acc, c) => acc + c.parcelasSelecionadas.length, 0),
        restamTotal
      );
      parts.push(`RESTAM ${restamTotal} ABATIDAS ${abatidasTotal}`);
    }

    if (form.dia_util) {
      let du = form.dia_util.trim();
      if (/^\d+$/.test(du) && !du.includes('°') && !du.includes('º')) {
        du = `${du}°`;
      }
      parts.push(`${du.toUpperCase()} DIA UTIL`);
    }

    const generated = parts.join(' - ');
    if (!form.observacao || form.observacao === lastAutoObs) {
      setForm(f => ({ ...f, observacao: generated }));
      setLastAutoObs(generated);
    }
  }, [
    form.conta_ativacao,
    form.empresa_ativacao,
    form.inicio_mes,
    form.inicio_ano,
    form.dia_util,
    contratosSelecionados,
    lastAutoObs,
    form.observacao
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'forma_credito') {
      setForm(f => ({
        ...f,
        forma_credito: value,
        pix_tipo_chave: '',
        pix_chave: '',
        credito_banco: '',
        credito_agencia: '',
        credito_agencia_dv: '',
        credito_conta: '',
        credito_conta_dv: '',
        credito_tipo_conta: 'corrente'
      }));
      return;
    }

    if (name === 'credito_tipo_conta') {
      setForm(f => ({
        ...f,
        credito_tipo_conta: value,
        credito_banco: '',
        credito_agencia: '',
        credito_agencia_dv: '',
        credito_conta: '',
        credito_conta_dv: ''
      }));
      return;
    }

    if (name === 'grupo') {
      setForm(f => ({ ...f, grupo: value }));
      if (value && form.conta_ativacao) {
        buscarEmpresasPorGrupoEConta(value, form.conta_ativacao);
      } else if (!value) {
        setForm(f => ({ ...f, empresa_ativacao: '', empresa_credora: '' }));
      }
      return;
    }

    const numericFields = [
      'conta_ativacao',
      'inicio_ano',
      'agencia',
      'agencia_dv',
      'conta',
      'conta_dv',
      'op',
      'credito_agencia',
      'credito_agencia_dv',
      'credito_conta',
      'credito_conta_dv'
    ];
    if (numericFields.includes(name)) {
      const cleanValue = value.replace(/\D/g, '');
      setForm(f => ({
        ...f,
        [name]: cleanValue,
        ...(name === 'conta_ativacao' ? { empresa_ativacao: '', empresa_credora: '' } : {})
      }));
      return;
    }

    const skipUppercaseFields = [
      'novo_cliente',
      'atualizacao_cadastral',
      'tipo_conta',
      'credito_tipo_conta',
      'forma_credito',
      'pix_tipo_chave',
      'inicio_mes',
      'grupo'
    ];

    let finalValue = value;
    if (typeof value === 'string') {
      if (name.toLowerCase().includes('email')) {
        finalValue = value.toLowerCase();
      } else if (!skipUppercaseFields.includes(name)) {
        finalValue = value.toUpperCase();
      }
    }
    setForm(f => ({ ...f, [name]: finalValue }));
  };

  const gerarObservacaoIndividual = (c: ContratoAgrupado) => {
    const parts: string[] = [];
    const contaAtiv = form.conta_ativacao || c.conta_ativacao;
    const empAtiv = form.empresa_ativacao || c.empresa_ativacao;

    if (contaAtiv || empAtiv) {
      if (contaAtiv && empAtiv) {
        parts.push(`ATIVAÇÃO ${contaAtiv.trim()} - ${empAtiv.trim().toUpperCase()}`);
      } else if (contaAtiv) {
        parts.push(`ATIVAÇÃO ${contaAtiv.trim()}`);
      } else if (empAtiv) {
        parts.push(`ATIVAÇÃO ${empAtiv.trim().toUpperCase()}`);
      }
    }

    const maisAntiga = [...c.parcelasSelecionadas].sort(
      (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
    )[0];

    if (maisAntiga?.vencimento) {
      const d = new Date(maisAntiga.vencimento + 'T12:00:00');
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const y = d.getFullYear().toString();
      const mesNome = MONTH_NAMES[m] || '';
      if (mesNome && y) {
        parts.push(`INICIO ${mesNome}/${y}`);
      }
    } else if (form.inicio_mes && form.inicio_ano) {
      const mesNome = MONTH_NAMES[form.inicio_mes] || '';
      if (mesNome) parts.push(`INICIO ${mesNome}/${form.inicio_ano}`);
    }

    const restamCount = c.parcelasAbertas.length;
    const abatidasCount = Math.min(c.parcelasSelecionadas.length, restamCount);
    parts.push(`RESTAM ${restamCount} ABATIDAS ${abatidasCount}`);

    if (form.dia_util) {
      let du = form.dia_util.trim();
      if (/^\d+$/.test(du) && !du.includes('°') && !du.includes('º')) {
        du = `${du}°`;
      }
      parts.push(`${du.toUpperCase()} DIA UTIL`);
    }

    return parts.join(' - ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientFound) {
      return showAlert('Atenção', 'Você precisa buscar e validar um cliente antes de gravar a venda em lote.');
    }

    if (contratosSelecionados.length === 0) {
      return showAlert('Nenhuma Parcela Selecionada', 'Por favor, selecione ao menos um contrato/parcela no grid antes de gravar.');
    }

    if (!form.corretor || !form.corretor.trim()) {
      return showAlert('Campo Obrigatório', 'Por favor, informe o Vendedor.');
    }

    if (!form.novo_cliente) {
      return showAlert('Campo Obrigatório', 'Por favor, informe se é Novo Cliente.');
    }

    if (!form.atualizacao_cadastral) {
      return showAlert('Campo Obrigatório', 'Por favor, informe se houve Atualização Cadastral.');
    }

    if (!form.banco || !form.agencia || !form.conta) {
      return showAlert('Dados Bancários Ausentes', 'Por favor, informe os Dados Bancários (Banco, Agência e Conta) do cliente.');
    }

    if (form.forma_credito === 'conta') {
      if (!form.credito_banco || !form.credito_agencia || !form.credito_conta) {
        return showAlert('Dados de Crédito Ausentes', 'Por favor, informe os Dados Bancários para Crédito (Banco, Agência e Conta).');
      }
    } else if (form.forma_credito === 'pix') {
      if (!form.pix_chave) {
        return showAlert('Chave PIX Ausente', 'Por favor, informe a Chave PIX do cliente.');
      }
    } else {
      return showAlert('Forma de Crédito Ausente', 'Por favor, informe a Forma de Crédito.');
    }

    // Validar prazo de cada contrato selecionado
    const contratoSemPrazo = contratosSelecionados.find(c => !c.prazo);
    if (contratoSemPrazo) {
      return showAlert(
        'Prazo não identificado',
        `O contrato ${contratoSemPrazo.operacao} possui valores que não correspondem a nenhum prazo na tabela de coeficientes.`
      );
    }

    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Por favor, faça login novamente.');

      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('supabase_user_id', session.user.id)
        .single();

      if (userError || !userData) {
        throw new Error('Não foi possível identificar seu usuário no sistema.');
      }

      const formattedCpf = formatCPF(cpf);
      const contratosNums = contratosSelecionados.map(c => c.operacao);

      // Validação de duplicidade para os contratos selecionados
      const { data: duplicates } = await supabase
        .schema('pro_consig')
        .from('vendas')
        .select('contrato')
        .eq('cpf', formattedCpf)
        .in('contrato', contratosNums);

      if (duplicates && duplicates.length > 0) {
        setDuplicateModal({
          open: true,
          contratos: duplicates.map(d => d.contrato)
        });
        setLoading(false);
        return;
      }

      // Monta os registros individuais (Opção A: 1 registro de venda por contrato selecionado)
      const payloads = contratosSelecionados.map(c => {
        const maisAntiga = [...c.parcelasSelecionadas].sort(
          (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
        )[0];

        let dataInicio: string | null = null;
        if (maisAntiga?.vencimento) {
          const d = new Date(maisAntiga.vencimento + 'T12:00:00');
          const m = (d.getMonth() + 1).toString().padStart(2, '0');
          const y = d.getFullYear().toString();
          dataInicio = `${y}-${m}-01`;
        } else if (form.inicio_mes && form.inicio_ano) {
          dataInicio = `${form.inicio_ano}-${form.inicio_mes}-01`;
        }

        const saldoContrato = Number(c.somaLiquidaSelecionada.toFixed(2));
        const liquidoContrato = (c.valor_contrato - saldoContrato).toFixed(2).replace('.', ',');
        const restamCount = c.parcelasAbertas.length;
        const abatidasCount = Math.min(c.parcelasSelecionadas.length, restamCount);

        const grupoFinal = form.grupo ? parseInt(form.grupo, 10) : (c.grupo ? parseInt(c.grupo, 10) : null);
        const contaAtivFinal = form.conta_ativacao || c.conta_ativacao;
        const empAtivFinal = form.empresa_ativacao || c.empresa_ativacao;
        const empCredFinal = form.empresa_credora || c.empresa_credora;

        return {
          cpf: formattedCpf,
          created_by: userData.id,
          orgao: form.orgao,
          empresa: form.empresa,
          operacao: 'REFIN',
          codigo_operacao: c.operacao,
          corretor: form.corretor,
          carteira: form.carteira,
          valor: c.valor_contrato || null,
          saldo: saldoContrato,
          abat: liquidoContrato,
          coef: c.coef || null,
          parcela: c.parcela_valor || null,
          prazo: c.prazo || null,
          banco: form.banco,
          agencia: formatAgencia(form.agencia),
          agencia_dv: form.agencia_dv,
          op: form.op,
          conta: form.conta,
          conta_dv: form.conta_dv,
          tipo_conta: form.tipo_conta,
          contrato: c.operacao,
          grupo: grupoFinal,
          empresa_ativacao: empAtivFinal,
          conta_ativacao: contaAtivFinal,
          inicio: dataInicio,
          dia_util: form.dia_util,
          empresa_credora: empCredFinal,
          observacao: gerarObservacaoIndividual(c),
          forma_credito: form.forma_credito,
          pix_tipo_chave: form.pix_tipo_chave,
          pix_chave: form.pix_chave,
          credito_banco: form.credito_banco,
          credito_agencia: formatAgencia(form.credito_agencia),
          credito_agencia_dv: form.credito_agencia_dv,
          credito_conta: form.credito_conta,
          credito_conta_dv: form.credito_conta_dv,
          credito_tipo_conta: form.credito_tipo_conta,
          novo_cliente: form.novo_cliente,
          atualizacao_cadastral: form.atualizacao_cadastral,
          restam: restamCount,
          abatidas: abatidasCount
        };
      });

      const { error: insertError } = await supabase
        .schema('pro_consig')
        .from('vendas')
        .insert(payloads);

      if (insertError) {
        throw new Error(`${insertError.message || 'Erro ao criar vendas em lote.'} (${insertError.code || ''})`);
      }

      router.push('/vendas?tipo=lote');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido ao gravar a venda em lote.');
      setLoading(false);
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        onConfirm={() => setAlertModal({ show: false, title: '', message: '' })}
        confirmText="Entendi"
      />

      <ConfirmModal
        isOpen={duplicateModal.open}
        title="Venda Duplicada"
        message={`Já existe venda registrada para este CPF com o(s) contrato(s): ${duplicateModal.contratos.join(', ')}.`}
        onConfirm={() => setDuplicateModal({ open: false, contratos: [] })}
        confirmText="Fechar"
        confirmType="danger"
      />

      <div className="animate-fade-in" style={{ maxWidth: '1050px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
          <Link href="/vendas?tipo=lote" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Link>
          <h1 style={{ margin: 0 }}>Nova Venda (Lote)</h1>
        </div>

        {error && (
          <div
            className="card animate-fade-in"
            style={{
              marginBottom: '1.5rem',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderColor: 'var(--color-danger)',
              color: 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem'
            }}
          >
            <AlertTriangle size={24} />
            <div style={{ fontSize: '0.9rem' }}>
              <strong>Erro ao gravar:</strong> {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* IDENTIFICAÇÃO */}
          <div className="card" style={{ marginBottom: '1rem', backgroundColor: 'var(--color-bg-surface-hover)' }}>
            <legend style={ls}>Identificação do Cliente</legend>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ maxWidth: '280px', flex: 1 }}>
                <label style={fs}>CPF do Cliente</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={e => setCpf(formatCPF(e.target.value))}
                  onFocus={resetScreen}
                  placeholder="000.000.000-00"
                  style={{ width: '100%' }}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: '1.5rem', padding: '0.65rem' }}
                onClick={buscarCliente}
                disabled={searchLoading}
              >
                <Search size={20} />
              </button>
              {clientFound && !searchLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', marginTop: '1.5rem' }}>
                  <CheckCircle2 size={20} /> <strong>{clientFound.nome}</strong>
                </div>
              )}
            </div>
          </div>

          {searchLoading ? (
            <div
              className="card animate-fade-in"
              style={{
                textAlign: 'center',
                padding: '4rem',
                color: 'var(--color-text-muted)',
                border: '2px dashed var(--color-border)',
                backgroundColor: 'transparent',
                minHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <Loader2 size={40} className="animate-spin" style={{ color: 'var(--color-primary)', marginBottom: '1rem' }} />
              <p>Buscando dados e contratos do cliente...</p>
            </div>
          ) : clientFound ? (
            <div className="animate-fade-in">
              {/* DADOS INSTITUCIONAIS E OPERAÇÃO (Sem o campo código de operação) */}
              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}>Dados Institucionais e Operação</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={fs}>Convênio</label>
                    <select name="orgao" value={form.orgao} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem' }}>
                      <option value="">Selecione...</option>
                      <option value="1 - SIAPE">1 - SIAPE</option>
                      <option value="2 - INSS">2 - INSS</option>
                      <option value="7 - PREFEITURA">7 - PREFEITURA</option>
                      <option value="9 - FORÇAS ARMADAS">9 - FORÇAS ARMADAS</option>
                      <option value="11 - GOVERNO">11 - GOVERNO</option>
                      <option value="15 - SEGURO">15 - SEGURO</option>
                      <option value="14 - CLT">14 - CLT</option>
                    </select>
                  </div>
                  <div>
                    <label style={fs}>Empresa</label>
                    <input name="empresa" type="text" value={form.empresa} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem' }} />
                  </div>
                  <div>
                    <label style={fs}>Operação</label>
                    <input
                      name="operacao"
                      type="text"
                      value="REFIN"
                      readOnly
                      style={{ ...readonlyStyle, padding: '0.5rem', fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={fs}>Vendedor</label>
                    <select name="corretor" value={form.corretor} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem' }}>
                      <option value="">Selecione...</option>
                      {vendedores.map(v => {
                        const formatted = `${v.codigo} - ${v.nome}`;
                        return (
                          <option key={v.codigo} value={v.codigo}>
                            {formatted}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={fs}>Carteira</label>
                    <select name="carteira" value={form.carteira} onChange={handleChange} style={{ width: '100%', padding: '0.5rem' }}>
                      <option value="">Selecione...</option>
                      {vendedores.map(v => {
                        const formatted = `${v.codigo} - ${v.nome}`;
                        return (
                          <option key={v.codigo} value={v.codigo}>
                            {formatted}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={fs}>Novo Cliente</label>
                    <select name="novo_cliente" value={form.novo_cliente} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem' }}>
                      <option value="">Selecione...</option>
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </select>
                  </div>
                  <div>
                    <label style={fs}>Atualização Cadastral</label>
                    <select
                      name="atualizacao_cadastral"
                      value={form.atualizacao_cadastral}
                      onChange={handleChange}
                      required
                      style={{ width: '100%', padding: '0.5rem' }}
                    >
                      <option value="">Selecione...</option>
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* GRID DE CONTRATOS SOMADOS COM EXPANSÃO (+) DE PARCELAS */}
              <div
                className="card animate-fade-in"
                style={{
                  marginBottom: '1rem',
                  border: '1px solid var(--color-primary-light)',
                  backgroundColor: 'rgba(79, 70, 229, 0.01)'
                }}
              >
                <legend style={{ ...ls, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ListFilter size={18} /> Contratos do Cliente ({contratosAgrupados.length})
                    <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>
                      — Clique no botão [+] para detalhar e selecionar as parcelas
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenSumModal}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.3rem 0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.75rem',
                      height: 'auto',
                      border: '1px solid var(--color-primary-light)',
                      background: 'transparent',
                      color: 'var(--color-primary)'
                    }}
                    title="Somatória de Líquidos"
                    disabled={loadingSumModal}
                  >
                    <Calculator size={14} />
                    {loadingSumModal ? 'Calculando...' : 'Valores Líquidos a Receber'}
                  </button>
                </legend>

                {contratosAgrupados.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-warning)', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={20} />
                      {hasOperationsButAllSold
                        ? 'Todos os contratos deste CPF já foram registrados em Vendas.'
                        : 'Não há contratos disponíveis para este CPF.'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ border: '1px solid var(--color-border)' }}>
                      <table className="table table-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead>
                          <tr>
                            <th
                              style={{
                                width: '44px',
                                backgroundColor: 'var(--color-bg-surface-hover)',
                                borderBottom: '2px solid var(--color-border)',
                                textAlign: 'center',
                                padding: '0.5rem'
                              }}
                              title="Selecionar todas as parcelas de todos os contratos"
                            >
                              <input
                                type="checkbox"
                                checked={isAllGlobalSelected}
                                onChange={handleToggleAllGlobal}
                                disabled={allOpenIds.length === 0}
                                style={{ cursor: 'pointer', verticalAlign: 'middle' }}
                              />
                            </th>
                            <th
                              style={{
                                width: '50px',
                                backgroundColor: 'var(--color-bg-surface-hover)',
                                borderBottom: '2px solid var(--color-border)',
                                textAlign: 'center',
                                padding: '0.5rem'
                              }}
                            >
                              Parcelas
                            </th>
                            <th style={{ backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>
                              Operação / Contrato
                            </th>
                            <th style={{ backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>
                              Grupo
                            </th>
                            <th style={{ backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>
                              Vr. Contrato (R$)
                            </th>
                            <th style={{ backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>
                              Parcela (R$)
                            </th>
                            <th style={{ backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>
                              Qtd. Parcelas
                            </th>
                            <th style={{ backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>
                              Soma Bruta (R$)
                            </th>
                            <th style={{ backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>
                              Saldo Líquido (R$)
                            </th>
                          </tr>
                        </thead>
                        <tbody style={{ fontSize: '0.84rem' }}>
                          {contratosAgrupados.map(c => {
                            const isExpanded = expandedContratos.includes(c.operacao);
                            const openIds = c.parcelasAbertas.map(p => p.id);
                            const isContractAllSelected = openIds.length > 0 && openIds.every(id => selectedOpIds.includes(id));
                            const isContractPartiallySelected =
                              c.parcelasSelecionadas.length > 0 && !isContractAllSelected;

                            const exibirBruto =
                              c.parcelasSelecionadas.length > 0 ? c.somaBrutaSelecionada : c.somaBrutaAberta;
                            const exibirLiquido =
                              c.parcelasSelecionadas.length > 0 ? c.somaLiquidaSelecionada : c.somaLiquidaAberta;

                            return (
                              <Fragment key={c.operacao}>
                                <tr
                                  style={{
                                    backgroundColor:
                                      c.parcelasSelecionadas.length > 0
                                        ? 'rgba(79, 70, 229, 0.08)'
                                        : 'transparent',
                                    transition: 'background-color 0.15s ease'
                                  }}
                                >
                                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={isContractAllSelected}
                                      ref={el => {
                                        if (el) el.indeterminate = isContractPartiallySelected;
                                      }}
                                      disabled={c.semParcelas || openIds.length === 0}
                                      onChange={() => handleToggleContrato(c)}
                                      style={{ cursor: c.semParcelas ? 'not-allowed' : 'pointer', verticalAlign: 'middle' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandContrato(c.operacao)}
                                      title={isExpanded ? 'Ocultar parcelas' : 'Detalhar parcelas'}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--color-primary)',
                                        backgroundColor: isExpanded ? 'var(--color-primary)' : 'transparent',
                                        color: isExpanded ? '#fff' : 'var(--color-primary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
                                    </button>
                                  </td>
                                  <td
                                    onClick={() => toggleExpandContrato(c.operacao)}
                                    style={{
                                      padding: '0.55rem 0.5rem',
                                      textAlign: 'center',
                                      fontWeight: 700,
                                      color: 'var(--color-primary)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {c.operacao}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>
                                    {c.grupo || '-'}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                                    {c.valor_contrato.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
                                    {c.parcela_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center' }}>
                                    {c.semParcelas ? (
                                      <span style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.75rem' }}>
                                        Parcela Zero
                                      </span>
                                    ) : (
                                      <span>
                                        <strong style={{ color: c.parcelasSelecionadas.length > 0 ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                                          {c.parcelasSelecionadas.length}
                                        </strong>{' '}
                                        / {c.parcelasAbertas.length} abertas
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>
                                    {exibirBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                                    {exibirLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>

                                {/* SUB-GRID DE PARCELAS DO CONTRATO */}
                                {isExpanded && (
                                  <tr>
                                    <td
                                      colSpan={9}
                                      style={{
                                        padding: '0.75rem 1rem 1rem 2.25rem',
                                        backgroundColor: 'var(--color-bg-body)',
                                        borderBottom: '2px solid var(--color-border)'
                                      }}
                                    >
                                      {c.semParcelas ? (
                                        <div style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <AlertTriangle size={16} /> Esta operação não possui parcelas pendentes (Parcela Zero).
                                        </div>
                                      ) : (
                                        <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--color-bg-surface)' }}>
                                          <div style={{ padding: '0.45rem 0.75rem', backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '1px solid var(--color-border)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-primary)', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Parcelas da Operação {c.operacao}</span>
                                            <span>
                                              Selecionadas: {c.parcelasSelecionadas.length} de {c.parcelasAbertas.length}
                                            </span>
                                          </div>
                                          <table className="table table-sm" style={{ width: '100%', margin: 0, fontSize: '0.8rem' }}>
                                            <thead>
                                              <tr>
                                                <th style={{ width: '40px', textAlign: 'center', padding: '0.4rem' }}>
                                                  <input
                                                    type="checkbox"
                                                    checked={isContractAllSelected}
                                                    onChange={() => handleToggleContrato(c)}
                                                    style={{ cursor: 'pointer', verticalAlign: 'middle' }}
                                                  />
                                                </th>
                                                <th style={{ width: '65px', textAlign: 'right', padding: '0.4rem' }}>Parcela</th>
                                                <th style={{ textAlign: 'center', padding: '0.4rem' }}>Vencimento</th>
                                                <th style={{ textAlign: 'right', padding: '0.4rem' }}>Valor (R$)</th>
                                                <th style={{ textAlign: 'center', padding: '0.4rem' }}>Dias</th>
                                                <th style={{ textAlign: 'center', padding: '0.4rem' }}>Status</th>
                                                <th style={{ textAlign: 'center', padding: '0.4rem' }}>% Desconto</th>
                                                <th style={{ textAlign: 'right', padding: '0.4rem' }}>Desconto (R$)</th>
                                                <th style={{ textAlign: 'right', padding: '0.4rem' }}>Líquido (R$)</th>
                                                <th style={{ textAlign: 'center', padding: '0.4rem' }}>Grupo</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {c.parcelas.map(p => (
                                                <tr
                                                  key={p.id}
                                                  onClick={() => !p.isBaixada && handleToggleParcela(p.id)}
                                                  style={{
                                                    cursor: p.isBaixada ? 'not-allowed' : 'pointer',
                                                    backgroundColor: selectedOpIds.includes(p.id)
                                                      ? 'rgba(79, 70, 229, 0.06)'
                                                      : 'transparent',
                                                    opacity: p.isBaixada ? 0.6 : 1
                                                  }}
                                                >
                                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                                                    <input
                                                      type="checkbox"
                                                      checked={selectedOpIds.includes(p.id)}
                                                      disabled={p.isBaixada}
                                                      readOnly
                                                      style={{ verticalAlign: 'middle' }}
                                                    />
                                                  </td>
                                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                                    {p.numParcela}
                                                  </td>
                                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                                                    {new Date(p.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                  </td>
                                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>
                                                    {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  </td>
                                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>{p.dias}</td>
                                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                                                    {p.isBaixada ? (
                                                      <span style={{ color: 'var(--color-warning)', fontWeight: 700, fontSize: '0.75rem' }}>
                                                        Baixada
                                                      </span>
                                                    ) : (
                                                      <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.75rem' }}>
                                                        Aberta
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center', color: 'var(--color-danger)' }}>
                                                    {p.percDesconto}%
                                                  </td>
                                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: 'var(--color-danger)' }}>
                                                    - {p.valorDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  </td>
                                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>
                                                    {p.valorComDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  </td>
                                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>
                                                    {p.grupo}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* CARDS DE TOTAIS DO GRID */}
                    <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                      <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Contratos Selecionados</span>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {totaisLote.contratosMarcados} / {totaisLote.totalContratos}
                        </div>
                      </div>
                      <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Parcelas Abertas</span>
                        <div style={{ fontSize: '1rem', fontWeight: 700 }}>{totaisLote.totalParcelasAbertas}</div>
                      </div>
                      <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Parcelas Selecionadas</span>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>{totaisLote.qtdParcelasSelecionadas}</div>
                      </div>
                      <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Saldo Bruto</span>
                        <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                          R$ {totaisLote.saldoBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Saldo Líquido</span>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-success)' }}>
                          R$ {totaisLote.saldoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* VALORES E CONDIÇÕES (SOMENTE LEITURA - CALCULADOS PELAS PARCELAS SELECIONADAS) */}
              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}>
                  Valores e Condições{' '}
                  <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>
                    (Calculados automaticamente a partir das parcelas selecionadas)
                  </span>
                </legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={fs}>Contrato (R$)</label>
                    <input
                      name="valor"
                      type="text"
                      value={form.valor}
                      readOnly
                      style={{ ...readonlyStyle, fontWeight: 700, color: 'var(--color-primary)' }}
                    />
                  </div>
                  <div>
                    <label style={fs}>Saldo (R$)</label>
                    <input
                      name="saldo"
                      type="text"
                      value={form.saldo}
                      readOnly
                      style={{ ...readonlyStyle, fontWeight: 700, color: 'var(--color-warning)' }}
                    />
                  </div>
                  <div>
                    <label style={fs}>Líquido (R$)</label>
                    <input
                      name="valor_liquido"
                      type="text"
                      value={form.valor_liquido}
                      readOnly
                      style={{ ...readonlyStyle, fontWeight: 700, color: 'var(--color-success)' }}
                    />
                  </div>
                  <div>
                    <label style={fs}>Parcela (R$)</label>
                    <input name="parcela" type="text" value={form.parcela} readOnly style={readonlyStyle} />
                  </div>
                  <div>
                    <label style={fs}>Coeficiente</label>
                    <input name="coef" type="text" value={form.coef} readOnly style={readonlyStyle} />
                  </div>
                  <div>
                    <label style={fs}>Prazo</label>
                    <input name="prazo" type="text" value={form.prazo} readOnly style={readonlyStyle} />
                  </div>
                </div>
              </div>

              {/* DADOS BANCÁRIOS DÉBITO */}
              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Landmark size={18} /> Dados Bancários (Débito)
                  </div>
                </legend>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 180px 100px 60px 120px 60px 60px', gap: '1rem' }}>
                  <div>
                    <label style={fs}>Banco</label>
                    <input name="banco" type="text" value={form.banco} onChange={handleChange} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={fs}>Tipo Conta</label>
                    <select name="tipo_conta" value={form.tipo_conta} onChange={handleChange} style={{ width: '100%' }}>
                      <option value="corrente">Corrente</option>
                      <option value="poupanca">Poupança</option>
                    </select>
                  </div>
                  <div>
                    <label style={fs}>Agência</label>
                    <input name="agencia" type="text" value={form.agencia} onChange={handleChange} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={fs}>DV</label>
                    <input name="agencia_dv" type="text" value={form.agencia_dv} onChange={handleChange} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={fs}>Conta</label>
                    <input name="conta" type="text" value={form.conta} onChange={handleChange} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={fs}>DV</label>
                    <input name="conta_dv" type="text" value={form.conta_dv} onChange={handleChange} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={fs}>OP</label>
                    <input name="op" type="text" value={form.op} onChange={handleChange} style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              {/* DADOS PARA CRÉDITO */}
              <div className="card" style={{ marginBottom: '1rem', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                <legend style={ls}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Wallet size={18} /> Dados Para Crédito (Recebimento)
                  </div>
                </legend>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={fs}>Forma de Recebimento</label>
                  <select name="forma_credito" value={form.forma_credito} onChange={handleChange} style={{ width: '300px' }}>
                    <option value="conta">Crédito em Conta</option>
                    <option value="pix">PIX</option>
                  </select>
                </div>
                {form.forma_credito === 'conta' && (
                  <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '120px 180px 100px 60px 120px 60px', gap: '1rem' }}>
                    <div>
                      <label style={fs}>Banco</label>
                      <input name="credito_banco" type="text" value={form.credito_banco} onChange={handleChange} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={fs}>Tipo Conta</label>
                      <select name="credito_tipo_conta" value={form.credito_tipo_conta} onChange={handleChange} style={{ width: '100%' }}>
                        <option value="corrente">Corrente</option>
                        <option value="poupanca">Poupança</option>
                      </select>
                    </div>
                    <div>
                      <label style={fs}>Agência</label>
                      <input name="credito_agencia" type="text" value={form.credito_agencia} onChange={handleChange} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={fs}>DV</label>
                      <input name="credito_agencia_dv" type="text" value={form.credito_agencia_dv} onChange={handleChange} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={fs}>Conta</label>
                      <input name="credito_conta" type="text" value={form.credito_conta} onChange={handleChange} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={fs}>DV</label>
                      <input name="credito_conta_dv" type="text" value={form.credito_conta_dv} onChange={handleChange} style={{ width: '100%' }} />
                    </div>
                  </div>
                )}
                {form.forma_credito === 'pix' && (
                  <div className="animate-fade-in" style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ width: '200px' }}>
                      <label style={fs}>Tipo de Chave</label>
                      <select name="pix_tipo_chave" value={form.pix_tipo_chave} onChange={handleChange} style={{ width: '100%' }}>
                        <option value="">Selecione...</option>
                        <option value="cpf">CPF</option>
                        <option value="celular">Celular</option>
                        <option value="email">E-mail</option>
                        <option value="aleatoria">Chave Aleatória</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={fs}>Chave PIX</label>
                      <input name="pix_chave" type="text" value={form.pix_chave} onChange={handleChange} style={{ width: '100%' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* ATIVAÇÃO E CONTRATO */}
              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}>Ativação, Contrato e Lote</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={fs}>Nº do(s) Contrato(s)</label>
                    <input name="contrato" type="text" value={form.contrato} readOnly style={readonlyStyle} />
                  </div>
                  <div>
                    <label style={fs}>Grupo</label>
                    <select name="grupo" value={form.grupo} onChange={handleChange} required style={{ width: '100%' }}>
                      <option value="">Selecione...</option>
                      {gruposDisponiveis.map(g => (
                        <option key={g} value={g}>
                          Grupo {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fs}>Conta Ativação</label>
                    <input
                      name="conta_ativacao"
                      type="text"
                      value={form.conta_ativacao}
                      onChange={handleChange}
                      onBlur={e => buscarEmpresasPorGrupoEConta(form.grupo, e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={fs}>Empresa Ativação</label>
                    <input name="empresa_ativacao" type="text" value={form.empresa_ativacao} readOnly placeholder="Automático..." style={readonlyStyle} />
                  </div>

                  <div>
                    <label style={fs}>Dia Útil Adicional</label>
                    <input name="dia_util" type="text" value={form.dia_util} onChange={handleChange} required style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={fs}>Empresa Credora</label>
                    <input name="empresa_credora" type="text" value={form.empresa_credora} readOnly placeholder="Automático..." style={readonlyStyle} />
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={fs}>Mês</label>
                      <select name="inicio_mes" value={form.inicio_mes} onChange={handleChange} required style={{ width: '100%' }}>
                        <option value="">--</option>
                        {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1.5 }}>
                      <label style={fs}>Ano</label>
                      <input name="inicio_ano" type="number" value={form.inicio_ano} onChange={handleChange} required style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <legend style={ls}>Observações</legend>
                <textarea
                  name="observacao"
                  value={form.observacao}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Adicione detalhes..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '2rem' }}>
                <Link href="/vendas?tipo=lote" className="btn btn-secondary">
                  Cancelar
                </Link>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading
                    ? 'Gravando Lote...'
                    : contratosSelecionados.length > 1
                      ? `Gravar ${contratosSelecionados.length} Vendas em Lote`
                      : 'Gravar Venda em Lote'}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="card animate-fade-in"
              style={{
                textAlign: 'center',
                padding: '3rem',
                color: 'var(--color-text-muted)',
                border: '2px dashed var(--color-border)',
                backgroundColor: 'transparent',
                minHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              {searchInitiated ? (
                <div>
                  <AlertTriangle size={48} color="var(--color-warning)" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ color: 'var(--color-text)', marginBottom: '0.5rem' }}>Cliente não localizado</h3>
                  <p style={{ marginBottom: '1.5rem', maxWidth: '400px' }}>
                    O CPF <strong>{cpf}</strong> não foi encontrado em nossa base de dados.
                  </p>
                  <Link href="/clientes/novo" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UserPlus size={18} /> Cadastrar Novo Cliente
                  </Link>
                </div>
              ) : (
                <p>Informe o CPF acima e clique na lupa para carregar todos os contratos do cliente.</p>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Sum Modal */}
      {sumModalData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
          }}
        >
          <div className="card animate-scale-up" style={{ width: '100%', maxWidth: '600px', padding: '0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Calculator className="text-primary" /> Valores Líquidos a Receber
              </h3>
              <button onClick={() => setSumModalData(null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Cliente</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', textTransform: 'uppercase' }}>{sumModalData.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>CPF: {sumModalData.cpf}</div>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-body)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)' }}>Operação</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)' }}>Contrato</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>Valor Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sumModalData.vendas.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          Nenhuma venda em aberto encontrada para este cliente.
                        </td>
                      </tr>
                    ) : (
                      sumModalData.vendas.map((s, idx) => {
                        const val = parseNumericVal(s.abat);
                        return (
                          <tr key={s.id || idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <span className="badge badge-info">{s.operacao}</span>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{s.codigo_operacao || '-'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                              R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(79, 70, 229, 0.05)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-primary-light)'
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.9rem' }}>Total Líquido Aberto:</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                  R$ {sumModalData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--color-bg-body)' }}>
              <button onClick={() => setSumModalData(null)} className="btn btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

