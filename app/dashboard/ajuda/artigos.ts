// Conteúdo da Central de ajuda (10/11/2026, pedido do Benny).
//
// `soGrowth: true` = só aparece para quem tem o plano completo. Quem assina o plano CRM
// não vê o artigo (nem na busca) — a regra do plano é `usePlano().temGrowth`, a mesma do menu.
// O mesmo vale para um bloco solto dentro de um artigo comum (`soGrowth` no bloco).
//
// Texto: `**negrito**` é o único marcador. Nome de botão/tela entre aspas ou em negrito,
// sempre igual ao que está na tela — conferir no código antes de mudar.
// Mudou uma tela? O artigo dela muda junto.

export type Modulo = 'inicio' | 'dashboard' | 'crm' | 'anuncios' | 'conta';

export type Bloco =
  | { tipo: 'texto'; titulo?: string; texto: string; soGrowth?: boolean }
  | { tipo: 'passos'; titulo?: string; itens: string[]; soGrowth?: boolean }
  | { tipo: 'lista'; titulo?: string; itens: string[]; soGrowth?: boolean }
  | { tipo: 'dica'; titulo?: string; texto: string; soGrowth?: boolean }
  | { tipo: 'atencao'; titulo?: string; texto: string; soGrowth?: boolean }
  | { tipo: 'tabela'; titulo?: string; colunas: string[]; linhas: string[][]; soGrowth?: boolean };

export interface Artigo {
  id: string;
  modulo: Modulo;
  titulo: string;
  resumo: string;
  /** Só para o plano completo (some para o plano CRM). */
  soGrowth?: boolean;
  /** Ação de gestor (ADMIN). O vendedor vê o artigo com o selo. */
  soGestor?: boolean;
  /** Só aparece para quem tem este papel (ex.: o artigo do gestor de tráfego). */
  soPapel?: 'TRAFFIC_MANAGER';
  tela?: { href: string; nome: string };
  /** Palavras que a busca também aceita (sinônimos, nomes antigos). */
  termos?: string[];
  blocos: Bloco[];
}

export const MODULOS: { key: Modulo; label: string }[] = [
  { key: 'inicio', label: 'Primeiros passos' },
  { key: 'dashboard', label: 'Dashboard e relatórios' },
  { key: 'crm', label: 'CRM' },
  { key: 'anuncios', label: 'Anúncios e IA' },
  { key: 'conta', label: 'Conta e assinatura' },
];

