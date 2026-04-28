'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Download, FileSearch, Calendar, Filter, ChevronLeft, ChevronRight, FileText, Clock, User, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useEffect } from 'react';

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(false);
  const [vendas, setVendas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const [filters, setFilters] = useState({
    banco: '', status: '', dataInicio: '', dataFim: '', corretor: ''
  });
  const [modalError, setModalError] = useState('');

  // Carregar dados ao entrar na tela
  useEffect(() => {
    buscarDados(0);
  }, []);



  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const buscarDados = async (p = page) => {
    setLoading(true);
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('vendas')
      .select('*, usuarios!created_by(nome)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters.banco) query = query.ilike('banco', `%${filters.banco}%`);
    if (filters.corretor) query = query.ilike('corretor', `%${filters.corretor}%`);
    if (filters.dataInicio) query = query.gte('created_at', filters.dataInicio);
    if (filters.dataFim) query = query.lte('created_at', filters.dataFim + 'T23:59:59');

    const { data, count, error } = await query;
    if (error) {
      setModalError('Erro ao buscar dados: ' + error.message);
    } else {
      setVendas(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  };



  const [countResult, setCountResult] = useState(0);

  const exportExcel = async () => {
    setLoading(true);
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('vendas')
        .select('*, usuarios!created_by(nome)')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('created_at', { ascending: false });

      if (filters.banco) query = query.ilike('banco', `%${filters.banco}%`);
      if (filters.corretor) query = query.ilike('corretor', `%${filters.corretor}%`);
      if (filters.dataInicio) query = query.gte('created_at', filters.dataInicio);
      if (filters.dataFim) query = query.lte('created_at', filters.dataFim + 'T23:59:59');

      const { data, error } = await query;

      if (error) {
        setModalError('Erro na exportação: ' + error.message);
        hasMore = false;
        break;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) hasMore = false;
        else page++;
      } else {
        hasMore = false;
      }
    }

    if (allData.length > 0) {
      const timestamp = new Date().toLocaleString('pt-BR');
      const rows = allData.map(v => ({
        'ID Venda': v.venda_id || '-',
        'Status Exportação': v.data_exportacao_atual ? 'RE-EXPORTADO' : 'NOVO (Primeira Vez)',
        'Penúltima Exportação': v.data_exportacao_anterior ? new Date(v.data_exportacao_anterior).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-',
        'Última Exportação': v.data_exportacao_atual ? new Date(v.data_exportacao_atual).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-',
        'Data Cadastro': new Date(v.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        'Hora': new Date(v.created_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        'Operador': v.usuarios?.nome || '-',
        'CPF Cliente': v.cpf,
        'Órgão': v.orgao || '-',
        'Empresa': v.empresa || '-',
        'Operação': v.operacao,
        'Cód. Operação': v.codigo_operacao || '-',
        'Corretor': v.corretor || '-',
        'Valor Contrato': v.valor || 0,
        'Saldo Devedor': v.saldo || 0,
        'Valor Líquido': v.abat || 0,
        'Parcela': v.parcela || 0,
        'Coeficiente': v.coef || 0,
        'Prazo': v.prazo || 0,
        'Banco (Débito)': v.banco || '-',
        'Agência (Débito)': `${v.agencia || ''}-${v.agencia_dv || ''}`,
        'Conta (Débito)': `${v.conta || ''}-${v.conta_dv || ''}`,
        'Forma Recebimento': v.forma_credito?.toUpperCase() || '-',
        'PIX (Chave)': v.pix_chave || '-',
        'PIX (Tipo)': v.pix_tipo_chave || '-',
        'Banco (Crédito)': v.credito_banco || '-',
        'Agência (Crédito)': `${v.credito_agencia || ''}-${v.credito_agencia_dv || ''}`,
        'Conta (Crédito)': `${v.credito_conta || ''}-${v.credito_conta_dv || ''}`,
        'Contrato nº': v.contrato || '-',
        'Ativação': v.empresa_ativacao || '-',
        'Início (Mês/Ano)': v.inicio ? new Date(v.inicio).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : '-',
        'Empresa Credora': v.empresa_credora || '-',
        'Observações': v.observacao || '-',
        'Log de Exportação': `Gerado em ${timestamp}`
      }));

      // Salvar o arquivo
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório de Vendas");
      XLSX.writeFile(workbook, `Relatorio_Vendas_${new Date().toISOString().split('T')[0]}.xlsx`);

      // Atualizar as datas no banco de dados
      const ids = allData.map(v => v.id);
      await supabase.rpc('update_vendas_export_dates', { venda_ids: ids });

      setModalError('Exportação concluída! Os registros foram marcados com a data de hoje.');
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Relatórios de Vendas</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Filtre e exporte dados detalhados para Excel.</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>Banco</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="banco" type="text" value={filters.banco} onChange={handleFilterChange} placeholder="Buscar banco..." style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>Corretor</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="corretor" type="text" value={filters.corretor} onChange={handleFilterChange} placeholder="Nome do corretor..." style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }} />
            </div>
          </div>
          <div style={{ width: '180px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>Data Inicial</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="dataInicio" type="date" value={filters.dataInicio} onChange={handleFilterChange} style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }} />
            </div>
          </div>
          <div style={{ width: '180px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>Data Final</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="dataFim" type="date" value={filters.dataFim} onChange={handleFilterChange} style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }} />
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => { setPage(0); buscarDados(0); }}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '42px', padding: '0 1.5rem' }}
          >
            <Filter size={18} /> {loading ? '...' : 'Filtrar'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>

        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              <FileText size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Registros Encontrados</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Total de <strong>{total}</strong> vendas apuradas</p>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={exportExcel} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={18} /> {loading ? 'Processando...' : 'Exportar para Excel'}
          </button>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '1.5rem' }}>ID Venda</th>
                <th>Cliente (CPF)</th>
                <th>Operação</th>
                <th>Valor</th>
                <th>Corretor</th>
                <th>Banco</th>
                <th>Última Exportação</th>
                <th>Data Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {vendas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Nenhum dado para exibir com esses filtros.</td>
                </tr>
              ) : (
                vendas.map((v) => (
                  <tr key={v.id}>
                    <td style={{ paddingLeft: '1.5rem', fontWeight: 600, color: 'var(--color-primary)' }}>{v.venda_id || '-'}</td>
                    <td>{v.cpf}</td>
                    <td style={{ fontSize: '0.85rem' }}>{v.operacao}</td>
                    <td style={{ fontWeight: 600 }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valor || 0)}</td>
                    <td>{v.corretor}</td>
                    <td>{v.banco}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={14} />
                        {v.data_exportacao_atual ? new Date(v.data_exportacao_atual).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Nunca Exportado'}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(v.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page === 0} onClick={() => { setPage(p => p - 1); buscarDados(page - 1); }}><ChevronLeft size={18} /></button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page >= Math.ceil(total / PAGE_SIZE) - 1} onClick={() => { setPage(p => p + 1); buscarDados(page + 1); }}><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </div>



      <ConfirmModal
        isOpen={!!modalError}
        title="Relatórios"
        message={modalError}
        onConfirm={() => setModalError('')}
        confirmText="Entendi"
        confirmType="primary"
      />
    </div>
  );
}
