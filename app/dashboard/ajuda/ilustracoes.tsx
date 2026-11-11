'use client';

// Ilustrações da Central de ajuda (11/11/2026): miniatura da tela com os pontos do artigo
// numerados. Vale para os artigos SEM demonstração clicável (ver demos.tsx).
// Rótulos tirados do próprio texto do artigo — mudou o artigo, muda aqui.
// Valores (R$, contagens) são de exemplo e a legenda diz isso.

import type { ReactNode } from 'react';

type N = number | undefined;
type Parte =
  | { k: 'topo'; titulo: string; botoes?: [string, N?][] }
  | { k: 'campos'; itens: [string, string, N?][] }
  | { k: 'linhas'; itens: [string, string?, N?][] }
  | { k: 'cards'; itens: [string, string, N?][] }
  | { k: 'nums'; itens: [string, string, N?][] }
  | { k: 'chips'; rotulo: string; itens: string[]; on?: number; n?: N }
  | { k: 'nota'; texto: string; tom?: 'tint' | 'warn'; n?: N };

type Ilus = { tela: string; partes: Parte[]; legenda: string[]; exemplo?: boolean };

function Marca({ n }: { n: N }) {
  if (!n) return null;
  return (
    <span aria-hidden className="absolute -top-2.5 -right-2.5 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-extrabold z-10"
      style={{ background: 'var(--accent-fill)', color: 'var(--on-accent)', boxShadow: '0 0 0 3px var(--bg-surface)' }}>{n}</span>
  );
}

const realce = (n: N) => (n ? { boxShadow: 'inset 0 0 0 2px var(--accent)' } : {});

function ParteView({ p }: { p: Parte }): ReactNode {
  switch (p.k) {
    case 'topo':
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-extrabold mr-auto" style={{ color: 'var(--text-primary)' }}>{p.titulo}</span>
          {p.botoes?.map(([t, n], i) => (
            <span key={i} className="relative">
              <span className={`ui-btn ui-btn-sm ${n ? 'ui-btn-primary' : 'ui-btn-secondary'} pointer-events-none`}>{t}</span>
              <Marca n={n} />
            </span>
          ))}
        </div>
      );
    case 'campos':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {p.itens.map(([r, v, n], i) => (
            <div key={i} className="relative ui-inset px-3 py-2" style={realce(n)}>
              <span className="block text-[11px]" style={{ color: 'var(--text-secondary)' }}>{r}</span>
              <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{v}</span>
              <Marca n={n} />
            </div>
          ))}
        </div>
      );
    case 'linhas':
      return (
        <div className="ui-inset">
          {p.itens.map(([t, extra, n], i) => (
            <div key={i} className="relative flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl" style={{ borderTop: i ? '1px solid var(--border)' : 'none', ...realce(n) }}>
              <span className="flex-1" style={{ color: 'var(--text-primary)' }}>{t}</span>
              {extra && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{extra}</span>}
              {n && <span className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-extrabold" style={{ background: 'var(--accent-fill)', color: 'var(--on-accent)' }}>{n}</span>}
            </div>
          ))}
        </div>
      );
    case 'cards':
      return (
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
          {p.itens.map(([t, s, n], i) => (
            <div key={i} className="relative rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', ...realce(n) }}>
              <span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t}</span>
              <span className="block text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{s}</span>
              <Marca n={n} />
            </div>
          ))}
        </div>
      );
    case 'nums':
      return (
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          {p.itens.map(([r, v, n], i) => (
            <div key={i} className="relative ui-inset px-3 py-2.5" style={realce(n)}>
              <span className="block text-[11px]" style={{ color: 'var(--text-secondary)' }}>{r}</span>
              <span className="block ui-big !text-xl">{v}</span>
              <Marca n={n} />
            </div>
          ))}
        </div>
      );
    case 'chips':
      return (
        <div className="relative flex flex-wrap items-center gap-2 rounded-xl px-3 py-2" style={realce(p.n)}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.rotulo}</span>
          {p.itens.map((t, i) => <span key={i} className={`ui-chip ${p.on === i ? 'ui-chip-on' : ''}`}>{t}</span>)}
          <Marca n={p.n} />
        </div>
      );
    case 'nota':
      return (
        <div className="relative rounded-xl px-3 py-2.5 text-sm" style={{ ...(p.tom === 'warn' ? { border: '1px solid var(--border-md)', color: 'var(--badge-warn-text)' } : { background: 'var(--tint-bg)', color: 'var(--tint-ink)' }), ...realce(p.n) }}>
          {p.texto}
          <Marca n={p.n} />
        </div>
      );
  }
}

