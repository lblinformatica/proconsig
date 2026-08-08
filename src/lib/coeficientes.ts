export interface Coeficiente {
  id: string;
  prazo: number;
  coef_min: number;
  coef_max: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Retorna o prazo correspondente com base na tabela de coeficientes dinâmicos do banco de dados.
 * @param coef Coeficiente calculado (numérico, ex: 0.380)
 * @param coeficientes Lista de coeficientes ativos vinda do Supabase
 */
export function getPrazoByCoef(coef: number, coeficientes: Coeficiente[]): number | string {
  if (!coef || isNaN(coef) || !Array.isArray(coeficientes)) return '';
  const rounded = Math.round(coef * 1000) / 1000;
  const match = coeficientes.find(c => {
    if (c.ativo === false) return false;
    const min = Number(c.coef_min);
    const max = Number(c.coef_max);
    return rounded >= min && rounded <= max;
  });
  return match ? match.prazo : '';
}
