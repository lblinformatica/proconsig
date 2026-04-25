'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Search, 
  Filter, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Calendar,
  FileText,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { validateCPF, formatCPF } from '@/lib/cpf';

const PAGE_SIZE = 50;

interface ImportResult {
  total: number;
  imported: number;
  ignored: number;
  invalidCpf: number;
  duplicates: number;
}

// Função auxiliar para tratar datas em diversos formatos
function parseExcelDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  
  const str = String(val).trim();
  
  // Tenta formato DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [_, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Tenta formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.split(' ')[0];
  }

  return str; // Retorna original e deixa o banco validar se falhar
}


export default function OperacoesPage() {
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    nome_arquivo: '',
    data_inicio: '',
    data_fim: ''
  });

  // Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const fetchOperacoes = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('operacoes')
      .select('*', { count: 'exact' })
      .order('data_importacao', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`vendedor.ilike.%${search}%,cpf.ilike.%${search}%,convenio.ilike.%${search}%`);
    }

    if (filters.nome_arquivo) {
      query = query.ilike('nome_arquivo', `%${filters.nome_arquivo}%`);
    }

    if (filters.data_inicio) {
      query = query.gte('data_importacao', filters.data_inicio);
    }

    if (filters.data_fim) {
      query = query.lte('data_importacao', filters.data_fim + 'T23:59:59');
    }

    const { data, count, error } = await query;
    if (error) console.error('Erro ao buscar operações:', error);
    if (data) setOperacoes(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, search, filters]);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase
      .rpc('get_import_history');

    if (error) {
      console.error('Erro ao buscar histórico:', error);
      return;
    }

    setHistory(data || []);
  }, []);


  useEffect(() => {
    fetchOperacoes();
    if (showHistoryModal) fetchHistory();
  }, [fetchOperacoes, showHistoryModal, fetchHistory]);

  const handleDeleteImport = async () => {
    if (!showConfirmDelete) return;
    const { nome_arquivo, data_importacao } = showConfirmDelete;

    setDeleting(`${nome_arquivo}-${data_importacao}`);
    const { error } = await supabase
      .from('operacoes')
      .delete()
      .eq('nome_arquivo', nome_arquivo)
      .eq('data_importacao', data_importacao);

    if (error) {
      alert('Erro ao excluir importação: ' + error.message);
    } else {
      setShowConfirmDelete(null);
      fetchHistory();
      fetchOperacoes();
    }
    setDeleting(null);
  };



  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const results: ImportResult = {
          total: data.length,
          imported: 0,
          ignored: 0,
          invalidCpf: 0,
          duplicates: 0
        };

        const toStaging: any[] = [];
        const fileName = file.name;
        const sessionId = crypto.randomUUID();

        // 1. Prepare and validate data on client (fast)
        for (const row of data) {
          const operacaoId = row['Operação'] || row['Operacao'];
          const vencimento = row['Vencimento'];
          const cpfRaw = String(row['CPF'] || '');
          const cpf = cpfRaw ? formatCPF(cpfRaw) : null;
          const valor = row['Valor'];

          if (!operacaoId || !vencimento || !cpf) {
            results.ignored++;
            continue;
          }

          if (!validateCPF(cpf)) {
            results.invalidCpf++;
            continue;
          }

          const valorNum = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'));
          const grupoNum = parseInt(String(row['Grupo'] || '0'));

          toStaging.push({
            operacao: parseInt(String(operacaoId)),
            vencimento: parseExcelDate(vencimento),
            cpf,
            valor: isNaN(valorNum) ? 0 : valorNum,
            vendedor: String(row['Vendedor'] || ''),
            contacobranca: String(row['Conta de Cob.'] || row['Conta de Cobrança'] || row['contacobranca'] || ''),
            fundo: String(row['Fundo'] || ''),
            convenio: String(row['Convênio'] || row['Convenio'] || ''),
            grupo: isNaN(grupoNum) ? 0 : grupoNum,
            nome_arquivo: fileName,
            import_session_id: sessionId
          });

        }

        // 2. Upload to Staging in chunks of 500
        const chunkSize = 500;
        for (let i = 0; i < toStaging.length; i += chunkSize) {
          const chunk = toStaging.slice(i, i + chunkSize);
          const { error: stagingError } = await supabase
            .from('operacoes_staging')
            .insert(chunk);
          
          if (stagingError) {
            console.error('Erro ao enviar bloco para staging:', stagingError);
            throw stagingError;
          }
        }

        // 3. Trigger Server-Side Processing (The Magic Part)
        const { data: procData, error: procError } = await supabase
          .rpc('processar_importacao_operacoes', { p_session_id: sessionId });

        if (procError) throw procError;

        // 4. Update results with server data
        if (procData) {
          results.imported = procData.imported;
          results.duplicates = procData.duplicates;
          results.ignored += procData.ignored;
        }

        setImportResult(results);
        fetchOperacoes();
      } catch (err: any) {
        console.error('Erro detalhado no processamento:', err);
        const errorMsg = err.message || err.details || 'Erro desconhecido';
        alert(`Erro ao processar o arquivo: ${errorMsg}`);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>

    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Operações</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Gerenciamento e importação de operações bancárias.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setShowHistoryModal(true)} 
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Clock size={18} /> Histórico
          </button>
          <button 
            onClick={() => setShowImportModal(true)} 
            className="btn btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Upload size={18} /> Importar Operações
          </button>
        </div>

      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px 200px auto', gap: '1rem', alignItems: 'end' }}>
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' }}>Busca Geral</label>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input 
                type="text" 
                placeholder="Vendedor, CPF, Convênio..." 
                value={search} 
                onChange={e => { setSearch(e.target.value); setPage(0); }} 
                style={{ paddingLeft: '2.75rem', width: '100%' }} 
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' }}>Nome do Arquivo</label>
            <input 
              type="text" 
              placeholder="Ex: Grupo 2..." 
              value={filters.nome_arquivo} 
              onChange={e => setFilters(f => ({ ...f, nome_arquivo: e.target.value }))} 
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' }}>Data Início</label>
            <input 
              type="date" 
              value={filters.data_inicio} 
              onChange={e => setFilters(f => ({ ...f, data_inicio: e.target.value }))} 
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' }}>Data Fim</label>
            <input 
              type="date" 
              value={filters.data_fim} 
              onChange={e => setFilters(f => ({ ...f, data_fim: e.target.value }))} 
              style={{ width: '100%' }}
            />
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '42px' }} 
            onClick={() => { setFilters({ nome_arquivo: '', data_inicio: '', data_fim: '' }); setSearch(''); setPage(0); }}
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>Carregando operações...</div>
        ) : operacoes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Nenhuma operação encontrada.</div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Operação</th>
                    <th>Vencimento</th>
                    <th>CPF</th>
                    <th>Valor</th>
                    <th>Vendedor</th>
                    <th>Convênio</th>
                    <th>Arquivo</th>
                    <th>Importado em</th>
                  </tr>
                </thead>
                <tbody>
                  {operacoes.map((op) => (
                    <tr key={op.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{op.operacao}</td>
                      <td>{new Date(op.vencimento).toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontFamily: 'monospace' }}>{op.cpf}</td>
                      <td style={{ fontWeight: 600 }}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(op.valor)}
                      </td>
                      <td>{op.vendedor}</td>
                      <td>{op.convenio}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <FileText size={14} />
                          {op.nome_arquivo || '-'}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={14} />
                          {new Date(op.data_importacao).toLocaleString('pt-BR')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Total: {total} operações — Página {page + 1} de {totalPages}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18} /></button>
                  <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={18} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div style={{ 
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
        }}>
          <div className="card animate-scale-up" style={{ 
            width: '100%', 
            maxWidth: '520px', 
            padding: '0', 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>

            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileSpreadsheet className="text-primary" /> Importar Operações
              </h3>
              <button onClick={() => { if (!importing) setShowImportModal(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '2rem' }}>
              {!importResult ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    border: '2px dashed var(--color-border)', 
                    borderRadius: 'var(--radius-lg)', 
                    padding: '3rem 2rem',
                    backgroundColor: 'var(--color-bg-body)',
                    cursor: importing ? 'wait' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                  onClick={() => !importing && fileInputRef.current?.click()}
                  >
                    <Upload size={40} style={{ color: 'var(--color-primary)', marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                      {importing ? 'Processando arquivo...' : 'Clique para selecionar o arquivo Excel'}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      Modelo: Grupo 2_18.04.2026.xlsx
                    </p>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImport} 
                      accept=".xlsx, .xls" 
                      style={{ display: 'none' }} 
                    />
                  </div>
                  
                  <div style={{ marginTop: '1.5rem', textAlign: 'left', backgroundColor: 'rgba(79,70,229,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(79,70,229,0.1)' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertCircle size={14} /> Campos necessários:
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                      Operação, Vencimento, CPF, Valor, Vendedor, Conta de Cob., Fundo, Convênio e Grupo.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', padding: '1rem', backgroundColor: 'var(--color-success-bg)', borderRadius: 'var(--radius-md)', color: 'var(--color-success)' }}>
                    <CheckCircle2 size={24} />
                    <div>
                      <strong style={{ display: 'block' }}>Importação Concluída</strong>
                      <span style={{ fontSize: '0.875rem' }}>O processamento do arquivo foi finalizado.</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--color-bg-body)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Registros Importados</span>
                      <strong style={{ fontSize: '1.25rem', color: 'var(--color-success)' }}>{importResult.imported}</strong>
                    </div>
                    <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--color-bg-body)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Já Importados</span>
                      <strong style={{ fontSize: '1.25rem', color: 'var(--color-warning)' }}>{importResult.duplicates}</strong>
                    </div>
                    <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--color-bg-body)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>CPF Inválido</span>
                      <strong style={{ fontSize: '1.25rem', color: 'var(--color-danger)' }}>{importResult.invalidCpf}</strong>
                    </div>
                    <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--color-bg-body)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Ignorados/Erro</span>
                      <strong style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)' }}>{importResult.ignored}</strong>
                    </div>
                  </div>

                  <button 
                    onClick={() => { setShowImportModal(false); setImportResult(null); }} 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '2rem' }}
                  >
                    Fechar Resumo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div className="card animate-scale-up" style={{ width: '100%', maxWidth: '700px', padding: '0', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Clock className="text-primary" /> Histórico de Importações
              </h3>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto', flexGrow: 1 }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Nenhuma importação encontrada.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {history.map((h, i) => (
                    <div key={i} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-body)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ backgroundColor: 'var(--color-primary-light)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--color-primary)' }}>
                          <FileSpreadsheet size={24} />
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: '1rem' }}>{h.nome_arquivo || 'Sem nome'}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Calendar size={12} /> {new Date(h.data_importacao).toLocaleString()} • <Database size={12} /> {h.total_registros} registros
                          </span>
                        </div>
                      </div>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                        disabled={deleting === `${h.nome_arquivo}-${h.data_importacao}`}
                        onClick={() => setShowConfirmDelete(h)}
                      >
                        {deleting === `${h.nome_arquivo}-${h.data_importacao}` ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', textAlign: 'right' }}>
              <button onClick={() => setShowHistoryModal(false)} className="btn btn-secondary">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1.5rem' }}>
          <div className="card animate-scale-up" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <AlertCircle size={32} />
            </div>
            <h3 style={{ marginBottom: '1rem' }}>Excluir Importação?</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Tem certeza que deseja excluir todos os <strong>{showConfirmDelete.total_registros} registros</strong> do arquivo 
              <br /><strong>"{showConfirmDelete.nome_arquivo}"</strong>?
              <br /><small>Importado em {new Date(showConfirmDelete.data_importacao).toLocaleString()}</small>
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowConfirmDelete(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
              <button 
                onClick={handleDeleteImport} 
                className="btn btn-danger" 
                style={{ flex: 1 }}
                disabled={deleting !== null}
              >
                {deleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}



      <style jsx global>{`
        .animate-scale-up {
          animation: scaleUp 0.3s ease-out;
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
