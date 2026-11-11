'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Search,
  Filter,
  Download,
  User,
  CheckCircle2,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  BarChart3,
  Layers,
  AlertCircle,
  Target
} from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

interface ContratoConfronto {
  operacao: string;
  cpf: string;
  nome_cliente: string;
  vendedor_original: string;
  vendedor_formatado: string;
  vendedor_codigo: string;
  convenio: string;
  valor_contrato: number;
  parcela_valor: number;
  qtd_parcelas: number;
  soma_parcelas: number;
  vencimento: string;
  vendido: boolean;
  venda_id?: string;
  data_venda?: string;
  status_venda?: string;
  valor_venda?: number;
  liquido_venda?: number;
}

interface ResumoVendedor {
  vendedor: string;
  total_contratos: number;
  vendidos: number;
  pendentes: number;
  perc_total_geral: number;
  perc_concluido: number;
  perc_pendente: number;
  valor_total: number;
  valor_pendente: number;
  valor_vendido: number;
}

const PAGE_SIZE = 30;

export default function RelatorioVendedorPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [contratos, setContratos] = useState<ContratoConfronto[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filters
  const [vendedorFilter, setVendedorFilter] = useState('todos');
  const [lockedVendedor, setLockedVendedor] = useState<string | null>(null);
  const [vendedorNomeSearch, setVendedorNomeSearch] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState<'pendentes' | 'vendidos' | 'todos'>('pendentes');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Modal Alert
  const [modalAlert, setModalAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'primary' | 'success';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'primary',
    confirmText: 'Entendi'
  });

  const parseNumeric = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    if (str.includes(',')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(str) || 0;
  };

  const fetchAllRows = async (table: string, selectCols: string) => {
    let allRows: any[] = [];
    let pageIdx = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .schema('pro_consig')
        .from(table)
        .select(selectCols)
        .range(pageIdx * batchSize, (pageIdx + 1) * batchSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allRows = [...allRows, ...data];
        if (data.length < batchSize) hasMore = false;
        else pageIdx++;
      } else {
        hasMore = false;
      }
    }
    return allRows;
  };

  const carregarConfronto = useCallback(async () => {
    setLoading(true);
    try {
      // 0. Buscar perfil do usuário logado para checar vendedor vinculado
      let userNivel = 'admin';
      let userVendedorVinculado = '';
      let userConta = '';
      let userNome = '';

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('nivel, vendedor_vinculado, conta, nome')
          .eq('supabase_user_id', session.user.id)
          .single();

        if (profile) {
          userNivel = profile.nivel || 'operacional';
          userVendedorVinculado = profile.vendedor_vinculado || '';
          userConta = profile.conta || '';
          userNome = profile.nome || '';
        }
      }

      // 1. Buscar vendedores
      const { data: vData } = await supabase
        .schema('pro_consig')
        .from('vendedores')
        .select('id, codigo, nome')
        .order('codigo', { ascending: true });

      const vendList = vData || [];
      setVendedores(vendList);

      const resolveVendedor = (rawVendedor: string) => {
        if (!rawVendedor) return { formatted: 'NÃO INFORMADO', codigo: '' };
        const clean = rawVendedor.trim().toUpperCase();
        const found = vendList.find((v: any) => {
          const formatted = `${v.codigo} - ${v.nome}`.trim().toUpperCase();
          return (
            formatted === clean ||
            v.nome.trim().toUpperCase() === clean ||
            v.codigo.trim().toUpperCase() === clean ||
            clean.includes(v.nome.trim().toUpperCase())
          );
        });
        if (found) {
          return { formatted: `${found.codigo} - ${found.nome}`, codigo: found.codigo };
        }
        return { formatted: clean, codigo: clean };
      };

      // 2. Buscar todas as metas e todas as vendas
      const [allMetas, allVendas] = await Promise.all([
        fetchAllRows(
          'metas',
          'operacao, vencimento, cpf, nome_cliente, vendedor, contrato, restam, parcela_valor, cod_fundo, convenio, saldo'
        ),
        fetchAllRows(
          'vendas',
          'id, venda_id, cpf, codigo_operacao, contrato, operacao, corretor, valor, abat, status, created_at'
        )
      ]);

      // 3. Mapear vendas por número de operação/contrato
      const vendasMap = new Map<string, any>();
      allVendas.forEach((v: any) => {
        const codOp = v.codigo_operacao ? String(v.codigo_operacao).trim() : '';
        const numContrato = v.contrato ? String(v.contrato).trim() : '';
        if (codOp) vendasMap.set(codOp, v);
        if (numContrato && !vendasMap.has(numContrato)) vendasMap.set(numContrato, v);
      });

      // 4. Construir lista confrontada (1 registro por operação em metas)
      const resultado: ContratoConfronto[] = [];

      allMetas.forEach((m: any) => {
        if (!m.operacao) return;
        const opKey = String(m.operacao).trim();
        const vendResolved = resolveVendedor(m.vendedor || '');

        const qtdParcelas = Number(m.restam) || 0;
        const somaParcelas = parseNumeric(m.saldo);
        const valorContrato = parseNumeric(m.contrato);
        const parcelaValor = parseNumeric(m.parcela_valor);
        const vendaMatch = vendasMap.get(opKey);

        resultado.push({
          operacao: opKey,
          cpf: m.cpf || '-',
          nome_cliente: m.nome_cliente || '-',
          vendedor_original: m.vendedor || '-',
          vendedor_formatado: vendResolved.formatted,
          vendedor_codigo: vendResolved.codigo,
          convenio: m.cod_fundo ? String(m.cod_fundo).trim() : (m.convenio ? String(m.convenio).trim() : '-'),
          valor_contrato: valorContrato,
          parcela_valor: parcelaValor,
          qtd_parcelas: qtdParcelas,
          soma_parcelas: somaParcelas,
          vencimento: m.vencimento || '',
          vendido: !!vendaMatch,
          venda_id: vendaMatch?.venda_id || undefined,
          data_venda: vendaMatch?.created_at || undefined,
          status_venda: vendaMatch?.status || undefined,
          valor_venda: vendaMatch ? parseNumeric(vendaMatch.valor) : undefined,
          liquido_venda: vendaMatch ? parseNumeric(vendaMatch.abat) : undefined
        });
      });

      // Ordenar por vendedor e depois por operação
      resultado.sort((a, b) => {
        const cmpVend = a.vendedor_formatado.localeCompare(b.vendedor_formatado);
        if (cmpVend !== 0) return cmpVend;
        return Number(b.operacao) - Number(a.operacao);
      });

      // Filtrar pelo vendedor vinculado caso o usuário não seja admin
      let resultadoFinal = resultado;
      if (userNivel !== 'admin') {
        if (userVendedorVinculado) {
          const codTarget = userVendedorVinculado.trim().toUpperCase();
          const vendObj = vendList.find((v: any) => v.codigo.trim().toUpperCase() === codTarget);
          const formattedTarget = vendObj ? `${vendObj.codigo} - ${vendObj.nome}` : codTarget;
          setLockedVendedor(formattedTarget);
          setVendedorFilter(formattedTarget);
          resultadoFinal = resultado.filter(
            item => item.vendedor_codigo.trim().toUpperCase() === codTarget
          );
        } else if (userNivel === 'vendedor') {
          resultadoFinal = resultado.filter(
            item =>
              item.vendedor_codigo.trim().toUpperCase() === userConta.trim().toUpperCase() ||
              item.vendedor_formatado.toUpperCase().includes(userNome.trim().toUpperCase())
          );
          const matchedVend =
            resultadoFinal[0]?.vendedor_formatado ||
            (() => {
              const vObj = vendList.find(
                (v: any) =>
                  v.codigo.trim().toUpperCase() === userConta.trim().toUpperCase() ||
                  v.nome.trim().toUpperCase() === userNome.trim().toUpperCase()
              );
              return vObj ? `${vObj.codigo} - ${vObj.nome}` : '';
            })();
          if (matchedVend) {
            setLockedVendedor(matchedVend);
            setVendedorFilter(matchedVend);
          }
        }
      } else {
        setLockedVendedor(null);
      }

      setContratos(resultadoFinal);
    } catch (err: any) {
      console.error('Erro ao confrontar operações e vendas:', err);
      setModalAlert({
        isOpen: true,
        title: 'Erro ao carregar relatório',
        message: err.message || 'Não foi possível carregar os dados de confronto.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarConfronto();
  }, [carregarConfronto]);

  // Lista única de vendedores presentes nas operações
  const vendedoresUnicos = useMemo(() => {
    const sets = new Set<string>();
    if (lockedVendedor) sets.add(lockedVendedor);
    contratos.forEach(c => {
      if (c.vendedor_formatado) sets.add(c.vendedor_formatado);
    });
    return Array.from(sets).sort((a, b) => a.localeCompare(b));
  }, [contratos, lockedVendedor]);

  // Filtragem principal (sem o filtro de situação para calcular os cards de resumo do vendedor selecionado)
  const contratosBaseFiltrados = useMemo(() => {
    return contratos.filter(c => {
      if (vendedorFilter !== 'todos' && c.vendedor_formatado !== vendedorFilter) return false;
      if (vendedorNomeSearch.trim() && !c.vendedor_formatado.toLowerCase().includes(vendedorNomeSearch.trim().toLowerCase())) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const matchOp = c.operacao.toLowerCase().includes(term);
        const matchCpf = c.cpf.toLowerCase().includes(term) || c.cpf.replace(/\D/g, '').includes(term);
        const matchNome = c.nome_cliente.toLowerCase().includes(term);
        const matchConv = c.convenio.toLowerCase().includes(term);
        if (!matchOp && !matchCpf && !matchNome && !matchConv) return false;
      }
      return true;
    });
  }, [contratos, vendedorFilter, vendedorNomeSearch, search]);

  // Totais gerais dos cards
  const kpis = useMemo(() => {
    const total = contratosBaseFiltrados.length;
    const vendidos = contratosBaseFiltrados.filter(c => c.vendido).length;
    const pendentes = total - vendidos;
    const percVendido = total > 0 ? (vendidos / total) * 100 : 0;
    const somaSaldoPendente = contratosBaseFiltrados
      .filter(c => !c.vendido)
      .reduce((acc, c) => acc + c.soma_parcelas, 0);

    return { total, vendidos, pendentes, percVendido, somaSaldoPendente };
  }, [contratosBaseFiltrados]);

  // Resumo agrupado por Vendedor
  const resumoPorVendedor = useMemo<ResumoVendedor[]>(() => {
    const map = new Map<string, ResumoVendedor>();
    let totalGeralContratos = 0;

    contratos.forEach(c => {
      totalGeralContratos += 1;
      const key = c.vendedor_formatado;
      if (!map.has(key)) {
        map.set(key, {
          vendedor: key,
          total_contratos: 0,
          vendidos: 0,
          pendentes: 0,
          perc_total_geral: 0,
          perc_concluido: 0,
          perc_pendente: 0,
          valor_total: 0,
          valor_pendente: 0,
          valor_vendido: 0
        });
      }
      const item = map.get(key)!;
      item.total_contratos += 1;
      item.valor_total += c.soma_parcelas;
      if (c.vendido) {
        item.vendidos += 1;
        item.valor_vendido += c.valor_venda || c.valor_contrato;
      } else {
        item.pendentes += 1;
        item.valor_pendente += c.soma_parcelas;
      }
    });

    const list = Array.from(map.values()).map(item => ({
      ...item,
      perc_total_geral: totalGeralContratos > 0 ? (item.total_contratos / totalGeralContratos) * 100 : 0,
      perc_concluido: item.total_contratos > 0 ? (item.vendidos / item.total_contratos) * 100 : 0,
      perc_pendente: item.total_contratos > 0 ? (item.pendentes / item.total_contratos) * 100 : 0
    }));

    const filteredList = vendedorNomeSearch.trim()
      ? list.filter(item => item.vendedor.toLowerCase().includes(vendedorNomeSearch.trim().toLowerCase()))
      : list;

    return filteredList.sort((a, b) => a.vendedor.localeCompare(b.vendedor));
  }, [contratos, vendedorNomeSearch]);

  // Lista final aplicando o filtro de Situação (Falta Vender / Já Vendidos / Todos)
  const contratosExibidos = useMemo(() => {
    return contratosBaseFiltrados.filter(c => {
      if (situacaoFilter === 'pendentes') return !c.vendido;
      if (situacaoFilter === 'vendidos') return c.vendido;
      return true;
    });
  }, [contratosBaseFiltrados, situacaoFilter]);

  // Resetar página quando filtros mudam
  useEffect(() => {
    setPage(0);
  }, [vendedorFilter, vendedorNomeSearch, situacaoFilter, search]);

  const paginatedContratos = useMemo(() => {
    const start = page * PAGE_SIZE;
    return contratosExibidos.slice(start, start + PAGE_SIZE);
  }, [contratosExibidos, page]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    setModalAlert({
      isOpen: true,
      title: 'Copiado',
      message: 'CPF copiado para a área de transferência!',
      type: 'success',
      confirmText: 'OK'
    });
  };

  // Exportação para Excel
  const handleExportExcel = async () => {
    if (contratosExibidos.length === 0) {
      setModalAlert({
        isOpen: true,
        title: 'Atenção',
        message: 'Não há registros nos filtros atuais para exportar.'
      });
      return;
    }

    setExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();

      // ABA 1: Resumo por Vendedor
      const wsResumo = workbook.addWorksheet('Resumo por Vendedor');
      wsResumo.columns = [
        { header: 'Vendedor', key: 'vendedor', width: 28 },
        { header: 'Total de Contratos', key: 'total', width: 20 },
        { header: 'Já Vendidos', key: 'vendidos', width: 16 },
        { header: 'Falta Vender (Pendentes)', key: 'pendentes', width: 24 },
        { header: '% Atingido', key: 'perc', width: 15 },
        { header: 'Saldo Parcelas Pendentes (R$)', key: 'saldo_pendente', width: 28 }
      ];

      const headerResumo = wsResumo.getRow(1);
      headerResumo.font = { bold: true };
      headerResumo.alignment = { vertical: 'middle', horizontal: 'center' };

      resumoPorVendedor.forEach(r => {
        const row = wsResumo.addRow({
          vendedor: r.vendedor,
          total: r.total_contratos,
          vendidos: r.vendidos,
          pendentes: r.pendentes,
          perc: `${r.perc_concluido.toFixed(1).replace('.', ',')}%`,
          saldo_pendente: r.valor_pendente
        });
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).numFmt = '#,##0.00';
      });

      // ABA 2: Contratos Detalhados (Confronto)
      const abaTitulo =
        situacaoFilter === 'pendentes'
          ? 'Falta Vender'
          : situacaoFilter === 'vendidos'
            ? 'Contratos Vendidos'
            : 'Todos os Contratos';

      const wsDetalhe = workbook.addWorksheet(abaTitulo);
      wsDetalhe.columns = [
        { header: 'Situação', key: 'situacao', width: 18 },
        { header: 'Vendedor', key: 'vendedor', width: 24 },
        { header: 'Operação / Contrato', key: 'operacao', width: 20 },
        { header: 'CPF', key: 'cpf', width: 18 },
        { header: 'Nome do Cliente', key: 'nome_cliente', width: 34 },
        { header: 'Convênio / Fundo', key: 'convenio', width: 38 },
        { header: 'Valor Contrato (R$)', key: 'valor_contrato', width: 20 },
        { header: 'Valor Parcela (R$)', key: 'parcela_valor', width: 18 },
        { header: 'Restam (Parcelas)', key: 'qtd_parcelas', width: 18 },
        { header: 'Saldo (R$)', key: 'soma_parcelas', width: 20 },
        { header: 'ID Venda', key: 'venda_id', width: 16 },
        { header: 'Data Venda', key: 'data_venda', width: 16 },
        { header: 'Status Venda', key: 'status_venda', width: 15 }
      ];

      const headerDet = wsDetalhe.getRow(1);
      headerDet.font = { bold: true };
      headerDet.alignment = { vertical: 'middle', horizontal: 'center' };

      contratosExibidos.forEach(c => {
        const row = wsDetalhe.addRow({
          situacao: c.vendido ? 'VENDIDO' : 'FALTA VENDER',
          vendedor: c.vendedor_formatado,
          operacao: c.operacao,
          cpf: c.cpf,
          nome_cliente: c.nome_cliente,
          convenio: c.convenio,
          valor_contrato: c.valor_contrato,
          parcela_valor: c.parcela_valor,
          qtd_parcelas: c.qtd_parcelas,
          soma_parcelas: c.soma_parcelas,
          venda_id: c.venda_id || '-',
          data_venda: c.data_venda ? new Date(c.data_venda).toLocaleDateString('pt-BR') : '-',
          status_venda: c.status_venda || '-'
        });

        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(9).alignment = { horizontal: 'center' };
        row.getCell(10).numFmt = '#,##0.00';
        row.getCell(11).alignment = { horizontal: 'center' };
        row.getCell(12).alignment = { horizontal: 'center' };
        row.getCell(13).alignment = { horizontal: 'center' };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Confronto_Vendedor_Metas_${dateStr}.xlsx`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Erro ao exportar planilha:', err);
      setModalAlert({
        isOpen: true,
        title: 'Erro na Exportação',
        message: 'Não foi possível gerar o arquivo Excel.'
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={modalAlert.isOpen}
        title={modalAlert.title}
        message={modalAlert.message}
        confirmType={modalAlert.type || 'primary'}
        onConfirm={() => setModalAlert(prev => ({ ...prev, isOpen: false }))}
        confirmText={modalAlert.confirmText || 'Entendi'}
      />

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Relatório por Vendedor (Metas × Vendas)
            </h1>
            <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              Acompanhe os contratos importados em Metas e identifique o que ainda falta vender por vendedor.
            </p>
          </div>

          <button
            onClick={handleExportExcel}
            disabled={loading || exporting || contratosExibidos.length === 0}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Download size={18} />
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div
            onClick={() => setSituacaoFilter('todos')}
            className="card"
            style={{
              padding: '1.1rem 1.25rem',
              cursor: 'pointer',
              border: situacaoFilter === 'todos' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>Total de Contratos</span>
              <Layers size={18} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 700, marginTop: '0.35rem' }}>
              {loading ? '...' : kpis.total}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
              Contratos únicos na base de metas
            </div>
          </div>

          <div
            onClick={() => setSituacaoFilter('pendentes')}
            className="card"
            style={{
              padding: '1.1rem 1.25rem',
              cursor: 'pointer',
              border: situacaoFilter === 'pendentes' ? '2px solid var(--color-warning)' : '1px solid var(--color-border)',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>Pendentes</span>
              <Clock size={18} style={{ color: 'var(--color-warning)' }} />
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 700, marginTop: '0.35rem', color: 'var(--color-warning)' }}>
              {loading ? '...' : kpis.pendentes}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
              Saldo em parcelas: <strong>R$ {kpis.somaSaldoPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <div
            onClick={() => setSituacaoFilter('vendidos')}
            className="card"
            style={{
              padding: '1.1rem 1.25rem',
              cursor: 'pointer',
              border: situacaoFilter === 'vendidos' ? '2px solid var(--color-success)' : '1px solid var(--color-border)',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>Vendidos</span>
              <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 700, marginTop: '0.35rem', color: 'var(--color-success)' }}>
              {loading ? '...' : kpis.vendidos}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
              Conversão: <strong>{kpis.percVendido.toFixed(1).replace('.', ',')}%</strong> concluído
            </div>
          </div>
        </div>

        {/* Filtro do Nome do Vendedor (Fora e antes do Quadro de Resumo) */}
        <div className="card" style={{ marginBottom: '1rem', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Search size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Filtrar nome do vendedor..."
            value={vendedorNomeSearch}
            onChange={e => setVendedorNomeSearch(e.target.value)}
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: 'var(--color-text-main)', padding: '0.15rem 0' }}
          />
          {vendedorNomeSearch.trim() !== '' && (
            <button
              type="button"
              onClick={() => setVendedorNomeSearch('')}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', flexShrink: 0 }}
            >
              Limpar
            </button>
          )}
        </div>

        {/* Vendas / Resumo por Vendedor (Layout com 3 Barras de Progresso igual ao Dashboard) */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '1rem', margin: 0 }}>
                <Target size={18} style={{ color: 'var(--color-primary)' }} /> Vendas por Vendedor (Metas × Vendas)
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>
                Acompanhamento de contratos totais, vendas realizadas e contratos pendentes por vendedor. Clique em um vendedor para filtrar a tabela abaixo.
              </p>
            </div>
            {vendedorFilter !== 'todos' && !lockedVendedor && (
              <button
                onClick={() => setVendedorFilter('todos')}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
              >
                Exibir Todos os Vendedores
              </button>
            )}
          </div>

          {!loading && resumoPorVendedor.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Nenhum vendedor encontrado com o filtro informado.
            </div>
          )}

          {!loading && resumoPorVendedor.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {resumoPorVendedor.map((r, idx) => {
                const isSelected = vendedorFilter === r.vendedor;
                const percTotal = Math.min(100, Math.max(0, r.perc_total_geral));
                const percVendas = Math.min(100, Math.max(0, r.perc_concluido));
                const percFaltam = Math.min(100, Math.max(0, r.perc_pendente));

                return (
                  <div
                    key={r.vendedor}
                    onClick={() => {
                      if (!lockedVendedor) {
                        setVendedorFilter(isSelected ? 'todos' : r.vendedor);
                      }
                    }}
                    style={{
                      cursor: lockedVendedor ? 'default' : 'pointer',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '8px',
                      borderBottom: idx < resumoPorVendedor.length - 1 && !isSelected ? '1px solid var(--color-border)' : undefined,
                      border: isSelected ? '1.5px solid var(--color-primary)' : undefined,
                      backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                        {r.vendedor}
                      </div>
                      {isSelected && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '0.15rem 0.55rem',
                            borderRadius: '9999px',
                            backgroundColor: 'rgba(99, 102, 241, 0.16)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            color: 'var(--color-primary)'
                          }}
                        >
                          Filtro ativo
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                      {/* Barra 1: Total */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>
                          <span>Total (Metas): <strong style={{ color: 'var(--color-text-main)' }}>{r.total_contratos}</strong></span>
                          <span>Soma: <strong style={{ color: 'var(--color-text-main)' }}>R$ {r.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--color-bg-body)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${percTotal}%`, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '3px', transition: 'width 1s ease' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', minWidth: '40px', textAlign: 'right' }}>
                            {percTotal.toFixed(0)}%
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                          Participação no total de contratos: <strong>{r.perc_total_geral.toFixed(1).replace('.', ',')}%</strong>
                        </div>
                      </div>

                      {/* Barra 2: Vendas */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>
                          <span>Vendas (Realizadas): <strong style={{ color: 'var(--color-success)' }}>{r.vendidos}</strong></span>
                          <span>Vendido: <strong style={{ color: 'var(--color-success)' }}>R$ {r.valor_vendido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--color-bg-body)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${percVendas}%`, height: '100%', backgroundColor: 'var(--color-success)', borderRadius: '3px', transition: 'width 1s ease' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-success)', minWidth: '40px', textAlign: 'right' }}>
                            {percVendas.toFixed(0)}%
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                          Conversão do vendedor: <strong>{r.perc_concluido.toFixed(1).replace('.', ',')}%</strong>
                        </div>
                      </div>

                      {/* Barra 3: Faltam */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>
                          <span>Faltam (Pendentes): <strong style={{ color: 'var(--color-warning)' }}>{r.pendentes}</strong></span>
                          <span>Saldo: <strong style={{ color: 'var(--color-warning)' }}>R$ {r.valor_pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--color-bg-body)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${percFaltam}%`, height: '100%', backgroundColor: 'var(--color-warning)', borderRadius: '3px', transition: 'width 1s ease' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-warning)', minWidth: '40px', textAlign: 'right' }}>
                            {percFaltam.toFixed(0)}%
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                          Pendente da carteira: <strong>{r.perc_pendente.toFixed(1).replace('.', ',')}%</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Barra de Filtros da Listagem de Contratos */}
        <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--color-text-muted)' }}>
                Buscar Cliente / CPF / Operação
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="CPF, nome ou nº operação..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '2.25rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--color-text-muted)' }}>
                Vendedor
              </label>
              <select
                value={lockedVendedor || vendedorFilter}
                onChange={e => {
                  if (!lockedVendedor) setVendedorFilter(e.target.value);
                }}
                disabled={Boolean(lockedVendedor)}
                style={{
                  width: '100%',
                  opacity: lockedVendedor ? 0.75 : 1,
                  cursor: lockedVendedor ? 'not-allowed' : 'pointer'
                }}
              >
                {!lockedVendedor && <option value="todos">Todos os Vendedores</option>}
                {vendedoresUnicos.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--color-text-muted)' }}>
                Situação do Contrato
              </label>
              <select
                value={situacaoFilter}
                onChange={e => setSituacaoFilter(e.target.value as any)}
                style={{ width: '100%' }}
              >
                <option value="pendentes">Falta Vender (Pendentes)</option>
                <option value="vendidos">Já Vendidos</option>
                <option value="todos">Todos os Contratos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Contratos Confrontados */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              Exibindo <strong>{contratosExibidos.length}</strong> {contratosExibidos.length === 1 ? 'contrato encontrado' : 'contratos encontrados'}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              Cruzando base de metas com as vendas realizadas...
            </div>
          ) : paginatedContratos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              Nenhum contrato encontrado para os filtros selecionados.
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '125px' }}>Situação</th>
                      <th style={{ textAlign: 'left' }}>Vendedor</th>
                      <th style={{ textAlign: 'center' }}>Operação</th>
                      <th style={{ textAlign: 'left' }}>CPF</th>
                      <th style={{ textAlign: 'left' }}>Cliente</th>
                      <th style={{ textAlign: 'right' }}>Valor Total Contrato</th>
                      <th style={{ textAlign: 'right' }}>Parcela</th>
                      <th style={{ textAlign: 'center' }}>Restam</th>
                      <th style={{ textAlign: 'right' }}>Saldo</th>
                      <th style={{ textAlign: 'left' }}>Venda / Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContratos.map(item => (
                      <tr key={item.operacao}>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {item.vendido ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                textTransform: 'capitalize',
                                letterSpacing: '0.03em',
                                color: 'var(--color-success)'
                              }}
                            >
                              Vendido
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                textTransform: 'capitalize',
                                letterSpacing: '0.03em',
                                color: 'var(--color-warning)'
                              }}
                            >
                              Pendente
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {item.vendedor_formatado}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {item.operacao}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>{item.cpf}</span>
                            {item.cpf && item.cpf !== '-' && (
                              <button
                                type="button"
                                onClick={() => handleCopy(item.cpf, `cpf-${item.operacao}`)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '0.15rem',
                                  color: copiedKey === `cpf-${item.operacao}` ? 'var(--color-success)' : 'var(--color-text-muted)',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                                title="Copiar CPF"
                              >
                                {copiedKey === `cpf-${item.operacao}` ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                          {item.nome_cliente}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>
                          R$ {item.valor_contrato.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                          R$ {item.parcela_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                          {item.qtd_parcelas}x
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: item.vendido ? 'var(--color-text-muted)' : 'var(--color-primary)' }}>
                          R$ {item.soma_parcelas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          {item.vendido ? (
                            <div>
                              <strong style={{ color: 'var(--color-success)' }}>{item.venda_id || 'Registrada'}</strong>
                              {item.data_venda && (
                                <span style={{ display: 'block', fontSize: '0.73rem' }}>
                                  {new Date(item.data_venda).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Página <strong>{page + 1}</strong> de <strong>{Math.max(1, Math.ceil(contratosExibidos.length / PAGE_SIZE))}</strong>
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    disabled={page === 0}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem' }}
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={(page + 1) * PAGE_SIZE >= contratosExibidos.length}
                    onClick={() => setPage(p => p + 1)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem' }}
                  >
                    Próxima <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

