// Abas do dashboard (feedback do Ruan, 28/10/2026): a tela inicial tinha tudo junto —
// anúncio, CRM, IA — e o cliente que queria ver uma coisa só rolava a página inteira.
// Fonte única das abas: a página, o submenu do Dashboard e a busca leem daqui.

export type AbaDashboard = 'anuncios' | 'vendas' | 'evolucao' | 'ia';

// `busca`: o que existe dentro da aba, para a busca do menu achar "ranking" e levar
// para a aba certa. Quem acrescentar seção numa aba acrescenta o nome dela aqui.
export const ABAS_DASHBOARD: { key: AbaDashboard; label: string; soGrowth: boolean; busca: string[] }[] = [
  { key: 'anuncios', label: 'Anúncios', soGrowth: true,
    busca: ['Meta Ads', 'Google Ads', 'Gasto', 'Impressões', 'Cliques', 'CTR', 'CPC', 'CPM', 'Alcance', 'Frequência', 'Visitas ao perfil do Instagram', 'Custo por resultado', 'Conversões das plataformas', 'Top campanhas', 'CPL por canal'] },
  { key: 'vendas', label: 'Vendas e CRM', soGrowth: false,
    busca: ['Cadeia do funil', 'Resultado consolidado', 'ROAS atribuído', 'Receita fechada', 'Ticket médio', 'Meta do mês', 'Funil de vendas', 'Origem dos leads', 'Motivos de perda', 'Ciclo de venda', 'Comparativo de canais', 'Saúde do CRM', 'Ranking de vendedores', 'Pipeline em negociação', 'LTV', 'Projeção do mês', 'ROAS por canal', 'Dados manuais'] },
  { key: 'evolucao', label: 'Evolução', soGrowth: true,
    busca: ['Histórico mês a mês', 'Investimento por mês', 'Leads por mês', 'Retorno por mês'] },
  { key: 'ia', label: 'Análise da IA', soGrowth: true,
    busca: ['Inteligência de IA', 'Relatório da IA', 'Recomendações', 'Score de saúde'] },
];

export const hrefAba = (aba: AbaDashboard) => `/dashboard?aba=${aba}`;

// Aba que abre quando a URL não diz qual. No plano CRM a de anúncios é cadeado,
// então abrir nela seria abrir o dashboard numa tela bloqueada.
export function abaDaUrl(valor: string | null, temGrowth: boolean): AbaDashboard {
  const aba = ABAS_DASHBOARD.find((a) => a.key === valor);
  if (aba) return aba.key;
  return temGrowth ? 'anuncios' : 'vendas';
}
