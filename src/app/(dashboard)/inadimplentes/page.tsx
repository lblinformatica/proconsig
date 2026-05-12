'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  Search,
  Upload,
  Trash2,
  X,
  AlertCircle,
  FileSpreadsheet,
  History,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { validateCPF, formatCPF } from '@/lib/cpf';

const PAGE_SIZE = 50;

export default function InadimplentesPage() {
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
  const [recordToDelete, setRecordToDelete] = useState<{ id: string; cpf: string; nome: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'danger' | 'primary';
  }>({ isOpen: false, title: '', message: '', type: 'primary' });

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

  const showAlert = (title: string, message: string, type: 'success' | 'danger' | 'primary' = 'primary') => {
    setNotification({ isOpen: true, title, message, type });
  };

  const fetchInadimplentes = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase.schema('pro_consig').from('inadimplentes').select('*', { count: 'exact' }).order('nome', { ascending: true }).range(from, to);

    let searchParam = search;
    if (search.includes('.') || search.includes('-')) {
      const onlyNumbers = search.replace(/[^\d]/g, '');
      if (onlyNumbers.length >= 11) {
        searchParam = onlyNumbers;
      }
    }

    if (search) {
      query = query.or(`nome.ilike.%${searchParam}%,cpf.ilike.%${searchParam}%`);
    }

    const { data, count, error } = await query;
    if (error) console.error(error);
    if (data) setData(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, search]);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase.schema('pro_consig').from('inadimplentes').select('nome_arquivo, data_importacao').order('data_importacao', { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    // Unique by filename and date
    const unique = Array.from(new Set(data?.map(i => JSON.stringify({ nome_arquivo: i.nome_arquivo, data_importacao: i.data_importacao })) || []))
      .map(s => JSON.parse(s));
    setHistory(unique);
  }, []);

  useEffect(() => {
    fetchInadimplentes();
  }, [fetchInadimplentes]);

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

        const toInsert = rows.map(row => ({
          cpf: String(findVal(row, ['cpf', 'cpf cliente']) || '').replace(/[^\d]/g, ''),
          nome: String(findVal(row, ['nome', 'cliente', 'nome cliente']) || ''),
          nome_arquivo: file.name,
          data_importacao: now
        })).filter(r => r.cpf);

        if (toInsert.length === 0) {
          showAlert('Erro na Importação', 'Não foi possível encontrar registros válidos no arquivo. Verifique se a coluna CPF está presente.', 'danger');
          setImporting(false);
          return;
        }

        // Evitar duplicados: busca registros já existentes para estes CPFs
        const cpfs = Array.from(new Set(toInsert.map(r => r.cpf)));
        const { data: existing } = await supabase.schema('pro_consig').from('inadimplentes')
          .select('cpf')
          .in('cpf', cpfs);

        const existingSet = new Set(existing?.map(e => e.cpf) || []);
        const finalToInsert = toInsert.filter(r => !existingSet.has(r.cpf));

        if (finalToInsert.length === 0) {
          showAlert('Atenção', 'Todos os registros do arquivo já existem na base de dados.', 'primary');
          setImporting(false);
          setShowImportModal(false);
          return;
        }

        const { error } = await supabase.schema('pro_consig').from('inadimplentes').insert(finalToInsert);

        if (error) throw error;

        showAlert('Sucesso', `${finalToInsert.length} novos registros importados com sucesso!`, 'success');
        if (finalToInsert.length < toInsert.length) {
          showAlert('Importação Parcial', `${toInsert.length - finalToInsert.length} registros foram ignorados por já existirem.`, 'primary');
        }
        fetchInadimplentes();
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
    const { error } = await supabase.schema('pro_consig').from('inadimplentes').delete()
      .eq('nome_arquivo', showConfirmDelete.nome_arquivo)
      .eq('data_importacao', showConfirmDelete.data_importacao);

    if (error) {
      showAlert('Erro', 'Falha ao excluir importação: ' + error.message, 'danger');
    } else {
      showAlert('Sucesso', 'Importação excluída com sucesso!', 'success');
      fetchInadimplentes();
      fetchHistory();
      setShowConfirmDelete(null);
    }
    setIsDeleting(false);
  };

  const handleDeleteSingle = async () => {
    if (!recordToDelete) return;

    setIsDeleting(true);
    const { error } = await supabase.schema('pro_consig').from('inadimplentes').delete()
      .eq('id', recordToDelete.id);

    if (error) {
      showAlert('Erro', 'Falha ao excluir registro: ' + error.message, 'danger');
    } else {
      showAlert('Sucesso', 'Registro removido da lista!', 'success');
      fetchInadimplentes();
      setRecordToDelete(null);
    }
    setIsDeleting(false);
  };

  const fs = { fontSize: '0.85rem' };
  const ls = { fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--color-primary)', display: 'block' };

  return (
    <>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Inadimplentes</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Gerenciamento de restritivos internos.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => { setShowHistoryModal(true); fetchHistory(); }} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} /> Histórico
          </button>
          <button onClick={() => setShowImportModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={18} /> Importar Excel
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={handleSearchChange}
              className="input"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-body)', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>CPF</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Nome</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Importado em</th>
               <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Arquivo</th>
              <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum inadimplente encontrado.</td></tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {formatCPF(item.cpf)}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.cpf);
                          showAlert('Copiado', 'CPF copiado para a área de transferência!', 'success');
                        }}
                        style={{ background: 'transparent', border: 'none', padding: '0.25rem', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
                        title="Copiar CPF"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 500 }}>{item.nome}</td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{new Date(item.data_importacao).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{item.nome_arquivo}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button
                      onClick={() => setRecordToDelete(item)}
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem', color: 'var(--color-danger)', border: 'none' }}
                      title="Excluir da lista"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
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
          <div className="card animate-scale-up" style={{ width: '100%', maxWidth: '500px', padding: '0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileSpreadsheet className="text-primary" /> Importar Inadimplentes
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
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Colunas necessárias: <strong>cpf</strong> e <strong>nome</strong></p>
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

      {/* Confirmation Modal - Single Delete */}
      <ConfirmModal
        isOpen={!!recordToDelete}
        title="Remover Inadimplente?"
        message={recordToDelete ? `Deseja remover o CPF ${formatCPF(recordToDelete.cpf)} (${recordToDelete.nome}) da lista de inadimplentes? Isso permitirá novas vendas para este cliente.` : ''}
        confirmType="danger"
        confirmText={isDeleting ? "Removendo..." : "Sim, Remover"}
        onConfirm={handleDeleteSingle}
        onCancel={() => !isDeleting && setRecordToDelete(null)}
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
