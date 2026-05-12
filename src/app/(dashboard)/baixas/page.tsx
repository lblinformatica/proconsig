'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  Search,
  Upload,
  Trash2,
  X,
  CheckSquare,
  FileSpreadsheet,
  History,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { validateCPF, formatCPF } from '@/lib/cpf';

const PAGE_SIZE = 50;

export default function BaixasPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState<{ nome_arquivo: string; data_importacao: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'danger' | 'primary';
  }>({ isOpen: false, title: '', message: '', type: 'primary' });

  const showAlert = (title: string, message: string, type: 'success' | 'danger' | 'primary' = 'primary') => {
    setNotification({ isOpen: true, title, message, type });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (/[a-zA-Z]/.test(v)) {
      setSearch(v);
    } else {
      const digits = v.replace(/\D/g, '').slice(0, 11);
      let formatted = digits;
      if (digits.length > 9) {
        formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
      } else if (digits.length > 6) {
        formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      } else if (digits.length > 3) {
        formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
      }
      setSearch(formatted);
    }
    setPage(0);
  };

  const fetchBaixas = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase.schema('pro_consig').from('baixas').select('*', { count: 'exact' })
      .order('nome', { ascending: true })
      .order('operacao', { ascending: true })
      .order('vencimento', { ascending: true })
      .range(from, to);

    let searchParam = search;
    if (search.includes('.') || search.includes('-')) {
      const onlyNumbers = search.replace(/[^\d]/g, '');
      if (onlyNumbers.length >= 11) {
        searchParam = onlyNumbers;
      }
    }

    if (search) {
      query = query.or(`nome.ilike.%${searchParam}%,cpf.ilike.%${searchParam}%,operacao.ilike.%${searchParam}%`);
    }

    const { data, count, error } = await query;
    if (error) console.error(error);
    if (data) setData(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, search]);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase.schema('pro_consig').from('baixas').select('nome_arquivo, data_importacao').order('data_importacao', { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    const unique = Array.from(new Set(data?.map(i => JSON.stringify({ nome_arquivo: i.nome_arquivo, data_importacao: i.data_importacao })) || []))
      .map(s => JSON.parse(s));
    setHistory(unique);
  }, []);

  useEffect(() => {
    fetchBaixas();
  }, [fetchBaixas]);

  // Auxiliar para datas Excel
  function parseExcelDate(val: any): string | null {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const str = String(val).trim();
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const [_, day, month, year] = dmyMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split(' ')[0];
    return str;
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        const now = new Date().toISOString();
        // Função auxiliar para buscar valor em colunas com nomes variados
        const findVal = (row: any, keys: string[]) => {
          for (const key of keys) {
            const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
            if (found && row[found] !== undefined && row[found] !== null) return row[found];
          }
          return null;
        };

        const toInsert = rows.map(row => {
          const valorRaw = findVal(row, ['valor', 'parcela', 'vlr parcela', 'vlr']);
          const valor = parseFloat(String(valorRaw || '0').replace(',', '.')) || 0;

          return {
            cpf: String(findVal(row, ['cpf', 'cpf cliente']) || '').replace(/[^\d]/g, ''),
            nome: String(findVal(row, ['nome', 'cliente', 'nome cliente']) || ''),
            operacao: String(findVal(row, ['operacao', 'operação', 'op', 'contrato']) || ''),
            parcela: valor,
            vencimento: parseExcelDate(findVal(row, ['vencimento', 'data vencimento', 'venc'])),
            data_baixa: parseExcelDate(findVal(row, ['data_baixa', 'data baixa', 'baixa', 'data da baixa'])),
            nome_arquivo: file.name,
            data_importacao: now
          };
        }).filter(r => r.cpf && r.operacao && r.parcela > 0 && r.vencimento && r.data_baixa);

        if (toInsert.length === 0) {
          showAlert('Erro na Importação', 'Não foi possível encontrar registros válidos no arquivo. Verifique se as colunas (CPF, Operação, Parcela, Vencimento e Data Baixa) estão presentes e preenchidas corretamente.', 'danger');
          setImporting(false);
          return;
        }

        // Evitar duplicados: busca registros já existentes para estes CPFs
        const cpfs = Array.from(new Set(toInsert.map(r => r.cpf)));
        const { data: existing } = await supabase.schema('pro_consig').from('baixas')
          .select('cpf, operacao, vencimento')
          .in('cpf', cpfs);

        const existingKeys = new Set(existing?.map(e => `${e.cpf}-${e.operacao}-${e.vencimento}`) || []);
        const finalToInsert = toInsert.filter(r => !existingKeys.has(`${r.cpf}-${r.operacao}-${r.vencimento}`));

        if (finalToInsert.length === 0) {
          showAlert('Atenção', 'Todos os registros do arquivo já existem na base de dados.', 'primary');
          setImporting(false);
          setShowImportModal(false);
          return;
        }

        const { error } = await supabase.schema('pro_consig').from('baixas').insert(finalToInsert);

        if (error) throw error;

        showAlert('Sucesso', `${finalToInsert.length} novos registros importados com sucesso!`, 'success');
        if (finalToInsert.length < toInsert.length) {
          showAlert('Importação Parcial', `${toInsert.length - finalToInsert.length} registros foram ignorados por já existirem.`, 'primary');
        }
        fetchBaixas();
        setShowImportModal(false);
      } catch (err: any) {
        showAlert('Erro', 'Falha ao importar: ' + err.message, 'danger');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDeleteImport = async () => {
    if (!showConfirmDelete) return;

    setIsDeleting(true);
    const { error } = await supabase.schema('pro_consig').from('baixas').delete()
      .eq('nome_arquivo', showConfirmDelete.nome_arquivo)
      .eq('data_importacao', showConfirmDelete.data_importacao);

    if (error) {
      showAlert('Erro', 'Falha ao excluir importação: ' + error.message, 'danger');
    } else {
      showAlert('Sucesso', 'Importação excluída com sucesso!', 'success');
      fetchBaixas();
      fetchHistory();
      setShowConfirmDelete(null);
    }
    setIsDeleting(false);
  };

  return (
    <>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>Baixas de Parcelas</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Gerenciamento de pagamentos e baixas de contratos.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => { setShowHistoryModal(true); fetchHistory(); }} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} /> Histórico
            </button>
            <button onClick={() => setShowImportModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={18} /> Importar Baixas
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por nome, CPF ou operação..."
                value={search}
                onChange={handleSearchChange}
                className="input"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-body)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)', width: '150px' }}>CPF</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Nome</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)', width: '100px' }}>Operação</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Parcela</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Vencimento</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Data Baixa</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Arquivo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhuma baixa encontrada.</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-main)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {formatCPF(item.cpf)}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.cpf);
                              showAlert('Copiado', 'CPF copiado para a área de transferência!', 'success');
                            }}
                            style={{ background: 'transparent', border: 'none', padding: '0.1rem', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
                            title="Copiar CPF"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 600 }}>{item.nome}</td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{item.operacao}</td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: 600 }}>R$ {item.parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>{item.vencimento ? new Date(item.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', textAlign: 'center', color: 'var(--color-success)', fontWeight: 600 }}>{item.data_baixa ? new Date(item.data_baixa + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                      <td style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.nome_arquivo}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-body)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Total: <strong>{total}</strong> registros</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn btn-secondary" style={{ padding: '0.5rem' }}><ChevronLeft size={18} /></button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', fontSize: '0.875rem' }}>Página {page + 1}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total} className="btn btn-secondary" style={{ padding: '0.5rem' }}><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1.5rem'
        }}>
          <div className="card animate-scale-up" style={{ width: '100%', maxWidth: '520px', padding: '0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileSpreadsheet className="text-primary" /> Importar Baixas
              </h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '2rem' }}>
              <div
                style={{ background: 'var(--color-bg-body)', padding: '2.5rem 1.5rem', borderRadius: 'var(--radius)', border: '2px dashed var(--color-border)', textAlign: 'center', cursor: 'pointer' }}
                onClick={() => !importing && fileInputRef.current?.click()}
              >
                <Upload size={40} style={{ color: 'var(--color-primary)', marginBottom: '1rem', opacity: 0.8 }} />
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{importing ? 'Processando...' : 'Clique para selecionar o arquivo Excel'}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Colunas: <strong>cpf, nome, operacao, parcela, vencimento, data baixa</strong>
                </p>
                <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx, .xls" style={{ display: 'none' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1.5rem'
        }}>
          <div className="card animate-scale-up" style={{ width: '100%', maxWidth: '700px', padding: '0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <History className="text-primary" /> Histórico de Importações
              </h3>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {history.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Nenhuma importação realizada.</p>
              ) : (
                history.map((h, i) => (
                  <div key={i} style={{ padding: '1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-body)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{h.nome_arquivo}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{new Date(h.data_importacao).toLocaleString('pt-BR')}</div>
                    </div>
                    <button onClick={() => setShowConfirmDelete(h)} className="btn btn-secondary" style={{ color: 'var(--color-danger)', border: 'none' }} title="Excluir esta importação">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!showConfirmDelete}
        title="Excluir Importação?"
        message={showConfirmDelete ? `Tem certeza que deseja excluir toda a importação do arquivo "${showConfirmDelete.nome_arquivo}"?` : ''}
        confirmType="danger"
        confirmText={isDeleting ? "Excluindo..." : "Sim, Excluir"}
        onConfirm={handleDeleteImport}
        onCancel={() => !isDeleting && setShowConfirmDelete(null)}
      />

      <ConfirmModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        confirmType={notification.type}
        confirmText="Entendi"
        onConfirm={() => setNotification(n => ({ ...n, isOpen: false }))}
      />
    </>
  );
}
