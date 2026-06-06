'use client';

// Format CEP (00000-000)
export function formatCEP(val: string): string {
  return val
    .replace(/\D/g, '')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{3})\d+?$/, '$1');
}

// Format Phone ((XX) XXXXX-XXXX or (XX) XXXX-XXXX)
export function formatPhone(val: string): string {
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 10) {
    return clean
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  } else {
    return clean
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  }
}

// Format Money (e.g. 1.234,56)
export function formatMoney(val: string): string {
  const clean = val.replace(/\D/g, '');
  if (!clean) return '0,00';
  const cents = parseInt(clean);
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Parse formatted money back to number
export function parseMoneyToNumber(val: string): number {
  if (!val) return 0;
  const normalized = val.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}