export const ARTIGOS: Artigo[] = [
  // ── Primeiros passos ──────────────────────────────────────────────────────
  {
    id: 'primeiros-passos',
    modulo: 'inicio',
    titulo: 'Primeiros passos',
    resumo: 'O que configurar no primeiro dia para a plataforma trabalhar por você.',
    termos: ['começar', 'configurar', 'implantação', 'onboarding'],
    blocos: [
      { tipo: 'texto', texto: 'Dá para colocar tudo de pé sozinho, sem implantação guiada. Siga nesta ordem: cada passo deixa o próximo mais útil.' },
      {
        tipo: 'passos',
        titulo: 'No CRM',
        itens: [
          'Abra **CRM** no menu e ative o CRM da empresa (só na primeira vez).',
          'Em **⚙ Configurar › Editar funil**, deixe as etapas com a cara da sua venda (ex.: Novo Lead → Em contato → Orçamento enviado → Negociando).',
          'Clique em **Conectar WhatsApp** e leia o QR Code no celular. Cada vendedor conecta o próprio número.',
          'Em **Usuários**, cadastre quem vai atender (veja "Equipe e permissões").',
          'Ligue os **Avisos no celular** em Minha conta, para saber de lead novo na hora.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Nos anúncios',
        soGrowth: true,
        itens: [
          'Em **Integrações**, conecte a Meta e o Google Ads e escolha a conta de anúncios de cada um.',
          'Preencha o **Perfil da empresa**: o que vende, cliente ideal, diferencial. É isso que a IA lê antes de escrever qualquer análise.',
          'Em **Rastreio**, confira se os anúncios estão aparecendo: é ali que o lead do WhatsApp ganha o anúncio que o trouxe.',
          'Em **Relatórios Auto.**, agende o resumo semanal no Telegram ou no WhatsApp.',
        ],
      },
      { tipo: 'dica', titulo: 'Rotina que funciona', texto: 'De manhã: resolva o painel **Tarefas** (vencidas primeiro), responda os **Não respondidos**, depois os follow-ups do dia. Antes de fechar cada conversa, deixe um próximo passo marcado. Card sem próximo passo é venda esfriando.' },
    ],
  },
  {
    id: 'equipe',
    modulo: 'inicio',
    titulo: 'Equipe e permissões',
    resumo: 'Cadastrar vendedores e entender o que cada um pode fazer.',
    soGestor: true,
    tela: { href: '/dashboard/users', nome: 'Usuários' },
    termos: ['vendedor', 'convidar', 'usuário', 'acesso', 'viewer', 'papel', 'função'],
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Abra **Usuários** e clique em **Novo Usuário**.',
          'Informe nome, e-mail e uma senha temporária. A pessoa troca a senha depois, em Minha conta.',
          'Escolha a função: **Usuário** para quem atende (vendedor) ou **Viewer** para quem só acompanha.',
        ],
      },
      {
        tipo: 'tabela',
        titulo: 'Quem pode o quê no CRM',
        colunas: ['Ação', 'Vendedor (Usuário)', 'Gestor (Admin)'],
        linhas: [
          ['Ver cards', 'Só os próprios', 'Todos'],
          ['Aceitar, descartar, mover, ganhar e perder', 'Nos próprios', 'Todos'],
          ['Conversa, notas, tarefas, follow-up, mensagem agendada', 'Nos próprios', 'Todos'],
          ['Relatório de vendas', 'Os próprios números', 'A operação inteira'],
          ['Transferir responsável, apagar venda, mudar data de fechamento', '—', 'Sim'],
          ['Funil, tags, origens, motivos, respostas rápidas', '—', 'Sim'],
          ['Produtos, Disparos, Automações, importar e exportar', '—', 'Sim'],
        ],
      },
      { tipo: 'atencao', texto: 'O número de usuários depende do plano. Se o botão recusar, veja o limite em **Assinatura**.' },
    ],
  },

  // ── CRM ───────────────────────────────────────────────────────────────────
  {
    id: 'crm-como-funciona',
    modulo: 'crm',
    titulo: 'Como o CRM funciona',
    resumo: 'Card, venda e LTV: os três conceitos que explicam a tela inteira.',
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['kanban', 'funil', 'card', 'ltv', 'conceito'],
    blocos: [
      {
        tipo: 'lista',
        itens: [
          '**O card é a pessoa.** Cada contato existe uma vez só, identificado pelo telefone. Se o mesmo número escreve de novo, abre o card que já existe.',
          '**O card anda pelo funil sozinho**, sem precisar de venda. A venda entra quando há valor para registrar.',
          '**Cada compra é uma venda separada.** A recompra nunca apaga a anterior, e o **LTV** (quanto o cliente já comprou) é a soma das vendas ganhas.',
          '**Ganhou ou perdeu a última venda aberta, o card sai do funil.** Ele continua em Contatos, com o histórico inteiro.',
        ],
      },
      { tipo: 'texto', texto: 'Venda ganha entra sozinha no dashboard, na meta do mês e nos relatórios. Não existe passo extra.', soGrowth: true },
      { tipo: 'atencao', texto: 'A empresa usa o Kommo **ou** o CRM daqui, nunca os dois: as vendas contariam em dobro.' },
    ],
  },
  {
    id: 'crm-configurar',
    modulo: 'crm',
    titulo: 'Configurar o CRM',
    resumo: 'Funil, tags, origens, motivos e tipos de cliente da sua empresa.',
    soGestor: true,
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['etapas', 'editar funil', 'cores', 'tags', 'motivos de perda', 'motivos de descarte', 'tipos de cliente', 'configurar'],
    blocos: [
      { tipo: 'texto', texto: 'Tudo fica no botão **⚙ Configurar**, no topo da página do CRM.' },
      {
        tipo: 'tabela',
        colunas: ['Item', 'Para que serve'],
        linhas: [
          ['Editar funil', 'As etapas do kanban, na ordem, com a cor de cada uma. O cadeado 🔒 marca a partir de onde o card precisa de uma venda aberta com valor (normalmente o orçamento).'],
          ['Tags', 'Etiquetas do card (ex.: Quente, VIP). A tag **Carteira** marca cliente recorrente no dashboard.'],
          ['Origens (dentro de "Outro")', 'As origens do seu negócio que não são anúncio: Loja, Fachada, Landing page. Veja "Origem do lead".'],
          ['Motivos de perda (venda)', 'A lista oferecida ao perder uma venda. Vira o ranking de causas no relatório.'],
          ['Motivos de descarte (lead)', 'A lista oferecida ao descartar um lead que não qualificou (engano, fornecedor, clique sem querer).'],
          ['Tipos de cliente', 'Ex.: Pessoa Física, Construtora, Arquiteto. Aparece no card e no filtro.'],
        ],
      },
      { tipo: 'dica', texto: 'Remover uma opção de qualquer lista não mexe nos cards antigos: eles guardam o que tinham na época.' },
    ],
  },
  {
    id: 'crm-whatsapp',
    modulo: 'crm',
    titulo: 'Conectar o WhatsApp',
    resumo: 'Cada vendedor liga o próprio número e os leads passam a chegar sozinhos.',
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['qr code', 'parear', 'número', 'conectar'],
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Na página do CRM, clique em **Conectar WhatsApp**.',
          'No celular, abra o WhatsApp › **Dispositivos conectados** › **Conectar dispositivo**.',
          'Leia o QR Code da tela. Pronto: a conexão fica salva.',
        ],
      },
      {
        tipo: 'lista',
        titulo: 'O que muda depois disso',
        itens: [
          'Mensagem de número novo cria o card sozinho, em **Novos contatos**, com nome e foto.',
          'Cliente que já tem card ganha a bolinha de **não respondido**.',
          'A resposta pelo CRM sai pelo WhatsApp de quem é o responsável do card.',
        ],
      },
      { tipo: 'atencao', texto: 'Se o celular ficar muito tempo sem internet, a conexão pode cair. O CRM avisa; é só ler o QR Code de novo.' },
    ],
  },
  {
    id: 'crm-novos-contatos',
    modulo: 'crm',
    titulo: 'Novos contatos: aceitar ou descartar',
    resumo: 'A triagem de quem acabou de chegar, antes de entrar no funil.',
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['triagem', 'descartar', 'rejeitar', 'não qualificado', 'aceitar'],
    blocos: [
      { tipo: 'texto', texto: 'Todo contato novo (WhatsApp, Direct do Instagram) cai primeiro na coluna **Novos contatos**. Ali você decide se é lead de verdade.' },
      {
        tipo: 'lista',
        itens: [
          '**Aceitar** coloca o card na primeira etapa do funil.',
          '**Descartar** pede um motivo (engano, fornecedor, sem retorno...) e tira o card do funil, sem criar venda perdida. O motivo entra no relatório.',
          'O mesmo Aceitar/Descartar aparece dentro do card, no topo.',
          'Card já aceito também pode ser descartado: botão **Descartar lead** dentro do card.',
        ],
      },
      { tipo: 'dica', texto: 'Contato descartado que volta a escrever reaparece em Novos contatos, com o motivo anterior à vista. O selo "Não qualificado 2x" denuncia quem volta sempre e nunca compra.' },
      {
        tipo: 'lista',
        titulo: 'Coluna Recorrente',
        itens: [
          'Cliente que **já comprou** e voltou a falar no WhatsApp aparece em **Recorrente**.',
          '**Aceitar no funil** devolve ele para a primeira etapa, para uma nova venda. **Dispensar** tira o aviso.',
        ],
      },
    ],
  },
  {
    id: 'crm-funil',
    modulo: 'crm',
    titulo: 'O funil no dia a dia',
    resumo: 'Arrastar cards, ler os sinais e filtrar o que importa agora.',
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['kanban', 'arrastar', 'filtro', 'não respondidos', 'bolinha', 'chegada'],
    blocos: [
      {
        tipo: 'lista',
        titulo: 'Mover',
        itens: [
          'Arraste o card para outra coluna para mudar a etapa.',
          'Durante o arraste aparecem **GANHAR** e **PERDER** no rodapé. Soltar ali fecha a venda (valor final ou motivo).',
          'Etapa com 🔒 só aceita card com venda aberta que tenha valor. Sem isso, o CRM recusa e diz por quê.',
        ],
      },
      {
        tipo: 'tabela',
        titulo: 'Os sinais do card',
        colunas: ['Sinal', 'O que quer dizer'],
        linhas: [
          ['Bolinha verde', 'Mensagem esperando resposta há menos de 4 horas.'],
          ['Bolinha âmbar', 'Esperando há 4 horas ou mais.'],
          ['Bolinha vermelha', 'Esperando há 12 horas ou mais.'],
          ['📅 hoje / 📅 data', 'Follow-up de hoje ou vencido.'],
          ['Selo de origem', 'De onde o lead veio (Meta Ads, WhatsApp, Loja...).'],
          ['Tags', 'Até 2 aparecem no card; o resto vira "+N".'],
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Filtros',
        itens: [
          '**Não respondidos** mostra só quem espera resposta. O número no menu e no título da aba é o total real da empresa.',
          '**Chegada** recorta pelo dia em que o contato chegou e mostra quantos vieram de cada canal. Clicar num canal filtra.',
          'Responsável, Tag, Origem, Tipo de cliente e Venda (ganha/perdida) completam. **✕ limpar** desfaz tudo.',
        ],
      },
      { tipo: 'dica', texto: 'O funil desenha os cards mais recentes. A lista completa, com busca, fica em **Contatos**.' },
    ],
  },
  {
    id: 'crm-card',
    modulo: 'crm',
    titulo: 'O card do cliente',
    resumo: 'Dados, tags, follow-up, notas fixadas e histórico.',
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['ficha', 'editar', 'nota', 'fixar', 'histórico', 'follow-up', 'cidade', 'responsável'],
    blocos: [
      { tipo: 'texto', texto: 'Clique em qualquer card para abrir a ficha. No computador, a conversa fica ao lado.' },
      {
        tipo: 'lista',
        itens: [
          '**Campos**: clique no valor para editar. Enter salva, Esc cancela. Cidade tem busca por nome.',
          '**Follow-up**: o próximo contato, com atalhos Hoje · Amanhã · +3 dias.',
          '**Notas**: escreva no campo de nota. Use **Fixar** para a nota ficar no topo do card, à vista de quem abrir.',
          '**Histórico**: tudo fica registrado sozinho, com quem fez e quando (etapa, responsável, vendas, automações).',
          '**Responsável**: só o gestor transfere o card para outra pessoa.',
        ],
      },
      { tipo: 'dica', texto: 'Com o card aberto, o endereço da página leva direto para ele. Copie e mande para a equipe.' },
    ],
  },
  {
    id: 'crm-origem',
    modulo: 'crm',
    titulo: 'Origem do lead',
    resumo: 'De onde veio cada contato, e como cadastrar as origens do seu negócio.',
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['origem', 'outro', 'loja', 'fachada', 'landing page', 'canal', 'na loja', 'orgânico'],
    blocos: [
      { tipo: 'texto', texto: 'A origem já vem preenchida quando o sistema reconhece de onde o contato veio. Nos outros casos, quem atende escolhe.' },
      {
        tipo: 'lista',
        titulo: 'As opções',
        itens: [
          '**Meta Ads, Google Ads, WhatsApp, Indicação, Link da bio e Direct do Instagram** são iguais para todas as empresas.',
          '**Outro** abre as origens do seu negócio: Loja, Fachada, Landing page, Feira... cada empresa tem a sua lista.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Cadastrar uma origem nova',
        itens: [
          'No card, abra o campo **Origem** e escolha **+ Cadastrar outra origem** (só gestor).',
          'Digite o nome e salve. Ela já fica marcada no card e aparece para toda a equipe.',
          'Para renomear, reordenar ou remover: **⚙ Configurar › Origens (dentro de "Outro")**.',
        ],
      },
      { tipo: 'atencao', texto: 'As origens de "Outro" não entram no ROAS: só anúncio comprovado conta como receita de anúncio.', soGrowth: true },
      { tipo: 'dica', texto: 'Lead do formulário da Meta que não veio de anúncio entra como **Outro › Formulário**.', soGrowth: true },
    ],
  },
  {
    id: 'crm-conversa',
    modulo: 'crm',
    titulo: 'A conversa dentro do card',
    resumo: 'Responder, mandar anexo e áudio, respostas rápidas e mensagem agendada.',
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['whatsapp', 'responder', 'áudio', 'anexo', 'resposta rápida', 'atalho', 'agendar mensagem', 'citar'],
    blocos: [
      {
        tipo: 'lista',
        itens: [
          '**Enter** envia. **Shift + Enter** quebra a linha.',
          '📎 manda imagem, vídeo ou documento. O microfone grava áudio, que chega como mensagem de voz.',
          'Responder uma mensagem específica: passe o mouse sobre ela e use a opção de responder.',
          'Foto, áudio, localização e figurinha aparecem na conversa. Vídeo e documento abrem com um clique.',
          'Abrir a conversa marca como lida.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Respostas rápidas',
        itens: [
          'No campo de mensagem, digite **/** e o começo do título (ex.: /orcamento).',
          'Use ↑ ↓ para escolher e Enter para aplicar. O texto entra no campo para você revisar.',
          '**{nome}** no modelo vira o primeiro nome do cliente. O gestor edita os modelos pelo botão ⚡.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Mensagem agendada',
        itens: [
          'No card, em **Mensagens agendadas**, clique em **+ Agendar mensagem**.',
          'Escreva o texto, escolha dia e hora e salve. Ela sai sozinha pelo WhatsApp do responsável.',
          'Até a hora do envio dá para cancelar ali mesmo.',
        ],
      },
    ],
  },
  {
    id: 'crm-direct',
    modulo: 'crm',
    titulo: 'Direct do Instagram',
    resumo: 'Mensagens do Direct viram card, igual ao WhatsApp.',
    soGestor: true,
    tela: { href: '/dashboard/integrations', nome: 'Integrações' },
    termos: ['instagram', 'direct', 'dm', 'mensagem do instagram'],
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Em **Integrações**, no card **Direct do Instagram**, clique em conectar.',
          'Entre com a conta profissional do Instagram da empresa e autorize.',
          'A partir daí, quem manda Direct vira card em Novos contatos, com o @ no lugar do telefone.',
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Bom saber',
        itens: [
          'Por enquanto a conversa do Direct é só leitura no CRM. Para responder, use **Abrir no Instagram**.',
          'Card do Direct não tem telefone. Adicione o número no card para conversar pelo WhatsApp e entrar nos disparos.',
          'Mensagem que veio de anúncio de Direct entra com origem Meta Ads.',
        ],
      },
      { tipo: 'atencao', texto: 'A Meta ainda está liberando esta conexão para todas as contas. Se não conectar, fale com o suporte.' },
    ],
  },
  {
    id: 'crm-formularios',
    modulo: 'crm',
    titulo: 'Formulário da Meta (Lead Ads)',
    resumo: 'Quem preenche o formulário do anúncio vira card sozinho.',
    soGrowth: true,
    soGestor: true,
    tela: { href: '/dashboard/integrations', nome: 'Integrações' },
    termos: ['lead ads', 'formulário instantâneo', 'facebook', 'leadgen'],
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Em **Integrações**, no card **Formulários da Meta**, clique em conectar e entre com o Facebook.',
          'Escolha a página que roda os anúncios de formulário.',
          'Cada formulário preenchido vira card em **Novos contatos**. Nome, telefone e e-mail viram campos; as outras respostas viram uma nota fixada.',
        ],
      },
      { tipo: 'lista', itens: ['O card do formulário mostra de qual anúncio veio, quando a Meta informa.', 'O último formulário recebido e o motivo de algum não ter virado card aparecem no próprio card da integração.'] },
      { tipo: 'atencao', texto: 'Formulário sem telefone não vira card: o CRM precisa do número.' },
    ],
  },
  {
    id: 'crm-vendas',
    modulo: 'crm',
    titulo: 'Vendas: abrir, ganhar e perder',
    resumo: 'Registrar valor, vender por produto, fechar e corrigir a data.',
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['nova venda', 'ganhar', 'perder', 'valor', 'desconto', 'recompra', 'data de fechamento', 'segmentos'],
    blocos: [
      {
        tipo: 'passos',
        titulo: 'Abrir uma venda',
        itens: [
          'No card, clique em **+ Nova venda**.',
          'Escolha **Digitar valor** ou **Por produtos** (aparece quando a empresa tem catálogo). Por produtos, o valor é calculado; negociação entra como desconto em R$ ou %.',
          'Confira a origem da venda e salve. A venda segue a etapa do card.',
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Fechar',
        itens: [
          '**Ganhar** pede o valor final (maior que zero). É ele que entra no LTV e nos números da empresa.',
          '**Perder** pede um motivo da lista da empresa.',
          'Fechou a última venda aberta? O card sai do funil e fica em Contatos.',
          'Comprou de novo? Abra outra venda no mesmo card. O LTV soma tudo.',
        ],
      },
      { tipo: 'dica', titulo: 'Venda fechada no mês errado', texto: 'O gestor corrige em **Alterar data de fechamento**, na venda encerrada dentro do card. A receita muda de mês junto.' },
    ],
  },
  {
    id: 'crm-tarefas',
    modulo: 'crm',
    titulo: 'Tarefas e follow-up',
    resumo: 'A lista do dia e o próximo contato de cada cliente.',
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['tarefa', 'lembrete', 'follow up', 'agenda', 'vencida'],
    blocos: [
      {
        tipo: 'passos',
        titulo: 'Criar uma tarefa',
        itens: [
          'No card, seção **Tarefas**, clique em **+ Nova tarefa**.',
          'Descreva o que fazer, escolha o tipo (Ligar, WhatsApp, Reunião, E-mail, Outro) e a data.',
          'A tarefa nasce para o responsável do card.',
        ],
      },
      {
        tipo: 'lista',
        titulo: 'O painel Tarefas',
        itens: [
          'Aparece no topo do CRM quando há algo pendente: vencidas e de hoje em destaque.',
          'Clicar no círculo conclui. O nome do cliente abre o card.',
          'Sem nada pendente, o painel some.',
        ],
      },
      { tipo: 'dica', titulo: 'Tarefa ou follow-up?', texto: 'O **follow-up** é um só por cliente: quando voltar a falar. As **tarefas** podem ser várias: o que precisa ser feito. Use os dois juntos.' },
    ],
  },
  {
    id: 'crm-contatos',
    modulo: 'crm',
    titulo: 'Contatos: a lista completa',
    resumo: 'Todo mundo que já passou pelo CRM, com busca e filtros.',
    tela: { href: '/dashboard/crm/contatos', nome: 'Contatos' },
    termos: ['lista', 'clientes', 'carteira', 'buscar'],
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Inclui quem está fora do funil: clientes com venda fechada, descartados e importados.',
          'A busca aceita nome, telefone e @ do Instagram.',
          'Com o filtro **Chegada**, a tela mostra quantos contatos vieram de cada canal no período. Clicar no canal filtra.',
          'Clicar numa linha abre o card.',
        ],
      },
    ],
  },
  {
    id: 'crm-produtos',
    modulo: 'crm',
    titulo: 'Catálogo de produtos',
    resumo: 'Cadastrar produtos para vender por item, com preço e desconto.',
    soGestor: true,
    tela: { href: '/dashboard/crm/produtos', nome: 'Produtos' },
    termos: ['produto', 'catálogo', 'preço', 'sku', 'código'],
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Abra **CRM › Produtos** e clique em **Novo produto**.',
          'Informe nome, código (opcional) e preço.',
          'Pronto: na nova venda aparece a opção **Por produtos**.',
        ],
      },
      { tipo: 'lista', itens: ['Produto que saiu de linha é desativado, nunca apagado: as vendas antigas guardam o nome e o preço da época.', 'O relatório de vendas mostra o que mais vendeu.'] },
    ],
  },
  {
    id: 'crm-disparos',
    modulo: 'crm',
    titulo: 'Disparos em massa',
    resumo: 'Promoção para um grupo de clientes, pelo WhatsApp de cada vendedor.',
    soGestor: true,
    tela: { href: '/dashboard/crm/disparos', nome: 'Disparos' },
    termos: ['promoção', 'mensagem em massa', 'campanha de whatsapp', 'segmentar', 'lotes'],
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Abra **CRM › Disparos**.',
          'Escolha quem recebe: por **etapa**, **tag** e/ou **tipo de cliente**. Com mais de um filtro, escolha **Todos (E)** ou **Qualquer um (OU)**.',
          'Confira o alcance: **Vão receber** e **Pulados**.',
          'Escreva a mensagem. **{nome}** vira o primeiro nome. Imagem é opcional (até 5 MB).',
          'Escolha **Enviar agora** ou **Agendar**. Para listas grandes, ligue **Enviar em lotes com pausa**.',
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Bom saber',
        itens: [
          'Cada cliente recebe pelo WhatsApp do vendedor responsável dele. **Pulados** = vendedor sem WhatsApp conectado.',
          'As mensagens saem espaçadas, de propósito, para o número não ser bloqueado.',
          'Contato descartado e contato sem telefone não recebem.',
          'O **Histórico** mostra o andamento de cada disparo e permite cancelar.',
        ],
      },
    ],
  },
  {
    id: 'crm-automacoes',
    modulo: 'crm',
    titulo: 'Automações',
    resumo: 'Regras que movem cards, criam tarefas e mandam boas-vindas sozinhas.',
    soGestor: true,
    tela: { href: '/dashboard/crm/automacoes', nome: 'Automações' },
    termos: ['automação', 'boas-vindas', 'rodízio', 'regra', 'fluxo', 'horário comercial', 'gatilho'],
    blocos: [
      { tipo: 'texto', texto: 'Cada automação é um gatilho ("quando...") seguido de passos ("faça..."). Monte no quadro, ligando os blocos, ou comece por um modelo pronto.' },
      {
        tipo: 'tabela',
        titulo: 'Gatilhos',
        colunas: ['Gatilho', 'Quando dispara'],
        linhas: [
          ['Lead novo chegou', 'Contato novo entrou no CRM.'],
          ['Entrou numa etapa', 'O card chegou numa etapa escolhida.'],
          ['Parado numa etapa', 'O card ficou X dias sem andar.'],
          ['Sem resposta', 'O cliente escreveu e ninguém respondeu em X horas.'],
          ['Lead não respondeu', 'Vocês escreveram e o cliente sumiu por X horas.'],
          ['Venda ganha / Venda perdida', 'Logo depois do desfecho.'],
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Passos disponíveis',
        itens: [
          'Mover para etapa · Atribuir responsável (fixo ou rodízio) · Adicionar tag · Criar tarefa · Marcar follow-up · Registrar nota · Descartar lead · Esperar.',
          '**Enviar mensagem**: só nos gatilhos "Lead novo chegou" e "Lead não respondeu". Sai pelo WhatsApp do responsável, na fila dos disparos.',
          '**Horário comercial?** divide o fluxo em dois caminhos, Sim e Não (ex.: fora do horário, manda "respondemos às 8h").',
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Modelos prontos',
        itens: ['Boas-vindas no WhatsApp', 'Cobrança de lead que sumiu', 'Esfriamento automático', 'Chegada de lead novo', 'Resgate de lead perdido', 'Pós-venda e indicação', 'SLA de primeira resposta', 'Limpeza de não qualificado'],
      },
      { tipo: 'dica', texto: 'O modo **Execuções** mostra quantos cards passaram por cada bloco e onde algum parou, com o motivo.' },
      { tipo: 'atencao', texto: 'Mudar a ordem dos passos com cards no meio do fluxo pode fazer algum card pular ou repetir passo. A tela avisa quando isso pode acontecer.' },
    ],
  },
  {
    id: 'crm-rastreio',
    modulo: 'crm',
    titulo: 'Rastreio: de qual anúncio veio o lead',
    resumo: 'Como o lead do WhatsApp ganha o anúncio e a campanha que o trouxeram.',
    soGrowth: true,
    soGestor: true,
    tela: { href: '/dashboard/crm/criativos', nome: 'Rastreio' },
    termos: ['rastreio', 'criativo', 'anúncio', 'frase', 'link da bio', 'atribuição', 'utm'],
    blocos: [
      {
        tipo: 'lista',
        titulo: 'Como o lead é reconhecido',
        itens: [
          '**Anúncio de mensagem da Meta**: o WhatsApp traz o anúncio junto. O lead entra com origem Meta Ads e o anúncio aparece em Rastreio sozinho.',
          '**Frase cadastrada**: para link de site ou bio, cadastre a frase pronta do link (ex.: "Olá, vim pelo site"). Quem chega com ela ganha a origem certa.',
          '**Convenção de canal**: "vim pelo google" vira Google Ads e "vim pelo link da bio" vira Link da bio, sem cadastro.',
        ],
      },
      { tipo: 'passos', titulo: 'Cadastrar uma frase', itens: ['Abra **CRM › Rastreio**.', 'Clique em **Novo criativo**, escolha a plataforma (Meta, Google ou Link da bio) e escreva a frase exata do link.', 'Use a mesma frase no botão do site ou da bio.'] },
      { tipo: 'dica', texto: 'O nome do anúncio, da campanha e do conjunto é buscado na Meta todo dia de manhã. Anúncio novo pode aparecer sem nome até lá.' },
    ],
  },
  {
    id: 'crm-relatorio',
    modulo: 'crm',
    titulo: 'Relatório de vendas',
    resumo: 'Os números da operação: conversão, tempo por etapa, perdas e vendedores.',
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['relatório', 'win rate', 'ticket médio', 'conversão', 'por vendedor', 'por cidade'],
    blocos: [
      { tipo: 'texto', texto: 'Botão **Relatório** no topo do CRM. Escolha o período (este mês, 3, 6 ou 12 meses, ou de/até). O vendedor vê os próprios números; o gestor vê a empresa toda.' },
      {
        tipo: 'tabela',
        colunas: ['Bloco', 'O que responde'],
        linhas: [
          ['Resumo', 'Vendas ganhas, receita, perdidas, win rate, ticket médio e ciclo médio.'],
          ['Conversão por etapa', 'Quantas vendas chegaram em cada etapa: mostra onde os negócios se perdem.'],
          ['Tempo em cada etapa', 'Quantos dias a venda fica parada em cada coluna: mostra onde travam.'],
          ['Motivos de perda', 'Por que as vendas foram perdidas.'],
          ['Leads descartados', 'Quantos leads não qualificaram, e por quê (separado das perdas).'],
          ['Por vendedor', 'Ganhas, receita, ticket e win rate de cada pessoa.'],
          ['Por cidade e por produto', 'De onde vem quem compra e o que mais vende.'],
        ],
      },
      { tipo: 'dica', titulo: 'Como ler', texto: 'Conversão baixa entre duas etapas + muito tempo parado na primeira delas = é ali que a operação precisa de atenção.' },
    ],
  },
  {
    id: 'crm-avisos',
    modulo: 'crm',
    titulo: 'Avisos no celular e alertas',
    resumo: 'Saber de lead novo e de cliente esperando, sem ficar olhando a tela.',
    tela: { href: '/dashboard/conta', nome: 'Minha conta' },
    termos: ['notificação', 'push', 'aviso', 'telegram', 'alerta', 'sem resposta', 'app'],
    blocos: [
      {
        tipo: 'passos',
        titulo: 'Ligar os avisos no celular',
        itens: [
          'No iPhone, antes: abra o site no Safari, toque em **Compartilhar** › **Adicionar à Tela de Início** e entre pelo ícone criado.',
          'Abra **Minha conta** › **Avisos no celular** e toque em **Ativar**.',
          'Toque em **Enviar aviso de teste** para conferir.',
        ],
      },
      {
        tipo: 'lista',
        titulo: 'O que avisa',
        itens: [
          'Mensagem nova e lead novo nos seus cards.',
          'Card que passaram para você.',
          'Conversa sem resposta há 4 horas (das 7h às 21h).',
          'Resumo do dia às 8h, de segunda a sábado: tarefas e follow-ups.',
        ],
      },
      { tipo: 'texto', texto: 'Cada pessoa recebe só o que é dela. Card sem responsável avisa os gestores.' },
      { tipo: 'lista', titulo: 'Alertas no Telegram ou WhatsApp do gestor', itens: ['Em **Relatórios Auto.**, ligue **CRM: WhatsApp sem resposta** e **CRM: digest de follow-ups**.', 'Os alertas saem às 9h, de segunda a sexta.'] },
    ],
  },
  {
    id: 'crm-importar',
    modulo: 'crm',
    titulo: 'Importar e exportar clientes',
    resumo: 'Subir a carteira de uma planilha e baixar tudo quando quiser.',
    soGestor: true,
    tela: { href: '/dashboard/crm', nome: 'CRM' },
    termos: ['csv', 'planilha', 'excel', 'importar', 'exportar', 'carteira'],
    blocos: [
      {
        tipo: 'passos',
        titulo: 'Importar',
        itens: [
          'Salve a planilha como CSV, com cabeçalho na primeira linha.',
          '**⚙ Configurar › Importar clientes (CSV)** e escolha o arquivo.',
          'Confira a prévia e confirme.',
        ],
      },
      {
        tipo: 'tabela',
        colunas: ['Coluna', 'Observação'],
        linhas: [
          ['nome', 'Obrigatória (também aceita "cliente" ou "contato").'],
          ['telefone', 'Obrigatória, com ou sem DDD formatado (também "celular" ou "whatsapp").'],
          ['email, empresa, tipo', 'Opcionais.'],
          ['tags', 'Opcional, separadas por vírgula.'],
          ['origem', 'Opcional: meta, google, whatsapp, indicação, link da bio.'],
        ],
      },
      { tipo: 'lista', itens: ['Número repetido não duplica card.', 'Até 2.000 linhas por vez.', '**Exportar clientes (CSV)** baixa a carteira inteira, pronta para o Excel.'] },
    ],
  },

  // ── Perfil da empresa (os dois planos) ────────────────────────────────────
  {
    id: 'perfil-empresa',
    modulo: 'inicio',
    titulo: 'Perfil da empresa',
    resumo: 'O que a plataforma sabe do seu negócio, e a nota de configuração.',
    soGestor: true,
    tela: { href: '/dashboard/perfil', nome: 'Perfil da empresa' },
    termos: ['nota', 'setup score', 'bronze', 'prata', 'ouro', 'cliente ideal', 'diferencial', 'instagram da empresa'],
    blocos: [
      { tipo: 'texto', texto: 'O Perfil reúne o que a plataforma sabe da empresa e mostra uma nota de 0 a 100, com o que falta para subir. Cada ponto aberto tem o atalho para a tela onde se resolve.' },
      {
        tipo: 'lista',
        titulo: 'Sobre o negócio',
        itens: [
          'O que vende, cliente ideal, diferencial, o que é um lead bom e o objetivo do momento.',
          'Respostas vagas voltam com uma pergunta mais específica. Seja concreto: "Corte e dobra de aço para obras em Fortaleza" vale mais que "trabalhamos com qualidade".',
          'Nenhum campo é obrigatório: nada aqui trava a plataforma.',
        ],
      },
      { tipo: 'dica', soGrowth: true, texto: 'É deste Perfil que a IA lê o seu negócio antes de escrever relatório, ideia de anúncio ou copy. Perfil vazio = análise genérica.' },
      { tipo: 'texto', soGrowth: true, texto: 'As conexões só contam ponto quando o dado está chegando de verdade (últimos 7 dias). Conectado, mas parado, não pontua.' },
    ],
  },

  // ── Dashboard e relatórios ────────────────────────────────────────────────
  {
    id: 'dashboard',
    modulo: 'dashboard',
    titulo: 'Como ler o dashboard',
    resumo: 'As abas, o período e de que data sai cada número.',
    tela: { href: '/dashboard', nome: 'Dashboard' },
    termos: ['dashboard', 'período', 'abas', 'filtro de data', 'métricas'],
    blocos: [
      {
        tipo: 'lista',
        titulo: 'As abas',
        itens: [
          '**Vendas e CRM**: funil, receita, meta do mês, origem dos leads e vendedores.',
        ],
      },
      {
        tipo: 'lista',
        soGrowth: true,
        itens: [
          '**Anúncios**: Meta Ads e Google Ads, campanha por campanha.',
          '**Evolução**: investimento, leads e retorno mês a mês.',
          '**Análise da IA**: o último relatório da IA, com nota e recomendações.',
        ],
      },
      { tipo: 'texto', texto: 'No topo, escolha o período: 7D, 30D, 90D, Este mês, Mês passado ou Personalizado. Ele vale para a aba inteira.' },
      {
        tipo: 'tabela',
        titulo: 'De que data sai cada número',
        colunas: ['Número', 'Conta pela data de...'],
        linhas: [
          ['Contatos e leads', 'Chegada do contato.'],
          ['Vendas, receita, ticket, meta do mês', 'Fechamento da venda.'],
          ['Pipeline em negociação', 'Hoje (é o que está aberto agora).'],
        ],
      },
      { tipo: 'dica', texto: 'Por isso a conversão final pode passar de 100% num período curto: vendas que fecharam agora podem ser de leads que chegaram antes.' },
    ],
  },
  {
    id: 'dashboard-vendas',
    modulo: 'dashboard',
    titulo: 'Vendas e CRM no dashboard',
    resumo: 'Cadeia do funil, meta do mês, origem dos leads e ranking.',
    tela: { href: '/dashboard?aba=vendas', nome: 'Vendas e CRM' },
    termos: ['meta do mês', 'cadeia do funil', 'ranking de vendedores', 'origem dos leads', 'projeção', 'saúde do crm', 'ltv'],
    blocos: [
      {
        tipo: 'tabela',
        titulo: 'A cadeia do funil',
        colunas: ['Etapa', 'O que conta'],
        linhas: [
          ['Contatos', 'Todo mundo que chegou no período.'],
          ['Leads', 'Contatos aceitos na triagem (descartados não contam).'],
          ['Oportunidades', 'Leads com venda aberta.'],
          ['Vendas', 'Vendas ganhas que fecharam no período.'],
        ],
      },
      {
        tipo: 'lista',
        itens: [
          '**Meta do mês**: clique em **Definir meta** e informe o valor. A barra acompanha a receita fechada no mês.',
          '**Projeção do mês**: para onde a receita vai se o ritmo continuar.',
          '**Origem dos leads**: de onde vieram os leads do período, incluindo as origens de "Outro" pelo nome.',
          '**Motivos de perda** e **Ranking de vendedores**: o mesmo que o relatório do CRM, no período escolhido.',
          '**Saúde do CRM**: cards parados há mais de 30 dias e vendas ganhas sem valor.',
        ],
      },
      {
        tipo: 'lista',
        soGrowth: true,
        titulo: 'Com anúncios',
        itens: [
          '**ROAS atribuído**: receita das vendas que vieram de anúncio, dividida pelo que foi gasto. Só conta venda com origem comprovada de anúncio (e o link da bio, na Meta).',
          '**Comparativo de canais**: Meta, Google e os outros canais lado a lado: leads, CPL, vendas, receita e ticket médio.',
        ],
      },
    ],
  },
  {
    id: 'dashboard-anuncios',
    modulo: 'dashboard',
    titulo: 'Anúncios no dashboard',
    resumo: 'Gasto, CPL, resultado e as campanhas que mais gastaram.',
    soGrowth: true,
    tela: { href: '/dashboard?aba=anuncios', nome: 'Anúncios' },
    termos: ['cpl', 'roas', 'ctr', 'cpc', 'cpm', 'alcance', 'top campanhas', 'conjunto', 'custo por resultado'],
    blocos: [
      {
        tipo: 'tabela',
        colunas: ['Métrica', 'Como ler'],
        linhas: [
          ['CPL', 'Gasto dividido pelos leads aceitos no CRM: quanto custou cada lead de verdade.'],
          ['ROAS atribuído', 'Receita de vendas que vieram de anúncio ÷ gasto. É o retorno real.'],
          ['ROAS plataformas', 'O que a Meta e o Google dizem que deu retorno. Costuma ser diferente do atribuído.'],
          ['Resultado / Custo por resultado', 'O que a campanha persegue (conversa, lead, compra), como a plataforma reporta.'],
          ['Alcance', 'Somado por dia, é um teto: quem viu em dois dias conta duas vezes.'],
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Ver o que cada campanha trouxe',
        itens: [
          'Em **Top campanhas por gasto**, clique na campanha.',
          'Abra um conjunto para ver os anúncios dele, com leads, descartados, vendas e receita de cada um.',
          'Em **Configurar colunas**, escolha o que aparece na tabela.',
        ],
      },
      { tipo: 'dica', texto: '"—" quer dizer que a plataforma não informou, não que deu zero. A coluna Leads é um piso: lead que chegou sem dizer de qual anúncio veio não entra na campanha.' },
    ],
  },
  {
    id: 'relatorios-auto',
    modulo: 'dashboard',
    titulo: 'Relatórios automáticos e alertas',
    resumo: 'Resumo no Telegram ou no WhatsApp, no dia e hora que você escolher.',
    soGestor: true,
    tela: { href: '/dashboard/relatorios', nome: 'Relatórios Auto.' },
    termos: ['telegram', 'whatsapp', 'grupo', 'agendar relatório', 'alerta', 'anomalia', 'variáveis'],
    blocos: [
      {
        tipo: 'passos',
        titulo: 'Conectar o canal (uma vez)',
        itens: [
          '**Telegram**: clique em **Conectar Telegram** e leia o QR Code com o Telegram. A conexão é automática.',
          '**WhatsApp**: clique em **Conectar WhatsApp de relatórios** e leia o QR Code em **Dispositivos conectados** › **Conectar dispositivo**. Esse número envia todos os relatórios por WhatsApp da empresa.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Agendar',
        itens: [
          'Em **Novo agendamento de relatório**, escolha o canal e o destino (no WhatsApp, o grupo da lista ou um número).',
          'Escolha a frequência (Diário, Semanal, Quinzenal ou Mensal) e o horário.',
          'Use o **Modelo padrão** ou escreva o seu texto. Clique nas variáveis para inserir os números (ex.: leads, vendas). A prévia mostra os números de hoje.',
        ],
      },
      { tipo: 'lista', titulo: 'Alertas do CRM', itens: ['**CRM: WhatsApp sem resposta**: cliente esperando há mais de X horas.', '**CRM: digest de follow-ups**: vencidos e de hoje, com link para cada card.', 'Os alertas saem às 9h, de segunda a sexta, pelos canais conectados.'] },
      { tipo: 'lista', soGrowth: true, titulo: 'Alertas de anúncio', itens: ['Spend sem leads, CPL alto, CTR colapsado, ROAS < 1x, Silêncio de leads e Saldo restante baixo.', 'Cada um tem o seu limite ajustável. Ligue só os que você vai olhar.'] },
    ],
  },

  // ── Anúncios e IA (plano completo) ────────────────────────────────────────
  {
    id: 'integracoes-anuncios',
    modulo: 'anuncios',
    titulo: 'Conectar Meta Ads e Google Ads',
    resumo: 'Ligar as contas de anúncio e escolher a conta certa.',
    soGrowth: true,
    soGestor: true,
    tela: { href: '/dashboard/integrations', nome: 'Integrações' },
    termos: ['meta', 'facebook', 'google ads', 'conta de anúncios', 'saldo', 'reconectar', 'token', 'dados manuais'],
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Abra **Integrações** e clique em **Conectar** no card da Meta Ads ou do Google Ads.',
          'Entre com a conta que administra os anúncios e autorize tudo o que for pedido. No Google, deixe marcada a permissão do Google Ads.',
          'Se a conta tiver acesso a mais de uma conta de anúncios, escolha a da empresa no próprio card.',
          'Os últimos 90 dias são buscados na hora. Depois, o sync roda todo dia de manhã.',
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Bom saber',
        itens: [
          'O card da Meta mostra o saldo da conta de anúncios.',
          'A conexão da Meta vence a cada 60 dias. Quando vencer, o card pede para conectar de novo.',
          'Sem CRM, dá para informar leads, vendas e receita por canal à mão em **Dados Manuais de Receita**.',
        ],
      },
      { tipo: 'atencao', texto: 'Escolher a conta errada mistura o dado de outro anunciante no seu painel. Confira o nome da conta antes de confirmar.' },
    ],
  },
  {
    id: 'relatorio-ia',
    modulo: 'anuncios',
    titulo: 'Relatório da IA',
    resumo: 'Nota de saúde, alertas e recomendações sobre anúncios e vendas.',
    soGrowth: true,
    tela: { href: '/dashboard/reports', nome: 'Relatórios' },
    termos: ['ia', 'inteligência artificial', 'score', 'recomendações', 'pdf', 'análise'],
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Abra **Relatórios** e clique em **Gerar relatório**. Leva alguns segundos.',
          'Leia o **Resumo executivo**, os **Alertas prioritários** e as **Recomendações**.',
          'Use **Exportar PDF** para mandar para alguém.',
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Bom saber',
        itens: [
          'A IA compara campanhas só com outras do mesmo objetivo (conversa com conversa, tráfego com tráfego).',
          'Ela não recomenda aumentar, pausar ou mudar verba: essa decisão é do gestor de tráfego. Ela aponta o que o dado mostra.',
          'Cada empresa tem 8 relatórios por mês. Precisa de mais? Fale com o suporte.',
        ],
      },
      { tipo: 'dica', texto: 'Quanto mais completo o **Perfil da empresa**, mais o relatório fala do seu negócio, e não de um negócio qualquer.' },
    ],
  },
  {
    id: 'criativos',
    modulo: 'anuncios',
    titulo: 'Criativos: ideias, briefing e copy',
    resumo: 'Os agentes de IA que ajudam a criar o próximo anúncio.',
    soGrowth: true,
    tela: { href: '/dashboard/criativo', nome: 'Criativos' },
    termos: ['ideias de anúncio', 'briefing', 'copy', 'concorrentes', 'inteligência competitiva', 'análise criativa', 'teste a/b'],
    blocos: [
      {
        tipo: 'tabela',
        colunas: ['Agente', 'O que entrega'],
        linhas: [
          ['Análise Criativa', 'O que os anúncios de melhor desempenho têm em comum.'],
          ['Geração de Ideias', 'Ângulos e formatos para os próximos anúncios.'],
          ['Briefing Automatizado', 'Objetivo, público, ângulo e métricas de sucesso de uma campanha.'],
          ['Copy & Variações', 'Textos do anúncio em versões para teste A/B.'],
          ['Inteligência Competitiva', 'O que os concorrentes estão anunciando e onde há espaço para você.'],
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Do briefing à copy',
        itens: [
          'No **Briefing Automatizado**, escolha a campanha e gere.',
          'Clique em **Gerar copy a partir deste briefing**: a copy já sai alinhada a ele.',
        ],
      },
      { tipo: 'lista', titulo: 'Bom saber', itens: ['Para a Inteligência Competitiva, cadastre a URL da página no Facebook de cada concorrente.', 'Por mês: 4 análises criativas, 8 briefings ou ideias e 8 copies. A análise de concorrentes não tem limite.'] },
    ],
  },
  {
    id: 'seo',
    modulo: 'anuncios',
    titulo: 'SEO / AIO: o seu site no Google e nas IAs',
    resumo: 'Diagnóstico mensal do site, com o que resolver primeiro.',
    soGrowth: true,
    tela: { href: '/dashboard/seo', nome: 'SEO / AIO' },
    termos: ['site', 'google', 'chatgpt', 'velocidade', 'core web vitals', 'concorrentes'],
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Em **SEO / AIO**, clique em **Configurar URLs** e informe o site da empresa (e, se quiser, os dos concorrentes).',
          'A primeira análise sai sozinha. Depois, roda todo mês; dá para pedir uma por mês em **Analisar agora**.',
          'Comece por **O que resolver no seu site**: é a lista em ordem de importância.',
        ],
      },
      { tipo: 'lista', itens: ['**Performance**: velocidade no celular (o que o Google mede).', '**Como o ChatGPT e outras IAs enxergam seu site**: se uma IA consegue ler e recomendar a empresa.', '**Evolução dos scores** e **Comparativo com concorrentes**: se o site está melhorando, e contra quem.'] },
    ],
  },
  {
    id: 'gestor-trafego',
    modulo: 'anuncios',
    titulo: 'Para gestores de tráfego',
    resumo: 'Painel de cada cliente, convite e briefing semanal.',
    soGrowth: true,
    soPapel: 'TRAFFIC_MANAGER',
    tela: { href: '/dashboard/gestor', nome: 'Gestão' },
    termos: ['gestor', 'agência', 'clientes', 'comissão', 'briefing semanal', 'convidar cliente'],
    blocos: [
      {
        tipo: 'passos',
        titulo: 'Criar o painel de um cliente',
        itens: [
          'Em **Gestão**, clique em **Criar Dashboard de Cliente**.',
          'Dê o nome do cliente e escolha a conta Meta Ads e/ou Google Ads dele (ou **Não usar**).',
          'Clique em **Criar dashboard**. Os últimos 90 dias são buscados na hora.',
        ],
      },
      {
        tipo: 'lista',
        itens: [
          '**Abrir dashboard** entra no painel do cliente como se fosse ele.',
          '**Convidar cliente** gera o link para ele criar o acesso próprio ao painel que você montou.',
          '**Briefing Semanal Automático**: escolha dia e horário de cada cliente e receba o resumo no Telegram.',
          '**Copiar link de indicação**: cliente que assina por ele entra nos seus comissionáveis.',
        ],
      },
    ],
  },

  // ── Conta e assinatura ───────────────────────────────────────────────────
  {
    id: 'minha-conta',
    modulo: 'conta',
    titulo: 'Minha conta',
    resumo: 'Nome, foto, senha, e-mail e os aparelhos conectados.',
    tela: { href: '/dashboard/conta', nome: 'Minha conta' },
    termos: ['senha', 'trocar senha', 'e-mail', 'foto', 'aparelhos', 'sair'],
    blocos: [
      {
        tipo: 'lista',
        itens: [
          '**Seus dados**: nome, telefone e foto.',
          '**Senha**: trocar a senha desconecta os outros aparelhos.',
          '**E-mail**: o novo endereço só vale depois de confirmar o link que chega nele.',
          '**Aparelhos conectados**: veja onde sua conta está aberta e saia dos outros.',
        ],
      },
      { tipo: 'dica', texto: 'O que é da empresa (o que vende, site, Instagram) fica em **Perfil da empresa**, não aqui.' },
    ],
  },
  {
    id: 'assinatura',
    modulo: 'conta',
    titulo: 'Assinatura e pagamento',
    resumo: 'Planos, formas de pagamento e até quando vale o acesso.',
    soGestor: true,
    tela: { href: '/dashboard/assinatura', nome: 'Assinatura' },
    termos: ['plano', 'pagar', 'fatura', 'pix', 'boleto', 'cartão', 'parcelar', 'cancelar'],
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Pague por **PIX, boleto ou cartão**, escolhendo na fatura. No PIX o acesso libera em segundos; no boleto, em até 3 dias úteis.',
          'No plano semestral dá para parcelar em até 6x no cartão, e no anual em até 12x, sem juros. O parcelado não renova sozinho: no último mês a tela de Assinatura oferece o pagamento de novo.',
          'O acesso vale até o dia do vencimento da fatura.',
          'Cancelou? O acesso continua até o fim do período já pago.',
        ],
      },
    ],
  },
];
