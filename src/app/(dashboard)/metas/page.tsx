'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  Search,
  Filter,
  Upload,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Database,
  Calendar,
  Clock,
  Trash2,
  CheckSquare,
  Square,
  FileDown,
  Copy,
  Eye,
  UserCheck,
  UserMinus
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { validateCPF, formatCPF } from '@/lib/cpf';
import { ConfirmModal } from '@/components/ConfirmModal';

const PAGE_SIZE = 50;

interface ImportResult {
  total: number;
  imported: number;
  ignored: number;
  invalidCpf: number;
  duplicates: number;
}

function parseExcelDate(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }

  const num = Number(val);
  if (!isNaN(num) && num > 20000 && num < 60000) {
    const date = new Date((num - 25568) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();
  const dmyMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.split(' ')[0].split('T')[0];
  }

  return null;
}

function parseNumericValue(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;
  if (str.includes(',')) {
    const parsed = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export default function MetasPage() {
  const [metas, setMetas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vendedoresMap, setVendedoresMap] = useState<Record<string, string>>({});
  const [vendedoresList, setVendedoresList] = useState<any[]>([]);

  useEffect(() => {
    const fetchVendedores = async () => {
      const { data } = await supabase
        .schema('pro_consig')
        .from('vendedores')
        .select('id, codigo, nome')
        .order('codigo', { ascending: true });
      if (data) {
        setVendedoresList(data);
        const map: Record<string, string> = {};
        data.forEach((v: any) => {
          const formatted = `${v.codigo} - ${v.nome}`;
          map[v.nome.trim().toUpperCase()] = formatted;
          map[formatted.trim().toUpperCase()] = formatted;
          map[v.codigo.trim().toUpperCase()] = formatted;
        });
        setVendedoresMap(map);
      }
    };
    fetchVendedores();
  }, []);

  const getVendedorDisplay = (vendedorStr: string) => {
    if (!vendedorStr) return '-';
    const clean = vendedorStr.trim().toUpperCase();
    return vendedoresMap[clean] || vendedorStr;
  };

  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    data_inicio: '',
    data_fim: '',
    validez: 'todos',
    cliente_status: 'todos',
    nome_arquivo: '',
    vendedor: 'todos'
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'danger' | 'primary';
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'primary'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'danger' | 'primary' = 'primary') => {
    setNotification({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => setNotification(prev => ({ ...prev, isOpen: false }))
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'primary' = 'primary') => {
    setNotification({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        onConfirm();
        setNotification(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setNotification(prev => ({ ...prev, isOpen: false }))
    });
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applySharedFilters = useCallback(
    (query: any) => {
      let q = query;

      if (filters.cliente_status === 'cadastrados') {
        q = q.eq('cliente_cadastrado', true);
      } else if (filters.cliente_status === 'nao_cadastrados') {
        q = q.eq('cliente_cadastrado', false);
      }

      if (filters.data_inicio) {
        q = q.filter('vencimento', 'gte', filters.data_inicio);
      }

      if (filters.data_fim) {
        q = q.filter('vencimento', 'lte', filters.data_fim);
      }

      if (filters.validez === 'validos') {
        q = q.eq('cpf_valido', true);
      } else if (filters.validez === 'invalidos') {
        q = q.eq('cpf_valido', false);
      }

      if (search) {
        q = q.ilike('cpf', `%${search}%`);
      }

      if (filters.vendedor !== 'todos') {
        const sellerObj = vendedoresList.find(v => v.id === filters.vendedor);
        if (sellerObj) {
          const name = sellerObj.nome.trim().toUpperCase();
          const formatted = `${sellerObj.codigo} - ${sellerObj.nome}`.trim().toUpperCase();
          q = q.or(`vendedor.eq."${name}",vendedor.eq."${formatted}"`);
        }
      }

      return q;
    },
    [search, filters, vendedoresList]
  );

  const fetchMetas = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const baseQuery = supabase
      .from('metas')
      .select('*', { count: 'exact' })
      .order('data_importacao', { ascending: false })
      .order('operacao', { ascending: true })
      .range(from, to);

    const { data, count, error } = await applySharedFilters(baseQuery);
    if (error) console.error('Erro ao buscar metas:', error);
    if (data) setMetas(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, applySharedFilters]);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_metas_import_history');
    if (error) {
      console.error('Erro ao buscar histórico de metas:', error);
      return;
    }
    setHistory(data || []);
  }, []);

  useEffect(() => {
    fetchMetas();
    if (showHistoryModal) fetchHistory();
  }, [fetchMetas, showHistoryModal, fetchHistory]);

  const handleDeleteImport = async () => {
    if (!showConfirmDelete) return;
    const { nome_arquivo, data_importacao } = showConfirmDelete;

    setDeleting(`${nome_arquivo}-${data_importacao}`);
    const { error } = await supabase
      .from('metas')
      .delete()
      .eq('nome_arquivo', nome_arquivo)
      .eq('data_importacao', data_importacao);

    if (error) {
      showAlert('Erro', 'Erro ao excluir importação: ' + error.message, 'danger');
    } else {
      fetchMetas();
      fetchHistory();
      showAlert('Sucesso', 'Importação excluída com sucesso!', 'success');
    }
    setDeleting(null);
    setShowConfirmDelete(null);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    showConfirm(
      'Excluir Selecionados',
      `Tem certeza que deseja excluir os ${selectedIds.size} registros selecionados? Esta ação não pode ser desfeita.`,
      async () => {
        setLoading(true);
        const { error } = await supabase
          .from('metas')
          .delete()
          .in('id', Array.from(selectedIds));

        if (error) {
          showAlert('Erro', 'Erro ao excluir registros: ' + error.message, 'danger');
        } else {
          setSelectedIds(new Set());
          fetchMetas();
          showAlert('Sucesso', 'Registros excluídos com sucesso!', 'success');
        }
        setLoading(false);
      },
      'danger'
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
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
    setPage(0);
  };

  const handleDeleteAllFiltered = async () => {
    showConfirm(
      'Excluir Tudo',
      `ATENÇÃO: Você está prestes a excluir TODOS os ${total} registros que correspondem aos filtros atuais. Deseja continuar?`,
      async () => {
        setLoading(true);
        const query = applySharedFilters(supabase.from('metas').delete());
        const { error } = await query;

        if (error) {
          showAlert('Erro', 'Erro ao excluir todos os registros: ' + error.message, 'danger');
        } else {
          fetchMetas();
          showAlert('Sucesso', 'Todos os registros filtrados foram excluídos.', 'success');
        }
        setLoading(false);
      },
      'danger'
    );
  };

  const handleExport = async () => {
    setLoading(true);
    let allData: any[] = [];
    let currentPage = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const baseQuery = supabase
        .from('metas')
        .select('*')
        .order('operacao', { ascending: true })
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

      const { data, error } = await applySharedFilters(baseQuery);

      if (error) {
        showAlert('Erro', 'Erro ao exportar dados: ' + error.message, 'danger');
        break;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          currentPage++;
        }
      } else {
        hasMore = false;
      }
    }

    if (allData.length > 0) {
      const exportData = allData.map(m => ({
        'Operação': m.operacao,
        'Vencimento': m.vencimento ? new Date(m.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '',
        'CPF/CNPJ': m.cpf,
        'Nome': m.nome_cliente,
        'Vendedor': m.vendedor,
        'Contrato': m.contrato,
        'Restam': m.restam,
        'Coef': m.coef,
        'Parcela': m.parcela_valor,
        'Troco': m.troco,
        'Data Pagamento': m.data_pagamento ? new Date(m.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '',
        'Código Cobrança': m.codigo_cobranca,
        'Cód. Fundo': m.cod_fundo,
        'Convênio': m.convenio,
        'Saldo': m.saldo,
        'Status Cliente': m.cliente_cadastrado ? 'Cadastrado' : 'Não Cadastrado',
        'CPF Válido': m.cpf_valido ? 'Sim' : 'Não',
        'Data Importação': new Date(m.data_importacao).toLocaleString('pt-BR')
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Metas');
      XLSX.writeFile(wb, `metas_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      showAlert('Aviso', 'Nenhum dado encontrado para os filtros selecionados.', 'primary');
    }
    setLoading(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === metas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(metas.map(m => m.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
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
        const data = XLSX.utils.sheet_to_json(ws, { defval: null }) as any[];

        const results: ImportResult = {
          total: data.length,
          imported: 0,
          ignored: 0,
          invalidCpf: 0,
          duplicates: 0
        };

        const findVal = (row: any, keys: string[]) => {
          for (const key of keys) {
            const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
            if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') return row[found];
          }
          return null;
        };

        const toStaging: any[] = [];
        const fileName = file.name;
        const sessionId = crypto.randomUUID();
        const importTimestamp = new Date().toISOString();
        const ignoredSellers = new Set<string>();

        for (const row of data) {
          const operacaoRaw = findVal(row, ['Operação', 'Operacao', 'op', 'cod op']);
          const operacaoId = parseInt(String(operacaoRaw || '').replace(/\D/g, ''), 10);

          const cpfRaw = findVal(row, ['CPF/CNPJ', 'CPF', 'cpf cliente']);
          const cpfDigits = String(cpfRaw || '').replace(/\D/g, '');
          if (!cpfDigits || isNaN(operacaoId) || operacaoId <= 0) {
            results.ignored++;
            continue;
          }

          const normalizedCpfDigits = cpfDigits.length <= 11 ? cpfDigits.padStart(11, '0') : cpfDigits;
          const cpf = formatCPF(normalizedCpfDigits);
          const isValidCpf = validateCPF(cpf);
          if (!isValidCpf) {
            results.invalidCpf++;
          }

          const vendedorRaw = String(findVal(row, ['Vendedor', 'Consultor']) || '').trim();
          const code = vendedorRaw.split('-')[0].trim();
          const sellerExists = code
            ? vendedoresList.some(v => v.codigo.trim() === code || v.codigo.trim() === code.padStart(2, '0'))
            : false;

          if (!sellerExists) {
            results.ignored++;
            ignoredSellers.add(vendedorRaw || 'Vazio/Não Informado');
            continue;
          }

          const restamRaw = findVal(row, ['Restam', 'Parcelas Restantes', 'Qtd Parcelas']);
          const restamNum = restamRaw !== null ? parseInt(String(restamRaw), 10) : 0;

          const codigoCobrancaRaw = findVal(row, ['Código Cobrança', 'Codigo Cobranca', 'Cod Cobranca', 'Conta de Cob.', 'Conta Cobranca']);
          const codigoCobrancaNum = codigoCobrancaRaw !== null ? parseInt(String(codigoCobrancaRaw), 10) : null;

          toStaging.push({
            operacao: operacaoId,
            vencimento: parseExcelDate(findVal(row, ['Vencimento', 'venc', 'data vencimento'])),
            cpf,
            nome_cliente: String(findVal(row, ['Nome', 'Nome Cliente', 'Cliente']) || '').trim(),
            vendedor: vendedorRaw,
            contrato: parseNumericValue(findVal(row, ['Contrato', 'Valor Contrato'])),
            restam: isNaN(restamNum) ? 0 : restamNum,
            coef: parseNumericValue(findVal(row, ['Coef', 'Coeficiente'])),
            parcela_valor: parseNumericValue(findVal(row, ['Parcela', 'Vlr Parcela'])),
            troco: parseNumericValue(findVal(row, ['Troco', 'Vlr Troco'])),
            data_pagamento: parseExcelDate(findVal(row, ['Data Pagamento', 'Data Pgto', 'Dt Pagamento'])),
            codigo_cobranca: codigoCobrancaNum !== null && !isNaN(codigoCobrancaNum) ? codigoCobrancaNum : null,
            cod_fundo: String(findVal(row, ['Cód. Fundo', 'Cod. Fundo', 'Cod Fundo', 'Fundo']) || '').trim(),
            convenio: String(findVal(row, ['Convênio', 'Convenio']) || '').trim(),
            saldo: parseNumericValue(findVal(row, ['Saldo', 'Vlr Saldo'])),
            nome_arquivo: fileName,
            import_session_id: sessionId,
            data_importacao: importTimestamp,
            cpf_valido: isValidCpf
          });
        }

        if (toStaging.length === 0) {
          showAlert(
            'Nenhum registro válido',
            'Nenhum registro válido foi encontrado na planilha. Verifique as colunas e se os vendedores estão cadastrados.',
            'danger'
          );
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const chunkSize = 500;
        for (let i = 0; i < toStaging.length; i += chunkSize) {
          const chunk = toStaging.slice(i, i + chunkSize);
          const { error: stagingError } = await supabase
            .from('metas_staging')
            .insert(chunk);

          if (stagingError) {
            console.error('Erro ao enviar bloco para staging de metas:', stagingError);
            throw stagingError;
          }
        }

        const { data: procData, error: procError } = await supabase
          .rpc('processar_importacao_metas', { p_session_id: sessionId });

        if (procError) throw procError;

        if (procData) {
          results.imported = procData.imported;
          results.duplicates = procData.duplicates;
          results.ignored += procData.ignored;
        }

        let alertMessage = `Registros Importados: ${results.imported}\nRegistros Ignorados: ${results.ignored}\nCPFs Inválidos: ${results.invalidCpf}`;
        if (ignoredSellers.size > 0) {
          alertMessage += `\n\nOs registros dos seguintes vendedores não cadastrados foram ignorados:\n- ${Array.from(ignoredSellers).join('\n- ')}`;
        }

        setShowImportModal(false);
        showAlert('Importação Concluída', alertMessage, 'success');
        setPage(0);
        fetchMetas();
      } catch (err: any) {
        console.error('Erro ao processar arquivo de metas:', err);
        showAlert('Erro', 'Erro ao processar o arquivo: ' + err.message, 'danger');
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
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>Metas</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Gerenciamento e importação de contratos de metas.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleExport}
              className="btn btn-secondary"
              title="Exportar para Excel"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FileDown size={18} /> Exportar
            </button>
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
              <Upload size={18} /> Importar Metas
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1.2', minWidth: '180px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' }}>CPF</label>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar por CPF..."
                  value={search}
                  onChange={handleSearchChange}
                  style={{ paddingLeft: '2.75rem', width: '100%' }}
                />
              </div>
            </div>
            <div style={{ flex: '1.2', minWidth: '180px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' }}>Vendedor</label>
              <select
                value={filters.vendedor}
                onChange={e => { setFilters(f => ({ ...f, vendedor: e.target.value })); setPage(0); }}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="todos">Todos</option>
                {vendedoresList.map(v => (
                  <option key={v.id} value={v.id}>{v.codigo} - {v.nome}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' }}>Status Cliente</label>
              <select
                value={filters.cliente_status}
                onChange={e => { setFilters(f => ({ ...f, cliente_status: e.target.value })); setPage(0); }}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="todos">Todos</option>
                <option value="cadastrados">Cadastrados</option>
                <option value="nao_cadastrados">Não Cadastrados</option>
              </select>
            </div>
            <div style={{ width: '140px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' }}>Data Início</label>
              <input
                type="date"
                value={filters.data_inicio}
                onChange={e => { setFilters(f => ({ ...f, data_inicio: e.target.value })); setPage(0); }}
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
            <div style={{ width: '140px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' }}>Data Fim</label>
              <input
                type="date"
                value={filters.data_fim}
                onChange={e => { setFilters(f => ({ ...f, data_fim: e.target.value })); setPage(0); }}
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
            <div style={{ width: '130px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' }}>Validez CPF</label>
              <select
                value={filters.validez}
                onChange={e => { setFilters(f => ({ ...f, validez: e.target.value })); setPage(0); }}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="todos">Todos</option>
                <option value="validos">Válidos</option>
                <option value="invalidos">Inválidos</option>
              </select>
            </div>
            <button
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '42px', padding: '0 1.5rem' }}
              onClick={() => fetchMetas()}
            >
              <Filter size={18} /> Filtrar
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="card animate-fade-in" style={{
            marginBottom: '1.5rem',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-primary-light)',
            border: '1px solid var(--color-primary)',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
              {selectedIds.size} {selectedIds.size === 1 ? 'registro selecionado' : 'registros selecionados'}
            </span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setSelectedIds(new Set())} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>Cancelar</button>
              <button onClick={handleDeleteSelected} className="btn btn-danger" style={{ padding: '0.5rem 1rem' }}>Excluir Selecionados</button>
            </div>
          </div>
        )}

        {selectedIds.size === 0 && (search || filters.nome_arquivo || filters.data_inicio || filters.data_fim || filters.validez !== 'todos' || filters.vendedor !== 'todos' || filters.cliente_status !== 'todos') && total > 0 && (
          <div style={{ marginBottom: '1.5rem', textAlign: 'right' }}>
            <button
              onClick={handleDeleteAllFiltered}
              className="btn btn-danger"
              style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}
            >
              <Trash2 size={14} /> Excluir todos os {total} resultados da busca
            </button>
          </div>
        )}

        {/* Table */}
        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>Carregando metas...</div>
          ) : metas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Nenhuma meta encontrada.</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '30px', paddingRight: '0' }}>
                        <button
                          onClick={toggleSelectAll}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex', alignItems: 'center' }}
                        >
                          {selectedIds.size === metas.length && metas.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </th>
                      <th style={{ paddingLeft: '0.5rem', width: '90px' }}>Operação</th>
                      <th style={{ width: '100px' }}>Vencimento</th>
                      <th style={{ width: '140px' }}>CPF</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Cliente</th>
                      <th style={{ width: '160px' }}>Vendedor</th>
                      <th style={{ width: '90px' }}>Status CPF</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>Restam</th>
                      <th style={{ width: '110px' }}>Parcela</th>
                      <th style={{ width: '110px' }}>Saldo</th>
                      <th style={{ width: '150px' }}>Importado em</th>
                      <th style={{ width: '50px', textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metas.map((m) => (
                      <tr key={m.id} style={{ backgroundColor: selectedIds.has(m.id) ? 'var(--color-primary-light)' : 'transparent' }}>
                        <td style={{ paddingRight: '0' }}>
                          <button
                            onClick={() => toggleSelectRow(m.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex', alignItems: 'center' }}
                          >
                            {selectedIds.has(m.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.8rem', paddingLeft: '0.5rem' }}>{m.operacao}</td>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {m.vencimento
                            ? new Date(m.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')
                            : 'Sem Data'}
                        </td>
                        <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {m.cpf}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(m.cpf);
                                showAlert('Copiado', 'CPF copiado para a área de transferência!', 'success');
                              }}
                              style={{ background: 'transparent', border: 'none', padding: '0.25rem', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
                              title="Copiar CPF"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                            {m.cliente_cadastrado ? (
                              <span title={`Cliente Cadastrado: ${m.nome_cliente || ''}`} style={{ color: 'var(--color-success)' }}><UserCheck size={18} /></span>
                            ) : (
                              <span title={`Cliente Não Cadastrado: ${m.nome_cliente || ''}`} style={{ color: 'var(--color-danger)' }}><UserMinus size={18} /></span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {getVendedorDisplay(m.vendedor)}
                        </td>
                        <td>
                          <span className={`badge ${m.cpf_valido ? 'badge-success' : 'badge-danger'}`}>
                            {m.cpf_valido ? 'Válido' : 'Inválido'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{m.restam ?? 0}</td>
                        <td style={{ fontWeight: 500 }}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.parcela_valor || 0)}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.saldo || 0)}
                        </td>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Clock size={14} style={{ flexShrink: 0 }} />
                            {new Date(m.data_importacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Link
                            href={`/metas/${m.id}`}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem', background: 'transparent', border: 'none', color: 'var(--color-primary)', display: 'inline-flex' }}
                            title="Visualizar Detalhes"
                          >
                            <Eye size={18} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    Total: {total} metas — Página {page + 1} de {totalPages}
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
                <FileSpreadsheet className="text-primary" /> Importar Metas
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
                      Modelo: metas.xlsx
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
                      <AlertCircle size={14} /> Campos esperados:
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                      Operação, Vencimento, CPF/CNPJ, Nome, Vendedor, Contrato, Restam, Coef, Parcela, Troco, Data Pagamento, Código Cobrança, Cód. Fundo, Convênio e Saldo.
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
                  <button
                    onClick={() => { setShowImportModal(false); setImportResult(null); }}
                    className="btn btn-primary"
                    style={{ width: '100%' }}
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
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <AlertCircle size={32} />
            </div>
            <h3 style={{ marginBottom: '1rem' }}>Excluir Importação?</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Tem certeza que deseja excluir todos os <strong>{showConfirmDelete.total_registros} registros</strong> do arquivo
              <br /><strong>&quot;{showConfirmDelete.nome_arquivo}&quot;</strong>?
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

      <ConfirmModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        confirmType={notification.type}
        onConfirm={notification.onConfirm || (() => { })}
        onCancel={notification.onCancel}
        confirmText={notification.confirmText || 'OK'}
      />
    </>
  );
}

