'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Download, FileSearch, Calendar, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(false);
  const [dataApurada, setDataApurada] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    banco: '', status: '', dataInicio: '', dataFim: '', corretor: ''
  });
  const [searched, setSearched] = useState(false);
  const [modalError, setModalError] = useState('');

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const buscarDados = async () => {
    setLoading(true);
    let query = supabase
      .from('vendas')
      .select('*, usuarios!created_by(nome)')
      .order('created_at', { ascending: false });

    if (filters.banco) query = query.ilike('banco', `%${filters.banco}%`);
    if (filters.corretor) query = query.ilike('corretor', `%${filters.corretor}%`);
    if (filters.dataInicio) query = query.gte('created_at', filters.dataInicio);
    if (filters.dataFim) query = query.lte('created_at', filters.dataFim + 'T23:59:59');

    const { data, error } = await query;
    if (error) {
      setModalError('Erro ao buscar dados: ' + error.message);
    } else {
      setDataApurada(data || []);
      setSearched(true);
    }
    setLoading(false);
  };

  const exportExcel = async () => {
    if (dataApurada.length === 0) {
      setModalError('Gere o relatório antes de exportar.');
      return;
    }

    const timestamp = new Date().toLocaleString('pt-BR');
    const rows = dataApurada.map(v => ({
      'ID Venda': v.venda_id || '-',
      'Data Cadastro': new Date(v.created_at).toLocaleDateString('pt-BR'),
      'Hora': new Date(v.created_at).toLocaleTimeString('pt-BR'),
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

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório de Vendas");
    XLSX.writeFile(workbook, `Relatorio_Vendas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Relatórios de Vendas</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Filtre e exporte dados detalhados para Excel.</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--color-primary)' }}>
          <Filter size={20} />
          <h3 style={{ margin: 0 }}>Filtros de Apuração</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Banco</label>
            <input name="banco" type="text" value={filters.banco} onChange={handleFilterChange} placeholder="Ex: Bradesco" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Corretor</label>
            <input name="corretor" type="text" value={filters.corretor} onChange={handleFilterChange} placeholder="Nome do corretor" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Data Inicial</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="dataInicio" type="date" value={filters.dataInicio} onChange={handleFilterChange} style={{ width: '100%', paddingLeft: '2.5rem' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Data Final</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="dataFim" type="date" value={filters.dataFim} onChange={handleFilterChange} style={{ width: '100%', paddingLeft: '2.5rem' }} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
          <button className="btn btn-primary" onClick={buscarDados} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '160px', justifyContent: 'center' }}>
            <FileSearch size={18} /> {loading ? 'Buscando...' : 'Gerar Relatório'}
          </button>
          <button className="btn btn-secondary" onClick={exportExcel} disabled={dataApurada.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={18} /> Exportar Excel
          </button>
        </div>
      </div>

      {searched && (
        <div className="card animate-scale-up" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <FileSearch size={32} />
          </div>
          <h2 style={{ margin: '0 0 0.5rem' }}>Relatório Gerado!</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Encontramos <strong>{dataApurada.length}</strong> registros com os filtros aplicados.</p>
          <button className="btn btn-primary" onClick={exportExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem' }}>
            <Download size={20} /> Baixar Arquivo Excel
          </button>
        </div>
      )}

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
