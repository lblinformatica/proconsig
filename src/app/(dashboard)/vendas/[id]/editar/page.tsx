'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, CheckCircle2, Search, AlertTriangle, UserPlus, Info, ListFilter, Calculator, User, Building, Loader2, Landmark, Wallet, LayoutGrid } from 'lucide-react';
import { validateCPF, formatCPF, formatAgencia } from '@/lib/cpf';
import { ConfirmModal } from '@/components/ConfirmModal';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fs = { display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.85rem' } as const;
const ls = {
  fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)',
  marginBottom: '1.25rem', display: 'block', width: '100%',
  borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem'
} as const;
const readonlyStyle = {
  background: 'var(--color-bg-body)',
  color: 'var(--color-text-muted)',
  cursor: 'default',
  width: '100%'
} as const;

const getPrazoByCoef = (coef: number): number | string => {
  if (coef >= 1.170 && coef <= 1.190) return 1;
  if (coef >= 0.531 && coef <= 0.635) return 3;
  if (coef >= 0.366 && coef <= 0.399) return 4;
  if (coef >= 0.320 && coef <= 0.341) return 6;
  if (coef >= 0.260 && coef <= 0.295) return 8;
  if (coef >= 0.189 && coef <= 0.205) return 12;
  if (coef >= 0.149 && coef <= 0.165) return 15;
  return '';
};
export default function EditarVenda(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();

  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateModal, setDuplicateModal] = useState(false);
  const [alertModal, setAlertModal] = useState<{ show: boolean, title: string, message: string }>({ show: false, title: '', message: '' });
  const [vendedores, setVendedores] = useState<any[]>([]);

  useEffect(() => {
    const fetchVendedores = async () => {
      const { data } = await supabase
        .schema('pro_consig')
        .from('vendedores')
        .select('codigo, nome')
        .order('codigo', { ascending: true });
      if (data) setVendedores(data);
    };
    fetchVendedores();
  }, []);

  const [cpf, setCpf] = useState('');
  const [clientFound, setClientFound] = useState<any>(null);
  const [searchInitiated, setSearchInitiated] = useState(false);
  const [operacoesDisponiveis, setOperacoesDisponiveis] = useState<any[]>([]);
  const [selectedOpIds, setSelectedOpIds] = useState<number[]>([]);
  const [baixasCliente, setBaixasCliente] = useState<any[]>([]);
  const [lastAutoObs, setLastAutoObs] = useState('');
  const [originalSaldoDb, setOriginalSaldoDb] = useState<number | null>(null);
  const [vendaCodigo, setVendaCodigo] = useState<string>('');
  const [isVendaPaga, setIsVendaPaga] = useState(false);

  const [form, setForm] = useState({
    orgao: '', empresa: '', operacao: 'REFIN', codigo_operacao: '', corretor: '', carteira: '',
    valor: '', saldo: '', valor_liquido: '', coef: '', parcela: '', prazo: '',
    banco: '', agencia: '', agencia_dv: '', op: '', conta: '', conta_dv: '', tipo_conta: 'corrente',
    contrato: '', empresa_ativacao: '', conta_ativacao: '',
    inicio_mes: '', inicio_ano: new Date().getFullYear().toString(),
    dia_util: '', empresa_credora: '', observacao: '',
    forma_credito: 'conta', pix_tipo_chave: '', pix_chave: '',
    credito_banco: '', credito_agencia: '', credito_agencia_dv: '',
    credito_conta: '', credito_conta_dv: '', credito_tipo_conta: 'corrente',
    novo_cliente: '',
    atualizacao_cadastral: ''
  });

  const showAlert = (title: string, message: string) => {
    setAlertModal({ show: true, title, message });
  };

  const resetScreen = () => {
    setClientFound(null);
    setSearchInitiated(false);
    setOperacoesDisponiveis([]);
    setSelectedOpIds([]);
    setForm(f => ({
      ...f,
      orgao: '', empresa: '', codigo_operacao: '', carteira: '',
      valor: '', saldo: '', valor_liquido: '', coef: '', parcela: '', prazo: '',
      banco: '', agencia: '', agencia_dv: '', op: '', conta: '', conta_dv: '',
      contrato: '', empresa_ativacao: '', conta_ativacao: '',
      inicio_mes: '', dia_util: '', empresa_credora: '', observacao: '',
      forma_credito: 'conta', pix_tipo_chave: '', pix_chave: '',
      credito_banco: '', credito_agencia: '', credito_agencia_dv: '',
      credito_conta: '', credito_conta_dv: '',
      novo_cliente: '',
      atualizacao_cadastral: ''
    }));
  };

  // Carregamento inicial
  useEffect(() => {
    const fetchVenda = async () => {
      try {
        const { data: venda, error: vError } = await supabase.schema('pro_consig').from('vendas').select('*').eq('id', params.id).single();
        if (vError) throw vError;

        if (venda) {
          if (venda.status?.toLowerCase() === 'pago' || venda.status?.toLowerCase() === 'paga') {
            setIsVendaPaga(true);
          }
          setCpf(venda.cpf);
          setOriginalSaldoDb(venda.saldo || 0);
          setVendaCodigo(venda.venda_id || '');

          let mes = '', ano = new Date().getFullYear().toString();
          if (venda.inicio) {
            const d = new Date(venda.inicio);
            mes = (d.getUTCMonth() + 1).toString().padStart(2, '0');
            ano = d.getUTCFullYear().toString();
          }

          setForm({
            orgao: venda.orgao || '',
            empresa: venda.empresa || '',
            operacao: venda.operacao || 'REFIN',
            codigo_operacao: venda.codigo_operacao || '',
            corretor: venda.corretor || '',
            carteira: venda.carteira || '',
            valor: venda.valor ? venda.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
            saldo: venda.saldo ? venda.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
            valor_liquido: venda.abat ? venda.abat.toString().replace('.', ',') : '',
            parcela: venda.parcela ? venda.parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
            coef: venda.coef ? venda.coef.toFixed(3).replace('.', ',') : '',
            prazo: venda.prazo ? venda.prazo.toString() : '',
            banco: venda.banco || '',
            agencia: formatAgencia(venda.agencia),
            agencia_dv: venda.agencia_dv || '',
            op: venda.op || '',
            conta: venda.conta || '',
            conta_dv: venda.conta_dv || '',
            tipo_conta: venda.tipo_conta || 'corrente',
            contrato: venda.contrato || '',
            empresa_ativacao: venda.empresa_ativacao || '',
            conta_ativacao: venda.conta_ativacao || '',
            inicio_mes: mes,
            inicio_ano: ano,
            dia_util: venda.dia_util || '',
            empresa_credora: venda.empresa_credora || '',
            observacao: venda.observacao || '',
            forma_credito: venda.forma_credito || 'conta',
            pix_tipo_chave: venda.pix_tipo_chave || '',
            pix_chave: venda.pix_chave || '',
            credito_banco: venda.credito_banco || '',
            credito_agencia: formatAgencia(venda.credito_agencia),
            credito_agencia_dv: venda.credito_agencia_dv || '',
            credito_conta: venda.credito_conta || '',
            credito_conta_dv: venda.credito_conta_dv || '',
            credito_tipo_conta: venda.credito_tipo_conta || 'corrente',
            novo_cliente: venda.novo_cliente || '',
            atualizacao_cadastral: venda.atualizacao_cadastral || ''
          });

          // Carrega cliente e operações
          const { data: cliente } = await supabase.schema('pro_consig').from('clientes').select('*').eq('cpf', venda.cpf).single();
          if (cliente) {
            setClientFound(cliente);
            setSearchInitiated(true);
            const { data: ops } = await supabase.schema('pro_consig').from('operacoes').select('*').eq('cpf', venda.cpf);
            const { data: otherVendas } = await supabase.schema('pro_consig').from('vendas').select('contrato').eq('cpf', venda.cpf).neq('id', params.id);
            if (ops) {
              const soldElsewhere = new Set(otherVendas?.map(v => v.contrato) || []);
              setOperacoesDisponiveis(ops.filter(o => !soldElsewhere.has(o.operacao.toString())));
            }
          }
        }
      } catch (err: any) {
        setError('Erro ao carregar: ' + err.message);
      } finally {
        setFetching(false);
      }
    };
    fetchVenda();
  }, [params.id]);

  const buscarCliente = async () => {
    if (!validateCPF(cpf)) return showAlert('CPF Inválido', 'Informe um CPF válido.');
    setSearchLoading(true);
    setSearchInitiated(true);
    const formattedCpf = formatCPF(cpf);
    const rawCpf = formattedCpf.replace(/[^\d]/g, '');

    // Verificar Inadimplência
    const { data: inadimplente } = await supabase.schema('pro_consig').from('inadimplentes').select('id').eq('cpf', rawCpf).limit(1).maybeSingle();

    if (inadimplente) {
      setSearchLoading(false);
      return showAlert('Cliente com restritivo interno (Inadimplência)', 'Este CPF possui restrição interna e não é permitido prosseguir com a venda.');
    }

    // Buscar Baixas (Parcelas já pagas)
    const { data: baixas } = await supabase.schema('pro_consig').from('baixas').select('*').eq('cpf', rawCpf);
    setBaixasCliente(baixas || []);

    const { data: cliente } = await supabase.schema('pro_consig').from('clientes').select('*').eq('cpf', formattedCpf).single();
    if (cliente) {
      setClientFound(cliente);
      const { data: ops } = await supabase.schema('pro_consig').from('operacoes').select('*').eq('cpf', formattedCpf);
      const { data: existingVendas } = await supabase.schema('pro_consig').from('vendas').select('contrato').eq('cpf', formattedCpf).neq('id', params.id);
      if (ops) {
        const sold = new Set(existingVendas?.map(v => v.contrato) || []);
        setOperacoesDisponiveis(ops.filter(o => !sold.has(o.operacao.toString())));
      }
    } else {
      setClientFound(null);
      setOperacoesDisponiveis([]);
    }
    setSearchLoading(false);
  };

  const codigosUnicos = useMemo(() => Array.from(new Set(operacoesDisponiveis.map(o => o.operacao.toString()))), [operacoesDisponiveis]);

  const parcelasExibidas = useMemo(() => {
    if (form.operacao !== 'REFIN' || !form.codigo_operacao) return [];
    return operacoesDisponiveis
      .filter(o => o.operacao.toString() === form.codigo_operacao)
      .filter(o => {
        // Identificar parcelas em aberto (não presentes na tabela de baixas)
        // Chave: CPF + OPERACAO + MES_ANO
        const isBaixada = baixasCliente.some(b => {
          const bMesAno = b.vencimento ? b.vencimento.substring(0, 7) : '';
          const oMesAno = o.vencimento ? o.vencimento.substring(0, 7) : '';
          return (
            b.cpf === o.cpf &&
            b.operacao === o.operacao.toString() &&
            bMesAno && oMesAno && bMesAno === oMesAno
          );
        });
        return !isBaixada;
      })
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
      .map((o, index) => {
        const hoje = new Date();
        const venc = new Date(o.vencimento);
        const diffTime = venc.getTime() - hoje.getTime();
        const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const rate = o.grupo === 2 ? 0.0022 : 0;
        const percDesconto = dias > 0 ? (dias * rate) : 0;
        const valorDesconto = o.valor * percDesconto;
        return {
          ...o, numParcela: index + 1, dias: dias > 0 ? dias : 0,
          percDesconto: (percDesconto * 100).toFixed(2),
          valorDesconto, valorComDesconto: o.valor - valorDesconto
        };
      });
  }, [form.operacao, form.codigo_operacao, operacoesDisponiveis]);

  const totaisRefin = useMemo(() => {
    const selecionadas = parcelasExibidas.filter(p => selectedOpIds.includes(p.id));
    const bruto = selecionadas.reduce((acc, curr) => acc + curr.valor, 0);
    const liquido = selecionadas.reduce((acc, curr) => acc + curr.valorComDesconto, 0);
    return { bruto, liquido, qtd: selecionadas.length, total: parcelasExibidas.length };
  }, [parcelasExibidas, selectedOpIds]);

  const isAllSelected = useMemo(() => parcelasExibidas.length > 0 && selectedOpIds.length === parcelasExibidas.length, [parcelasExibidas, selectedOpIds]);

  const handleSelectAll = () => {
    if (isAllSelected) setSelectedOpIds([]);
    else setSelectedOpIds(parcelasExibidas.map(p => p.id));
  };

  useEffect(() => {
    // Quando o CPF muda, reseta a operação e campos dependentes
    setForm(f => ({
      ...f,
      codigo_operacao: '',
      contrato: '',
      valor: '',
      parcela: '',
      coef: '',
      prazo: '',
      empresa_ativacao: '',
      conta_ativacao: '',
      empresa_credora: ''
    }));
  }, [cpf]);

  useEffect(() => {
    if (form.operacao === 'REFIN') {
      const valorParaSaldo = selectedOpIds.length > 0 ? totaisRefin.liquido : parcelasExibidas.reduce((acc, curr) => acc + curr.valorComDesconto, 0);

      if (valorParaSaldo > 0) {
        setForm(f => ({ ...f, saldo: valorParaSaldo.toFixed(2).replace('.', ',') }));
      }
    }
  }, [totaisRefin.liquido, form.operacao, parcelasExibidas, selectedOpIds.length]);

  useEffect(() => {
    if (form.operacao === 'REFIN' && form.codigo_operacao) {
      setForm(f => ({ ...f, contrato: f.codigo_operacao }));

      const opSelecionada = operacoesDisponiveis.find(o => o.operacao.toString() === form.codigo_operacao);
      if (opSelecionada) {
        const valorContratoRaw = String(opSelecionada.contrato || '0').replace(/[^\d.,]/g, '').replace(',', '.');
        const valorContratoNum = parseFloat(valorContratoRaw) || 0;

        setForm(f => ({
          ...f,
          valor: valorContratoNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          parcela: opSelecionada.parcela_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          coef: (opSelecionada.coef || 0).toFixed(3).replace('.', ',')
        }));

        const fetchContas = async () => {
          try {
            const { data: allContas } = await supabase.schema('pro_consig').from('contas').select('*');
            const contaData = allContas?.find(c =>
              Number(c.grupo) === Number(opSelecionada.grupo) &&
              Number(c.conta_ativacao) === Number(opSelecionada.contacobranca)
            );

            if (contaData) {
              setForm(f => ({
                ...f,
                empresa_ativacao: contaData.empresa_ativacao || '',
                conta_ativacao: String(contaData.conta_ativacao),
                empresa_credora: contaData.empresa_credora || ''
              }));
            } else {
              setForm(f => ({ ...f, conta_ativacao: opSelecionada.contacobranca || '' }));
            }
          } catch (e) {
            console.error('Erro ao buscar contas:', e);
          }
        };
        fetchContas();
      } else {
        setForm(f => ({
          ...f,
          contrato: '',
          valor: '',
          parcela: '',
          coef: '',
          empresa_ativacao: '',
          conta_ativacao: '',
          empresa_credora: ''
        }));
      }
    } else {
      setForm(f => ({
        ...f,
        contrato: '',
        empresa_ativacao: '',
        conta_ativacao: '',
        empresa_credora: ''
      }));
    }
  }, [form.operacao, form.codigo_operacao, operacoesDisponiveis]);

  useEffect(() => {
    if (form.operacao === 'REFIN' && selectedOpIds.length > 0) {
      const selecionadas = parcelasExibidas.filter(p => selectedOpIds.includes(p.id));
      if (selecionadas.length > 0) {
        const maisAntiga = [...selecionadas].sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())[0];
        const dataVenc = new Date(maisAntiga.vencimento + 'T12:00:00');
        const mes = (dataVenc.getMonth() + 1).toString().padStart(2, '0');
        const ano = dataVenc.getFullYear().toString();

        setForm(f => ({
          ...f,
          inicio_mes: mes,
          inicio_ano: ano
        }));
      }
    }
  }, [selectedOpIds, parcelasExibidas, form.operacao]);

  useEffect(() => {
    const parts = [];
    if (form.empresa_ativacao) {
      parts.push(`ATIVAÇÃO ${form.empresa_ativacao.trim().toUpperCase()}`);
    }
    const MONTH_NAMES: { [key: string]: string } = {
      '01': 'JANEIRO', '02': 'FEVEREIRO', '03': 'MARÇO', '04': 'ABRIL',
      '05': 'MAIO', '06': 'JUNHO', '07': 'JULHO', '08': 'AGOSTO',
      '09': 'SETEMBRO', '10': 'OUTUBRO', '11': 'NOVEMBRO', '12': 'DEZEMBRO'
    };
    const mesNome = form.inicio_mes ? (MONTH_NAMES[form.inicio_mes] || '') : '';
    if (mesNome && form.inicio_ano) {
      parts.push(`INICIO ${mesNome}/${form.inicio_ano}`);
    }
    if (form.operacao === 'REFIN') {
      const restamVal = parcelasExibidas.length;
      const abatidasVal = selectedOpIds.length;
      parts.push(`RESTAM ${restamVal} ABATIDAS ${abatidasVal}`);
    }
    if (form.dia_util) {
      let du = form.dia_util.trim();
      if (!du.includes('°') && !du.includes('º')) {
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
    form.empresa_ativacao,
    form.inicio_mes,
    form.inicio_ano,
    form.operacao,
    form.dia_util,
    parcelasExibidas.length,
    selectedOpIds.length,
    lastAutoObs,
    form.observacao
  ]);

  const buscarEmpresasPorConta = async (conta: string) => {
    if (!conta) return;
    try {
      const opSelecionada = operacoesDisponiveis.find(o => o.operacao.toString() === form.codigo_operacao);
      const grupo = opSelecionada?.grupo;

      let query = supabase.schema('pro_consig').from('contas').select('*').eq('conta_ativacao', conta);

      if (grupo) {
        query = query.eq('grupo', grupo);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        const record = data[0];
        setForm(f => ({
          ...f,
          empresa_ativacao: record.empresa_ativacao || f.empresa_ativacao,
          empresa_credora: record.empresa_credora || f.empresa_credora
        }));
      }
    } catch (e) {
      console.error('Erro ao buscar empresas por conta:', e);
    }
  };

  // Mensagem de Aviso para Operação sem parcelas
  const opSemParcelas = useMemo(() => {
    if (form.operacao !== 'REFIN' || !form.codigo_operacao) return false;
    const op = operacoesDisponiveis.find(o => String(o.operacao) === form.codigo_operacao);

    // NOVA ESTRATÉGIA: Se o n° parcela for 0, não tem parcelas
    return op && (op.num_parcela === 0 || op.num_parcela === '0');
  }, [form.operacao, form.codigo_operacao, operacoesDisponiveis]);

  useEffect(() => {
    if (opSemParcelas) {
      setForm(f => ({ ...f, saldo: '0,00' }));
    }
  }, [opSemParcelas]);

  useEffect(() => {
    const v = parseFloat(form.valor.replace(/\./g, '').replace(',', '.')) || 0;
    const s = parseFloat(form.saldo.replace(/\./g, '').replace(',', '.')) || 0;

    if (v > 0 || s > 0) {
      setForm(f => ({ ...f, valor_liquido: (v - s).toFixed(2).replace('.', ',') }));
    }
  }, [form.valor, form.saldo]);

  useEffect(() => {
    const v = parseFloat(form.valor.replace(/\./g, '').replace(',', '.')) || 0;
    const p = parseFloat(form.parcela.replace(/\./g, '').replace(',', '.')) || 0;
    if (v > 0 && p > 0) {
      const rawCoef = p / v;
      const roundedCoef = Math.round(rawCoef * 1000) / 1000;
      const calculatedPrazo = getPrazoByCoef(roundedCoef);
      setForm(f => ({
        ...f,
        coef: roundedCoef.toFixed(3).replace('.', ','),
        prazo: calculatedPrazo.toString()
      }));
    }
  }, [form.valor, form.parcela]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'codigo_operacao') {
      if (!value) {
        setForm(f => ({
          ...f,
          codigo_operacao: '',
          contrato: '',
          corretor: '',
          carteira: ''
        }));
        return;
      }
      const opObj = operacoesDisponiveis.find(o => o.operacao.toString() === value);
      if (opObj) {
        const rawVendedorName = opObj.vendedor ? opObj.vendedor.trim().toUpperCase() : '';
        let matchingVendedor = '';
        if (rawVendedorName) {
          const foundVendedor = vendedores.find(v => {
            const formatted = `${v.codigo} - ${v.nome}`.toUpperCase();
            return v.nome.toUpperCase() === rawVendedorName || 
                   formatted === rawVendedorName || 
                   rawVendedorName.includes(v.nome.toUpperCase());
          });
          if (foundVendedor) {
            matchingVendedor = foundVendedor.codigo;
          }
        }
        setForm(f => ({
          ...f,
          codigo_operacao: value,
          contrato: opObj.contrato || value,
          corretor: matchingVendedor,
          carteira: matchingVendedor
        }));
        return;
      } else {
        setForm(f => ({
          ...f,
          codigo_operacao: value,
          corretor: '',
          carteira: ''
        }));
        return;
      }
    }

    if (name === 'operacao') {
      if (value === 'NOVO') {
        setForm(f => ({
          ...f,
          operacao: 'NOVO',
          codigo_operacao: '',
          contrato: '',
          valor: '',
          saldo: '0,00',
          valor_liquido: '',
          coef: '',
          parcela: '',
          prazo: '',
          empresa_ativacao: '',
          conta_ativacao: '',
          empresa_credora: '',
          inicio_mes: '',
          inicio_ano: new Date().getFullYear().toString(),
          dia_util: ''
        }));
        setSelectedOpIds([]);
      } else {
        setForm(f => ({
          ...f,
          operacao: value,
          codigo_operacao: '',
          contrato: '',
          valor: '',
          saldo: '',
          valor_liquido: '',
          coef: '',
          parcela: '',
          prazo: '',
          empresa_ativacao: '',
          conta_ativacao: '',
          empresa_credora: '',
          inicio_mes: '',
          inicio_ano: new Date().getFullYear().toString(),
          dia_util: ''
        }));
        setSelectedOpIds([]);
      }
      return;
    }

    // Campos financeiros (permitem números, ponto e vírgula)
    if (['valor', 'saldo', 'parcela', 'valor_liquido'].includes(name)) {
      const cleanValue = value.replace(/[^\d.,]/g, '');
      setForm(f => ({ ...f, [name]: cleanValue }));
      return;
    }

    // Campos numéricos puros (apenas dígitos)
    const numericFields = [
      'conta_ativacao', 'dia_util', 'inicio_ano', 'prazo',
      'agencia', 'agencia_dv', 'conta', 'conta_dv', 'op',
      'credito_agencia', 'credito_agencia_dv', 'credito_conta', 'credito_conta_dv'
    ];
    if (numericFields.includes(name)) {
      const cleanValue = value.replace(/\D/g, '');
      setForm(f => ({ ...f, [name]: cleanValue }));
      return;
    }

    // Convert value to uppercase for all text/input fields, preserving case for select dropdowns and emails
    const skipUppercaseFields = [
      'novo_cliente',
      'atualizacao_cadastral',
      'tipo_conta',
      'credito_tipo_conta',
      'forma_credito',
      'pix_tipo_chave',
      'inicio_mes'
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

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!value) return;
    let num = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(num)) setForm(f => ({ ...f, [name]: num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
  };

  const toggleOpSelection = (id: number) => setSelectedOpIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVendaPaga) {
      return showAlert('Edição Bloqueada', 'Esta venda está paga e não pode ser editada.');
    }
    if (!clientFound) return showAlert('Atenção', 'Busque o cliente.');

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

    if (!form.prazo) return showAlert('Atenção', 'Prazo não identificado.');

    setLoading(true);
    setError('');

    try {
      // Valida duplicidade excluindo esta venda — Permitir duplicado quando for NOVO contrato (form.operacao === 'NOVO')
      if (form.operacao !== 'NOVO') {
        const { data: duplicate } = await supabase.schema('pro_consig').from('vendas').select('id').eq('cpf', formatCPF(cpf)).eq('contrato', form.contrato).neq('id', params.id).maybeSingle();
        if (duplicate) { setDuplicateModal(true); setLoading(false); return; }
      }

      const dataInicio = (form.inicio_mes && form.inicio_ano) ? `${form.inicio_ano}-${form.inicio_mes}-01` : null;

      const { error: updateError } = await supabase.schema('pro_consig').from('vendas').update({
        cpf: formatCPF(cpf),
        orgao: form.orgao, empresa: form.empresa, operacao: form.operacao,
        codigo_operacao: form.codigo_operacao, corretor: form.corretor,
        carteira: form.carteira,
        valor: parseFloat(form.valor.replace(/\./g, '').replace(',', '.')) || null,
        saldo: parseFloat(form.saldo.replace(/\./g, '').replace(',', '.')) || null,
        abat: form.valor_liquido,
        coef: parseFloat(form.coef.replace(/\./g, '').replace(',', '.')) || null,
        parcela: parseFloat(form.parcela.replace(/\./g, '').replace(',', '.')) || null,
        prazo: parseInt(form.prazo) || null,
        banco: form.banco, agencia: formatAgencia(form.agencia), agencia_dv: form.agencia_dv,
        op: form.op, conta: form.conta, conta_dv: form.conta_dv, tipo_conta: form.tipo_conta,
        contrato: form.contrato, empresa_ativacao: form.empresa_ativacao,
        conta_ativacao: form.conta_ativacao, inicio: dataInicio,
        dia_util: form.dia_util, empresa_credora: form.empresa_credora, observacao: form.observacao,
        forma_credito: form.forma_credito, pix_tipo_chave: form.pix_tipo_chave,
        pix_chave: form.pix_chave, credito_banco: form.credito_banco,
        credito_agencia: formatAgencia(form.credito_agencia), credito_agencia_dv: form.credito_agencia_dv,
        credito_conta: form.credito_conta, credito_conta_dv: form.credito_conta_dv,
        credito_tipo_conta: form.credito_tipo_conta,
        novo_cliente: form.novo_cliente,
        atualizacao_cadastral: form.atualizacao_cadastral,
        restam: form.operacao === 'REFIN' ? parcelasExibidas.length : null,
        abatidas: form.operacao === 'REFIN' ? selectedOpIds.length : null
      }).eq('id', params.id);

      if (updateError) throw updateError;

      // Gravando no histórico se o saldo digitado for diferente do original do banco
      const typedSaldo = parseFloat(form.saldo.replace(/\./g, '').replace(',', '.')) || 0;
      if (originalSaldoDb !== null && Math.abs(typedSaldo - originalSaldoDb) > 0.009) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: userData } = await supabase
            .from('usuarios')
            .select('id, nome')
            .eq('supabase_user_id', session.user.id)
            .single();

          if (userData) {
            await supabase
              .schema('pro_consig')
              .from('historico_saldos')
              .insert({
                venda_id: params.id,
                venda_codigo: vendaCodigo,
                usuario_id: userData.id,
                usuario_nome: userData.nome || 'Usuário',
                valor_original: originalSaldoDb,
                valor_novo: typedSaldo,
                tipo_operacao: 'Editar Venda'
              });
          }
        }
      }

      router.push('/vendas');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (fetching) return <div className="card" style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /> Carregando...</div>;

  if (isVendaPaga) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '3rem auto' }}>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', border: '1px solid var(--color-warning)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
            <AlertTriangle size={36} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-text-main)' }}>Venda Paga (Não Editável)</h2>
          <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.6', marginBottom: '2rem' }}>
            Esta venda (Código: <strong>{vendaCodigo}</strong>) já foi marcada como <strong>PAGA</strong>. Para garantir a integridade financeira e o controle dos borderôs gerados, vendas pagas não podem ser editadas ou excluídas.
          </p>
          <Link href="/vendas" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={18} /> Voltar para Vendas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmModal isOpen={alertModal.show} title={alertModal.title} message={alertModal.message} onConfirm={() => setAlertModal({ show: false, title: '', message: '' })} confirmText="Entendi" />
      <ConfirmModal isOpen={duplicateModal} title="Venda Duplicada" message="Já existe outra venda para este contrato." onConfirm={() => setDuplicateModal(false)} confirmText="Fechar" confirmType="danger" />

      <div className="animate-fade-in" style={{ maxWidth: '1050px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
          <Link href="/vendas" className="btn btn-secondary" style={{ padding: '0.5rem' }}><ArrowLeft size={20} /></Link>
          <h1 style={{ margin: 0 }}>Editar Venda</h1>
        </div>

        {error && (
          <div className="card animate-fade-in" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem' }}>
            <AlertTriangle size={24} />
            <div style={{ fontSize: '0.9rem' }}><strong>Erro:</strong> {error}</div>
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
              <button type="button" className="btn btn-secondary" style={{ marginTop: '1.5rem', padding: '0.65rem' }} onClick={buscarCliente} disabled={searchLoading}><Search size={20} /></button>
              {clientFound ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', marginTop: '1.5rem' }}>
                  <CheckCircle2 size={20} /> <strong>{clientFound.nome}</strong>
                </div>
              ) : null}
            </div>
          </div>

          {searchLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem' }}><Loader2 size={40} className="animate-spin" style={{ color: 'var(--color-primary)', margin: '0 auto' }} /><p>Buscando dados...</p></div>
          ) : clientFound ? (
            <div className="animate-fade-in">
              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}>Dados Institucionais e Operação</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
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
                  <div><label style={fs}>Empresa</label><input name="empresa" type="text" value={form.empresa} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Operação</label><select name="operacao" value={form.operacao} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem' }}><option value="REFIN">REFIN</option><option value="NOVO">NOVO</option><option value="COMPRA">COMPRA</option></select></div>
                  <div>
                    <label style={fs}>Operação</label>
                    {form.operacao === 'REFIN' && codigosUnicos.length > 0 ? (
                      <select name="codigo_operacao" value={form.codigo_operacao} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem' }}>
                        <option value="">Selecione...</option>
                        {codigosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input
                        name="codigo_operacao"
                        type="text"
                        value={form.codigo_operacao}
                        onChange={handleChange}
                        required={form.operacao !== 'NOVO'}
                        disabled={form.operacao === 'NOVO'}
                        style={{ width: '100%', padding: '0.5rem', ...(form.operacao === 'NOVO' ? readonlyStyle : {}) }}
                      />
                    )}
                  </div>
                  <div>
                    <label style={fs}>Vendedor</label>
                    <select name="corretor" value={form.corretor} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem' }}>
                      <option value="">Selecione...</option>
                      {vendedores.filter(v => v.ativo !== false || v.codigo === form.corretor).map(v => {
                        const formatted = `${v.codigo} - ${v.nome}`;
                        return <option key={v.codigo} value={v.codigo}>{formatted}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={fs}>Carteira</label>
                    <select name="carteira" value={form.carteira} onChange={handleChange} style={{ width: '100%', padding: '0.5rem' }}>
                      <option value="">Selecione...</option>
                      {vendedores.filter(v => v.ativo !== false || v.codigo === form.carteira).map(v => {
                        const formatted = `${v.codigo} - ${v.nome}`;
                        return <option key={v.codigo} value={v.codigo}>{formatted}</option>;
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
                    <select name="atualizacao_cadastral" value={form.atualizacao_cadastral} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem' }}>
                      <option value="">Selecione...</option>
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* GRID REFIN */}
              {form.operacao === 'REFIN' && form.codigo_operacao ? (
                <div className="card animate-fade-in" style={{ marginBottom: '1rem', border: '1px solid var(--color-primary-light)', backgroundColor: 'rgba(79, 70, 229, 0.01)' }}>
                  <legend style={ls}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ListFilter size={18} /> Detalhes da Operação {form.codigo_operacao}</div></legend>

                  {opSemParcelas ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={20} /> Esta operação não possui parcelas pendentes (Parcela Zero).
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="table-wrapper" style={{ border: '1px solid var(--color-border)' }}>
                        <table className="table table-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                          <thead>
                            <tr>
                              <th style={{ width: '44px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center', padding: '0.5rem' }}>
                                <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} style={{ cursor: 'pointer', verticalAlign: 'middle' }} />
                              </th>
                              <th style={{ width: '60px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>Parcela</th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>Vencimento</th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>Valor (R$)</th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>Dias</th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>% Desconto</th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>Desconto (R$)</th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>Líquido (R$)</th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>Grupo</th>
                            </tr>
                          </thead>
                          <tbody style={{ fontSize: '0.8125rem' }}>
                            {parcelasExibidas.length > 0 ? (
                              parcelasExibidas.map(p => (
                                <tr key={p.id} onClick={() => toggleOpSelection(p.id)} style={{ cursor: 'pointer', backgroundColor: selectedOpIds.includes(p.id) ? 'rgba(79, 70, 229, 0.06)' : 'transparent' }}>
                                  <td style={{ padding: '0.4rem 0.5rem', width: '44px', textAlign: 'center' }}>
                                    <input type="checkbox" checked={selectedOpIds.includes(p.id)} readOnly style={{ verticalAlign: 'middle' }} />
                                  </td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-muted)' }}>{p.numParcela}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>{new Date(p.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>{p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>{p.dias}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: 'var(--color-danger)' }}>{p.percDesconto}%</td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--color-danger)' }}>- {p.valorDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>{p.valorComDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>{p.grupo}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <AlertTriangle size={18} /> Não constam parcelas para esta operação no banco de dados.
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                        <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Parcelas</span><div style={{ fontSize: '1rem', fontWeight: 700 }}>{totaisRefin.total}</div></div>
                        <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Selecionadas</span><div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>{totaisRefin.qtd}</div></div>
                        <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Saldo Bruto</span><div style={{ fontSize: '1rem', fontWeight: 700 }}>R$ {totaisRefin.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
                        <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Saldo Líquido</span><div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-success)' }}>R$ {totaisRefin.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}>Valores e Condições</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
                  <div><label style={fs}>Contrato (R$)</label><input name="valor" type="text" value={form.valor} onChange={handleChange} onBlur={handleBlur} required style={{ width: '100%', fontWeight: 700, color: 'var(--color-primary)' }} /></div>
                  <div>
                    <label style={fs}>Saldo (R$)</label>
                    <input
                      name="saldo"
                      type="text"
                      value={form.saldo}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      disabled={form.operacao === 'NOVO'}
                      style={{ width: '100%', ...(form.operacao === 'NOVO' ? readonlyStyle : {}) }}
                    />
                  </div>
                  <div><label style={fs}>Líquido (R$)</label><input name="valor_liquido" type="text" value={form.valor_liquido} onChange={handleChange} onBlur={handleBlur} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Parcela (R$)</label><input name="parcela" type="text" value={form.parcela} onChange={handleChange} onBlur={handleBlur} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Coeficiente</label><input name="coef" type="text" value={form.coef} readOnly style={readonlyStyle} /></div>
                  <div><label style={fs}>Prazo</label><input name="prazo" type="text" value={form.prazo} readOnly style={readonlyStyle} /></div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}><Landmark size={18} /> Dados Bancários (Débito)</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 180px 100px 60px 120px 60px 60px', gap: '1rem' }}>
                  <div><label style={fs}>Banco</label><input name="banco" type="text" value={form.banco} onChange={handleChange} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Tipo Conta</label><select name="tipo_conta" value={form.tipo_conta} onChange={handleChange} style={{ width: '100%' }}><option value="corrente">Corrente</option><option value="poupanca">Poupança</option></select></div>
                  <div><label style={fs}>Agência</label><input name="agencia" type="text" value={form.agencia} onChange={handleChange} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>DV</label><input name="agencia_dv" type="text" value={form.agencia_dv} onChange={handleChange} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Conta</label><input name="conta" type="text" value={form.conta} onChange={handleChange} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>DV</label><input name="conta_dv" type="text" value={form.conta_dv} onChange={handleChange} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>OP</label><input name="op" type="text" value={form.op} onChange={handleChange} style={{ width: '100%' }} /></div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}><Wallet size={18} /> Dados Para Crédito (Recebimento)</legend>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={fs}>Forma de Recebimento</label>
                  <select name="forma_credito" value={form.forma_credito} onChange={handleChange} style={{ width: '300px' }}>
                    <option value="conta">Crédito em Conta</option>
                    <option value="pix">PIX</option>
                    <option value="ordem">Ordem de Pagamento</option>
                  </select>
                </div>
                {form.forma_credito === 'conta' && (
                  <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '120px 180px 100px 60px 120px 60px', gap: '1rem' }}>
                    <div><label style={fs}>Banco</label><input name="credito_banco" type="text" value={form.credito_banco} onChange={handleChange} style={{ width: '100%' }} /></div>
                    <div><label style={fs}>Tipo Conta</label><select name="credito_tipo_conta" value={form.credito_tipo_conta} onChange={handleChange} style={{ width: '100%' }}><option value="corrente">Corrente</option><option value="poupanca">Poupança</option></select></div>
                    <div><label style={fs}>Agência</label><input name="credito_agencia" type="text" value={form.credito_agencia} onChange={handleChange} style={{ width: '100%' }} /></div>
                    <div><label style={fs}>DV</label><input name="credito_agencia_dv" type="text" value={form.credito_agencia_dv} onChange={handleChange} style={{ width: '100%' }} /></div>
                    <div><label style={fs}>Conta</label><input name="credito_conta" type="text" value={form.credito_conta} onChange={handleChange} style={{ width: '100%' }} /></div>
                    <div><label style={fs}>DV</label><input name="credito_conta_dv" type="text" value={form.credito_conta_dv} onChange={handleChange} style={{ width: '100%' }} /></div>
                  </div>
                )}
                {form.forma_credito === 'pix' && (
                  <div className="animate-fade-in" style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ width: '200px' }}><label style={fs}>Tipo de Chave</label><select name="pix_tipo_chave" value={form.pix_tipo_chave} onChange={handleChange} style={{ width: '100%' }}><option value="">Selecione...</option><option value="cpf">CPF</option><option value="celular">Celular</option><option value="email">E-mail</option><option value="aleatoria">Chave Aleatória</option></select></div>
                    <div style={{ flex: 1 }}><label style={fs}>Chave PIX</label><input name="pix_chave" type="text" value={form.pix_chave} onChange={handleChange} style={{ width: '100%' }} /></div>
                  </div>
                )}
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}>Ativação, Contrato e Lote</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div><label style={fs}>Nº do Contrato</label><input name="contrato" type="text" value={form.contrato} onChange={handleChange} disabled={form.operacao === 'REFIN' || form.operacao === 'NOVO'} required={form.operacao !== 'NOVO'} style={form.operacao === 'REFIN' || form.operacao === 'NOVO' ? readonlyStyle : { width: '100%' }} /></div>
                  <div><label style={fs}>Conta Ativação</label><input name="conta_ativacao" type="text" value={form.conta_ativacao} onChange={handleChange} onBlur={(e) => buscarEmpresasPorConta(e.target.value)} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Empresa Ativação</label><input name="empresa_ativacao" type="text" value={form.empresa_ativacao} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Dia Útil Adicional</label><input name="dia_util" type="text" value={form.dia_util} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Empresa Credora</label><input name="empresa_credora" type="text" value={form.empresa_credora} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}><label style={fs}>Mês</label><select name="inicio_mes" value={form.inicio_mes} onChange={handleChange} required style={{ width: '100%' }}><option value="">--</option>{['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div style={{ flex: 1.5 }}><label style={fs}>Ano</label><input name="inicio_ano" type="number" value={form.inicio_ano} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <legend style={ls}>Observações</legend>
                <textarea name="observacao" value={form.observacao} onChange={handleChange} rows={2} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '2rem' }}>
                <Link href="/vendas" className="btn btn-secondary">Cancelar</Link>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Alterações'}</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem' }}>Aguardando CPF...</div>
          )}
        </form>
      </div>
    </>
  );
}
