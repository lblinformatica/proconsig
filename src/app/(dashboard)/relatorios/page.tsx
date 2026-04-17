'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Filter, FileSpreadsheet, ShieldOff } from 'lucide-react';

export default function RelatoriosPage() {
  const [dataApurada, setDataApurada] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [nivel, setNivel] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({
    banco: '', status: '', dataInicio: '', dataFim: '', corretor: ''
  });
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('usuarios').select('nivel').eq('supabase_user_id', session.user.id).single();
      setNivel(profile?.nivel ?? '');
    };
    init();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const gerarRelatorio = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let query = supabase.from('borderos').select('*, clientes(nome, cpf), usuarios!created_by(nome)');
    if (filtros.banco) query = query.ilike('banco', `%${filtros.banco}%`);
    if (filtros.status) query = query.eq('status', filtros.status);
    if (filtros.corretor) query = query.ilike('corretor', `%${filtros.corretor}%`);
    if (filtros.dataInicio) query = query.gte('created_at', filtros.dataInicio);
    if (filtros.dataFim) query = query.lte('created_at', filtros.dataFim + 'T23:59:59');
    const { data, error } = await query;
    if (error) alert('Erro: ' + error.message);
    else {
      setDataApurada(data || []);
      setSearched(true);
    }
    setLoading(false);
  };

  const exportExcel = async () => {
    if (dataApurada.length === 0) return alert('Gere o relatório antes de exportar.');
    // Dynamic import to keep bundle size small
    const XLSX = await import('xlsx');
    const payload = dataApurada.map(b => ({
      'ID Borderô': b.bordero_id || b.id,
      'Data Criação': new Date(b.created_at).toLocaleDateString('pt-BR'),
      'Cliente': b.clientes?.nome,
      'CPF': b.clientes?.cpf,
      'Banco': b.banco,
      'Agência': b.agencia,
      'Conta': b.conta,
      'Operação': b.operacao,
      'Valor Contrato': b.valor,
      'Saldo Devedor': b.saldo,
      'Valor Líquido': b.abat,
      'Parcela': b.parcela,
      'Prazo': b.prazo,
      'Status': b.status,
      'Empresa': b.empresa,
      'Corretor': b.corretor,
      'Usuário': b.usuarios?.nome
    }));
    const ws = XLSX.utils.json_to_sheet(payload);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `relatorio_proconsig_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Acesso negado para operacional
  if (nivel === 'operacional') {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '3rem' }}>
          <ShieldOff size={48} style={{ color: 'var(--color-danger)', marginBottom: '1rem' }} />
          <h2 style={{ margin: '0 0 0.5rem' }}>Acesso Restrito</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            O módulo de relatórios está disponível somente para administradores.
          </p>
        </div>
      </div>
    );
  }

  // Aguardando carregar nivel
  if (nivel === null) return null;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Relatórios</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Cruzamentos de dados dinâmicos com exportação para Excel.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={20} color="var(--color-primary)" /> Filtros Customizados
        </h2>
        <form onSubmit={gerarRelatorio}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div>
              <label>Banco</label>
              <input type="text" name="banco" value={filtros.banco} onChange={handleChange} placeholder="Ex: 104, Caixa..." />
            </div>
            <div>
              <label>Status</label>
              <select name="status" value={filtros.status} onChange={handleChange}>
                <option value="">Todos</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Pendente">Pendente</option>
                <option value="Rejeitado">Rejeitado</option>
              </select>
            </div>
            <div>
              <label>Corretor / Vendedor</label>
              <input type="text" name="corretor" value={filtros.corretor} onChange={handleChange} placeholder="Nome do corretor..." />
            </div>
            <div>
              <label>Data Início</label>
              <input type="date" name="dataInicio" value={filtros.dataInicio} onChange={handleChange} />
            </div>
            <div>
              <label>Data Fim</label>
              <input type="date" name="dataFim" value={filtros.dataFim} onChange={handleChange} />
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Pesquisando...' : 'Buscar Dados'}
            </button>
          </div>
        </form>
      </div>

      {dataApurada.length > 0 && (
        <div className="card animate-fade-in">
          {/* ... result list ... */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Resultado: {dataApurada.length} borderôs</h2>
            <button className="btn btn-primary" onClick={exportExcel}>
              <FileSpreadsheet size={18} /> Exportar Excel
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID Borderô</th>
                  <th>Cliente</th>
                  <th>Operação</th>
                  <th>Banco</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {dataApurada.slice(0, 50).map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>{b.bordero_id || b.id.substring(0, 8).toUpperCase()}</td>
                    <td>{b.clientes?.nome}<br /><small style={{ color: 'var(--color-text-muted)' }}>{b.clientes?.cpf}</small></td>
                    <td>{b.operacao}</td>
                    <td>{b.banco}</td>
                    <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.valor || 0)}</td>
                    <td>{b.status}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{b.usuarios?.nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dataApurada.length > 50 && (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                Mostrando os primeiros 50 resultados na tela. O arquivo Excel conterá todos os {dataApurada.length} registros.
              </div>
            )}
          </div>
        </div>
      )}

      {searched && dataApurada.length === 0 && !loading && (
        <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', margin: 0 }}>Nenhum registro encontrado.</p>
        </div>
      )}
    </div>
  );
}