export function Ilustracao({ id }: { id: string }) {
  const il = ILUSTRACOES[id];
  if (!il) return null;
  return (
    <figure className="mx-0 mt-0 space-y-3" aria-label={`Ilustração: ${il.tela}`}>
      <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-surface))', border: '1px solid var(--border-md)' }}>
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span aria-hidden className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--border-control)' }} />)}</span>
          <span className="eyebrow ml-2" style={{ color: 'var(--text-secondary)' }}>{il.tela.toUpperCase()}</span>
        </div>
        <div aria-hidden className="p-4 sm:p-5 flex flex-col gap-3">
          {il.partes.map((p, i) => <ParteView key={i} p={p} />)}
        </div>
      </div>
      <figcaption>
        <ol className="grid gap-2 sm:grid-cols-2">
          {il.legenda.map((t, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-extrabold" style={{ background: 'var(--accent-fill)', color: 'var(--on-accent)' }}>{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        {il.exemplo && <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>Valores de exemplo.</p>}
      </figcaption>
    </figure>
  );
}

export const ILUSTRACOES: Record<string, Ilus> = {
  'primeiros-passos': {
    tela: 'CRM',
    partes: [
      { k: 'topo', titulo: 'CRM', botoes: [['⚙ Configurar', 2], ['Conectar WhatsApp', 3]] },
      { k: 'cards', itens: [['Novo Lead', 'Etapa 1'], ['Em contato', 'Etapa 2'], ['Orçamento enviado', 'Etapa 3']] },
      { k: 'nota', texto: 'Ativar o CRM da empresa (só na primeira vez)', n: 1 },
    ],
    legenda: ['Ative o CRM da empresa na primeira vez.', 'Em ⚙ Configurar › Editar funil, deixe as etapas com a cara da sua venda.', 'Conecte o WhatsApp de cada vendedor pelo QR Code.'],
  },
  equipe: {
    tela: 'Usuários',
    partes: [
      { k: 'topo', titulo: 'Usuários', botoes: [['Novo Usuário', 1]] },
      { k: 'campos', itens: [['Nome', 'Vendedor da loja'], ['E-mail', 'vendas@empresa.com.br'], ['Senha temporária', '••••••••', 2], ['Função', 'Usuário', 3]] },
      { k: 'nota', texto: 'O número de usuários depende do plano.', tom: 'warn', n: 4 },
    ],
    legenda: ['Abra Usuários e clique em Novo Usuário.', 'A senha é temporária: a pessoa troca depois em Minha conta.', 'Usuário para quem atende, Viewer para quem só acompanha.', 'Se o botão recusar, veja o limite em Assinatura.'],
  },
  'crm-como-funciona': {
    tela: 'Card do cliente',
    partes: [
      { k: 'campos', itens: [['Cliente', 'Cliente da loja · (85) 9 ••••-1234', 1], ['LTV', 'R$ 4.250,00', 3]] },
      { k: 'linhas', itens: [['Venda · Ganha', 'R$ 2.400,00', 2], ['Venda · Ganha', 'R$ 1.850,00'], ['Venda · Aberta', 'R$ 640,00']] },
    ],
    legenda: ['O card é a pessoa: o mesmo telefone abre sempre o mesmo card.', 'Cada compra é uma venda separada; a recompra não apaga a anterior.', 'O LTV é a soma das vendas ganhas.'],
    exemplo: true,
  },
  'crm-configurar': {
    tela: 'CRM › ⚙ Configurar',
    partes: [
      { k: 'topo', titulo: 'CRM', botoes: [['⚙ Configurar', 1]] },
      { k: 'linhas', itens: [['Editar funil', 'etapas, cores e 🔒', 2], ['Tags', 'Quente, VIP, Carteira'], ['Origens (dentro de "Outro")', 'Loja, Fachada'], ['Motivos de perda (venda)'], ['Motivos de descarte (lead)'], ['Tipos de cliente', 'Pessoa Física, Construtora']] },
      { k: 'nota', texto: 'Remover uma opção não mexe nos cards antigos.', n: 3 },
    ],
    legenda: ['Tudo fica no botão ⚙ Configurar, no topo do CRM.', 'O cadeado marca a partir de onde o card precisa de venda com valor.', 'Os cards antigos guardam o que tinham na época.'],
  },
  'crm-card': {
    tela: 'Card do cliente',
    partes: [
      { k: 'nota', texto: 'Nota fixada: cliente prefere contato depois das 14h', n: 3 },
      { k: 'campos', itens: [['Cidade', 'Fortaleza', 1], ['Follow-up', 'Hoje · Amanhã · +3 dias', 2], ['Responsável', 'Vendedor da loja', 5], ['Tipo de cliente', 'Construtora']] },
      { k: 'linhas', itens: [['Mudou de etapa: Em contato → Orçamento enviado', 'hoje', 4], ['Venda aberta', 'ontem']] },
    ],
    legenda: ['Clique no valor para editar. Enter salva, Esc cancela.', 'Follow-up é o próximo contato, com atalhos.', 'Use Fixar para a nota ficar no topo do card.', 'O histórico registra tudo sozinho, com quem e quando.', 'Só o gestor transfere o card para outra pessoa.'],
  },
  'crm-origem': {
    tela: 'Card do cliente › Origem',
    partes: [
      { k: 'chips', rotulo: 'Origem', itens: ['Meta Ads', 'Google Ads', 'WhatsApp', 'Indicação', 'Link da bio', 'Direct', 'Outro'], on: 6, n: 1 },
      { k: 'linhas', itens: [['Loja', undefined, 2], ['Fachada'], ['Landing page'], ['+ Cadastrar outra origem', 'só gestor', 3]] },
    ],
    legenda: ['As opções fixas são iguais para todas as empresas.', 'Outro abre as origens do seu negócio.', 'O gestor cadastra uma origem nova pelo próprio card.'],
  },
  'crm-direct': {
    tela: 'Integrações',
    partes: [
      { k: 'cards', itens: [['Direct do Instagram', 'Conectar', 1], ['Formulários da Meta', 'Conectado'], ['Meta Ads', 'Conectado']] },
      { k: 'campos', itens: [['Card', 'Novo contato'], ['Instagram', '@perfil.do.cliente', 2]] },
      { k: 'nota', texto: 'Conversa só leitura · Abrir no Instagram para responder', n: 3 },
    ],
    legenda: ['Em Integrações, no card Direct do Instagram, clique em conectar.', 'Quem manda Direct vira card, com o @ no lugar do telefone.', 'Por enquanto, responda pelo botão Abrir no Instagram.'],
  },
  'crm-formularios': {
    tela: 'Integrações › Formulários da Meta',
    partes: [
      { k: 'cards', itens: [['Formulários da Meta', 'Conectar com o Facebook', 1], ['Página', 'Página da empresa', 2], ['Último formulário', 'Virou card · hoje']] },
      { k: 'campos', itens: [['Nome', 'Novo contato'], ['Telefone', '(85) 9 ••••-1234', 3], ['E-mail', 'contato@email.com']] },
      { k: 'nota', texto: 'Outras respostas viram uma nota fixada no card.' },
    ],
    legenda: ['Conecte com o Facebook no card Formulários da Meta.', 'Escolha a página que roda os anúncios de formulário.', 'Sem telefone não vira card: o CRM precisa do número.'],
  },
  'crm-contatos': {
    tela: 'CRM › Contatos',
    partes: [
      { k: 'topo', titulo: 'Contatos', botoes: [['Buscar nome, telefone ou @', 1], ['Chegada', 2]] },
      { k: 'chips', rotulo: 'Chegaram no período:', itens: ['Meta Ads 12', 'WhatsApp 8', 'Google Ads 5'], on: 0 },
      { k: 'linhas', itens: [['Novo contato', 'Em contato', 3], ['Cliente da loja', 'Venda ganha'], ['Lead novo', 'Descartado']] },
    ],
    legenda: ['A busca aceita nome, telefone e @ do Instagram.', 'Chegada mostra quantos vieram de cada canal; clicar filtra.', 'Clicar numa linha abre o card.'],
    exemplo: true,
  },
  'crm-produtos': {
    tela: 'CRM › Produtos',
    partes: [
      { k: 'topo', titulo: 'Produtos', botoes: [['Novo produto', 1]] },
      { k: 'campos', itens: [['Nome', 'Produto A', 2], ['Código (opcional)', 'PA-01'], ['Preço', 'R$ 129,90']] },
      { k: 'linhas', itens: [['Produto B', 'Desativado', 3]] },
      { k: 'nota', texto: 'Na nova venda aparece a opção Por produtos.' },
    ],
    legenda: ['Abra CRM › Produtos e clique em Novo produto.', 'Informe nome, código (opcional) e preço.', 'Saiu de linha? Desative: as vendas antigas guardam nome e preço.'],
    exemplo: true,
  },
  'crm-relatorio': {
    tela: 'CRM › Relatório',
    partes: [
      { k: 'chips', rotulo: 'Período', itens: ['Este mês', '3 meses', '6 meses', '12 meses', 'De/até'], on: 1, n: 1 },
      { k: 'nums', itens: [['Vendas ganhas', '9'], ['Receita', 'R$ 18.400,00'], ['Win rate', '41%', 2], ['Ciclo médio', '12 dias']] },
      { k: 'linhas', itens: [['Conversão por etapa', 'onde os negócios se perdem', 3], ['Tempo em cada etapa', 'onde travam'], ['Por vendedor', 'ganhas, receita, ticket']] },
    ],
    legenda: ['Escolha o período no topo do relatório.', 'O resumo traz vendas, receita, win rate, ticket e ciclo.', 'Conversão baixa + muito tempo parado = onde agir.'],
    exemplo: true,
  },
  'crm-avisos': {
    tela: 'Minha conta › Avisos no celular',
    partes: [
      { k: 'nota', texto: 'iPhone: Safari › Compartilhar › Adicionar à Tela de Início', n: 1 },
      { k: 'topo', titulo: 'Avisos no celular', botoes: [['Ativar', 2], ['Enviar aviso de teste', 3]] },
      { k: 'linhas', itens: [['Mensagem nova nos seus cards'], ['Conversa sem resposta há 4 horas', '7h às 21h'], ['Resumo do dia', '8h, seg a sáb']] },
    ],
    legenda: ['No iPhone, adicione o site à Tela de Início antes.', 'Em Minha conta › Avisos no celular, toque em Ativar.', 'Envie um aviso de teste para conferir.'],
  },
  'crm-importar': {
    tela: 'CRM › ⚙ Configurar',
    partes: [
      { k: 'linhas', itens: [['Importar clientes (CSV)', undefined, 1], ['Exportar clientes (CSV)', undefined, 3]] },
      { k: 'linhas', itens: [['nome · telefone · email · tags · origem', 'cabeçalho na 1ª linha', 2], ['Novo contato · 85999991234 · · VIP · meta'], ['Cliente da loja · 85988881234 · · · whatsapp']] },
    ],
    legenda: ['⚙ Configurar › Importar clientes (CSV), confira a prévia e confirme.', 'nome e telefone são obrigatórios; até 2.000 linhas por vez.', 'Exportar baixa a carteira inteira, pronta para o Excel.'],
  },
  'perfil-empresa': {
    tela: 'Perfil da empresa',
    partes: [
      { k: 'nums', itens: [['Nota', '62 / 100', 1], ['Faixa', 'Prata']] },
      { k: 'campos', itens: [['O que vende', 'Corte e dobra de aço para obras em Fortaleza', 2], ['Cliente ideal', '[responda com o seu]'], ['Diferencial', '[responda com o seu]'], ['O que é um lead bom', '[responda com o seu]']] },
      { k: 'nota', texto: 'Resposta vaga volta com uma pergunta mais específica.', n: 3 },
    ],
    legenda: ['A nota de 0 a 100 mostra o que falta para subir.', 'Seja concreto: isso é o que a IA lê sobre o negócio.', 'Nenhum campo é obrigatório.'],
    exemplo: true,
  },
  dashboard: {
    tela: 'Dashboard',
    partes: [
      { k: 'chips', rotulo: 'Aba', itens: ['Vendas e CRM', 'Anúncios', 'Evolução', 'Análise da IA'], on: 0, n: 1 },
      { k: 'chips', rotulo: 'Período', itens: ['7D', '30D', '90D', 'Este mês', 'Mês passado', 'Personalizado'], on: 1, n: 2 },
      { k: 'nums', itens: [['Contatos', 'pela chegada', 3], ['Vendas', 'pelo fechamento'], ['Pipeline', 'hoje']] },
    ],
    legenda: ['Escolha a aba: cada uma responde uma pergunta.', 'O período vale para a aba inteira.', 'Cada número conta por uma data diferente: veja a tabela abaixo.'],
  },
  'dashboard-anuncios': {
    tela: 'Dashboard › Anúncios',
    partes: [
      { k: 'nums', itens: [['CPL', 'R$ 24,50', 1], ['ROAS atribuído', '4,2x', 2], ['ROAS plataformas', '6,8x'], ['Alcance', '48.200']] },
      { k: 'linhas', itens: [['Top campanhas por gasto', 'Configurar colunas', 3], ['Campanha de mensagem', 'R$ 1.200,00 · 49 leads'], ['Campanha de tráfego', 'R$ 640,00 · —']] },
    ],
    legenda: ['CPL divide o gasto pelos leads aceitos no CRM.', 'ROAS atribuído só conta venda que veio de anúncio.', 'Clique na campanha para ver conjuntos e anúncios.'],
    exemplo: true,
  },
  'relatorios-auto': {
    tela: 'Relatórios Auto.',
    partes: [
      { k: 'topo', titulo: 'Relatórios automáticos', botoes: [['Conectar Telegram', 1], ['Conectar WhatsApp de relatórios']] },
      { k: 'campos', itens: [['Canal e destino', 'WhatsApp · grupo da diretoria', 2], ['Frequência', 'Semanal · segunda 08:00'], ['Mensagem', 'Modelo padrão', 3]] },
      { k: 'linhas', itens: [['CRM: WhatsApp sem resposta', 'ligado'], ['CRM: digest de follow-ups', 'ligado']] },
    ],
    legenda: ['Conecte o canal uma vez, pelo QR Code.', 'Em Novo agendamento de relatório, escolha canal, destino e frequência.', 'Use o modelo padrão ou escreva o seu texto com as variáveis.'],
  },
  'integracoes-anuncios': {
    tela: 'Integrações',
    partes: [
      { k: 'cards', itens: [['Meta Ads', 'Conectar', 1], ['Google Ads', 'Conectar'], ['Dados Manuais de Receita', 'sem CRM']] },
      { k: 'campos', itens: [['Conta de anúncios', 'Conta da empresa', 2], ['Saldo da conta', 'R$ 1.200,00']] },
      { k: 'nota', texto: 'Confira o nome da conta antes de confirmar.', tom: 'warn', n: 3 },
    ],
    legenda: ['Clique em Conectar no card da Meta Ads ou do Google Ads.', 'Com mais de uma conta, escolha a da empresa no próprio card.', 'Conta errada mistura o dado de outro anunciante no painel.'],
    exemplo: true,
  },
  'relatorio-ia': {
    tela: 'Relatórios',
    partes: [
      { k: 'topo', titulo: 'Relatório da IA', botoes: [['Gerar relatório', 1], ['Exportar PDF', 3]] },
      { k: 'linhas', itens: [['Resumo executivo', undefined, 2], ['Alertas prioritários'], ['Recomendações']] },
      { k: 'nota', texto: 'Compara campanhas só dentro do mesmo objetivo. Não opina sobre verba.' },
    ],
    legenda: ['Clique em Gerar relatório: leva alguns segundos.', 'Leia o resumo, os alertas e as recomendações.', 'Exporte em PDF para mandar para alguém.'],
  },
  criativos: {
    tela: 'Criativos',
    partes: [
      { k: 'cards', itens: [['Análise Criativa', 'o que os melhores têm em comum'], ['Geração de Ideias', 'ângulos e formatos'], ['Briefing Automatizado', 'objetivo, público, ângulo', 1], ['Copy & Variações', 'versões para teste A/B', 2], ['Inteligência Competitiva', 'o que os concorrentes anunciam', 3]] },
    ],
    legenda: ['No Briefing Automatizado, escolha a campanha e gere.', 'Gerar copy a partir deste briefing: a copy sai alinhada a ele.', 'Cadastre a página no Facebook de cada concorrente.'],
  },
  seo: {
    tela: 'SEO / AIO',
    partes: [
      { k: 'topo', titulo: 'SEO / AIO', botoes: [['Configurar URLs', 1], ['Analisar agora', 2]] },
      { k: 'linhas', itens: [['O que resolver no seu site', 'em ordem de importância', 3], ['Performance', 'velocidade no celular'], ['Como o ChatGPT e outras IAs enxergam seu site'], ['Comparativo com concorrentes']] },
    ],
    legenda: ['Informe o site da empresa (e, se quiser, os dos concorrentes).', 'A análise roda todo mês; dá para pedir uma por mês.', 'Comece pela lista do que resolver no site.'],
  },
  'gestor-trafego': {
    tela: 'Gestão',
    partes: [
      { k: 'topo', titulo: 'Gestão', botoes: [['Criar Dashboard de Cliente', 1]] },
      { k: 'campos', itens: [['Cliente', 'Nome do cliente'], ['Meta Ads', 'Conta do cliente', 2], ['Google Ads', 'Não usar']] },
      { k: 'linhas', itens: [['Abrir dashboard'], ['Convidar cliente', 'link de acesso próprio', 3], ['Briefing Semanal Automático', 'Telegram']] },
    ],
    legenda: ['Em Gestão, clique em Criar Dashboard de Cliente.', 'Escolha a conta Meta Ads e/ou Google Ads dele (ou Não usar).', 'Convidar cliente gera o link para ele criar o acesso.'],
  },
  'minha-conta': {
    tela: 'Minha conta',
    partes: [
      { k: 'campos', itens: [['Seus dados', 'nome, telefone e foto', 1], ['Senha', 'trocar desconecta os outros aparelhos', 2], ['E-mail', 'vale depois de confirmar o link', 3], ['Aparelhos conectados', '2 aparelhos', 4]] },
    ],
    legenda: ['Nome, telefone e foto.', 'Trocar a senha desconecta os outros aparelhos.', 'O novo e-mail só vale depois de confirmar o link.', 'Veja onde a conta está aberta e saia dos outros.'],
  },
  assinatura: {
    tela: 'Assinatura',
    partes: [
      { k: 'chips', rotulo: 'Ciclo', itens: ['Mensal', 'Semestral · até 6x', 'Anual · até 12x'], on: 2, n: 1 },
      { k: 'chips', rotulo: 'Pagamento', itens: ['PIX', 'Boleto', 'Cartão'], on: 0, n: 2 },
      { k: 'nota', texto: 'O acesso vale até o dia do vencimento da fatura.', n: 3 },
    ],
    legenda: ['Semestral e anual parcelam no cartão, sem juros, e não renovam sozinhos.', 'PIX libera em segundos; boleto, em até 3 dias úteis.', 'Cancelou? O acesso continua até o fim do período pago.'],
  },
};
