import Link from 'next/link';
import type { Metadata } from 'next';
import LogoCromalex from '@/components/LogoCromalex';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Cromalex Growth',
  description: 'Saiba como o Cromalex Growth coleta, usa e protege seus dados pessoais.',
};

// Data fixa: muda só quando o texto mudar (antes era a data do dia, o que dizia que a
// política tinha sido atualizada hoje toda vez que alguém abria a página).
const ATUALIZADA_EM = '10 de novembro de 2026';
const EMAIL = 'privacidade@iacortextech.com.br';

const SECOES = [
  { id: 'introducao', titulo: 'Introdução' },
  { id: 'dados', titulo: 'Dados que coletamos' },
  { id: 'uso', titulo: 'Como usamos seus dados' },
  { id: 'compartilhamento', titulo: 'Com quem compartilhamos' },
  { id: 'google-user-data', titulo: 'Dados das APIs do Google (Uso Limitado)' },
  { id: 'seguranca', titulo: 'Segurança dos dados' },
  { id: 'retencao', titulo: 'Retenção de dados' },
  { id: 'direitos', titulo: 'Seus direitos (LGPD)' },
  { id: 'exclusao', titulo: 'Exclusão de dados do usuário' },
  { id: 'cookies', titulo: 'Cookies e armazenamento local' },
  { id: 'alteracoes', titulo: 'Alterações nesta política' },
  { id: 'contato', titulo: 'Contato' },
] as const;

function Secao({ n, children }: { n: number; children: React.ReactNode }) {
  const s = SECOES[n - 1];
  return (
    <section id={s.id} className="scroll-mt-24">
      <p className="eyebrow">{String(n).padStart(2, '0')}</p>
      <h2 className="ui-h2 mt-1 !text-[19px]">{s.titulo}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--text-muted)]">{children}</ul>;
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="ui-inset p-4">
      <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{titulo}</h3>
      {children}
    </div>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>;
}

function A({ href, children, lang }: { href: string; children: React.ReactNode; lang?: string }) {
  return (
    <a href={href} lang={lang} className="underline underline-offset-2" style={{ color: 'var(--text-primary)', textDecorationColor: 'var(--accent)' }}>
      {children}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
      <nav className="sticky top-0 z-10 border-b px-4 py-3 sm:px-6" style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg-base) 88%, transparent)', backdropFilter: 'blur(10px)' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <LogoCromalex size={26} />
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Cromalex Growth</span>
          </Link>
          <Link href="/" className="ui-btn ui-btn-secondary ui-btn-sm">Voltar ao início</Link>
        </div>
      </nav>

      <header className="mx-auto max-w-5xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
        <p className="eyebrow">DOCUMENTO LEGAL</p>
        <h1 className="ui-h1 mt-2 !text-[34px] sm:!text-[40px]">Política de Privacidade</h1>
        <p className="ui-sub">Como o Cromalex Growth coleta, usa, guarda e protege os dados de quem usa a plataforma e dos contatos que chegam pelo CRM.</p>
        <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>Última atualização: {ATUALIZADA_EM}</p>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-20 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav aria-label="Sumário" className="ui-card !p-4">
            <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Nesta página</p>
            <ol className="space-y-1 text-[13px]">
              {SECOES.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]">
                    <span className="font-mono text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span>{s.titulo}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <main className="max-w-[720px] space-y-12 text-[15px] leading-relaxed">
          <Secao n={1}>
            <p>
              O <B>Cromalex Growth</B>, desenvolvido e operado pela <B>Cortex Tech Locação e Desenvolvimento de Sistemas Ltda</B>{' '}
              (CNPJ 52.722.681/0001-03), é uma plataforma de marketing e vendas que reúne num só lugar os dados de Meta Ads e
              Google Ads, um CRM próprio com WhatsApp e Instagram, e análises feitas por inteligência artificial.
            </p>
            <p>
              Esta política descreve como coletamos, usamos, guardamos e protegemos as informações tratadas na plataforma.
              Ao criar uma conta e usar o Cromalex Growth, você concorda com ela.
            </p>
            <p>
              Para os dados da sua conta, nós somos o <B>controlador</B>. Para os dados dos seus contatos e clientes que entram
              no CRM (conversas, telefones, leads), a sua empresa é a controladora e nós atuamos como <B>operador</B>: tratamos esses
              dados só para prestar o serviço, conforme as suas instruções.
            </p>
          </Secao>

          <Secao n={2}>
            <Grupo titulo="Dados da sua conta">
              <Lista>
                <li>Nome, e-mail, telefone (opcional) e foto de perfil (opcional)</li>
                <li>Senha, guardada só como hash bcrypt, nunca em texto</li>
                <li>Nome e perfil da empresa (ramo, produtos, público), usados para dar contexto às análises</li>
              </Lista>
            </Grupo>
            <Grupo titulo="Dados de cobrança">
              <Lista>
                <li>Nome ou razão social, CPF ou CNPJ e e-mail para emitir a cobrança</li>
                <li>Os dados do cartão são digitados e processados pelo Asaas; não passam pelos nossos servidores nem ficam guardados conosco</li>
              </Lista>
            </Grupo>
            <Grupo titulo="Dados das integrações que você conecta">
              <Lista>
                <li>Tokens de acesso (Meta, Google, Instagram, Kommo), guardados criptografados com AES-256-GCM</li>
                <li>Métricas das campanhas de anúncios: investimento, impressões, cliques, conversões e identificação dos anúncios</li>
                <li>Leads e negociações do Kommo CRM, quando conectado</li>
              </Lista>
            </Grupo>
            <Grupo titulo="Dados dos seus contatos no CRM">
              <Lista>
                <li>Conversas do WhatsApp do número que você conecta: texto, fotos, áudios, vídeos, documentos e localização enviados nas conversas</li>
                <li>Mensagens do Direct do Instagram da conta que você conecta</li>
                <li>Respostas dos formulários de anúncios da Meta (Lead Ads), como nome, telefone e e-mail do interessado</li>
                <li>Informações que a sua equipe registra: etapa do funil, vendas, tarefas, anotações, motivos de perda e origem do contato</li>
              </Lista>
            </Grupo>
            <Grupo titulo="Dados de uso">
              <Lista>
                <li>Data e hora de login e aparelhos com sessão aberta</li>
                <li>Endereço IP, usado para segurança e limite de requisições</li>
              </Lista>
            </Grupo>
          </Secao>

          <Secao n={3}>
            <Lista>
              <li>Autenticar você e manter sua sessão</li>
              <li>Mostrar as métricas de marketing e o funil de vendas no painel</li>
              <li>Receber e enviar as mensagens do CRM em seu nome, incluindo as mensagens automáticas e os disparos que você configurar</li>
              <li>Gerar análises, relatórios e sugestões com inteligência artificial</li>
              <li>Enviar alertas, relatórios e avisos da conta por e-mail, Telegram ou WhatsApp, nos canais que você escolher</li>
              <li>Cobrar a assinatura</li>
              <li>Proteger a plataforma contra fraude e acesso indevido e cumprir obrigações legais</li>
            </Lista>
            <p>
              <B>Não</B> vendemos seus dados, não os usamos para publicidade e não os usamos para treinar modelos de inteligência artificial.
            </p>
          </Secao>

          <Secao n={4}>
            <p>Seus dados só são compartilhados com os fornecedores necessários para o serviço funcionar:</p>
            <Lista>
              <li><B>Meta Platforms</B>: APIs oficiais do Meta Ads, do Instagram e dos formulários de Lead Ads, nas contas que você autorizar.</li>
              <li><B>Google</B>: API oficial do Google Ads, na conta que você autorizar (veja a seção 5).</li>
              <li><B>Kommo</B>: API oficial do Kommo CRM, quando você conectar.</li>
              <li><B>Anthropic (Claude)</B>: gera as análises de IA. Recebe métricas das campanhas, o perfil da sua empresa e os motivos de perda registrados no CRM. Não enviamos nome, telefone nem conversas dos seus contatos.</li>
              <li><B>Asaas</B>: processamento dos pagamentos da assinatura.</li>
              <li><B>Hospedagem e infraestrutura</B>: Render e Vercel (aplicação), Neon (banco de dados) e Hostinger (servidor da integração com o WhatsApp e armazenamento das mídias das conversas).</li>
              <li><B>Envio de avisos</B>: Zoho (e-mail) e Telegram (alertas, quando você ativa).</li>
            </Lista>
            <p>
              Alguns desses fornecedores guardam ou processam dados fora do Brasil, principalmente nos Estados Unidos. Essa transferência
              é feita para executar o contrato com você, com fornecedores que adotam padrões de segurança compatíveis com a LGPD.
            </p>
            <p>Também podemos compartilhar dados quando a lei ou uma ordem judicial exigir.</p>
          </Secao>

          <Secao n={5}>
            <p>
              Quando você conecta sua conta do Google Ads, o Cromalex Growth solicita o escopo{' '}
              <code className="rounded px-1 py-0.5 text-[13px]" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>https://www.googleapis.com/auth/adwords</code>{' '}
              e o usa <B>somente para ler</B>{' '}
              as métricas das campanhas da conta que você autorizou (custo, cliques, impressões e conversões), exibidas no seu dashboard.
              Nunca criamos, editamos, pausamos ou excluímos campanhas, anúncios, orçamentos ou contas.
            </p>
            <Lista>
              <li>Os dados do Google são usados apenas para mostrar e analisar o desempenho das suas campanhas dentro da plataforma, a pedido seu.</li>
              <li>Não vendemos esses dados e não os usamos para publicidade, retargeting ou anúncios personalizados.</li>
              <li>Não os transferimos a terceiros, exceto para prestar o serviço que você vê na plataforma (por exemplo, métricas agregadas enviadas à Anthropic para gerar os insights de IA do seu dashboard), para cumprir a lei ou em caso de fusão ou aquisição.</li>
              <li>Não usamos dados do Google para desenvolver, melhorar ou treinar modelos de IA ou de aprendizado de máquina generalizados.</li>
              <li>Ninguém da nossa equipe lê esses dados, exceto com seu consentimento expresso, por segurança, para cumprir a lei, ou quando agregados e anonimizados para operar o serviço.</li>
              <li>Você pode revogar o acesso a qualquer momento em <A href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</A> ou desconectando o Google Ads em Integrações; o token é apagado da plataforma.</li>
            </Lista>
            <p lang="en">
              Cromalex Growth&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <A href="https://developers.google.com/terms/api-services-user-data-policy" lang="en">Google API Services User Data Policy</A>
              , including the Limited Use requirements.
            </p>
          </Secao>

          <Secao n={6}>
            <Lista>
              <li>Tokens das integrações criptografados com <B>AES-256-GCM</B></li>
              <li>Senhas com hash <B>bcrypt</B> (fator 12)</li>
              <li><B>HTTPS/TLS</B> em todas as comunicações</li>
              <li>Login com token de acesso de 15 minutos e renovação com rotação; trocar a senha encerra as sessões nos outros aparelhos</li>
              <li>Dados de cada empresa isolados: uma empresa nunca vê os dados de outra</li>
              <li>Limite de tentativas contra força bruta e cabeçalhos de segurança no site e na API</li>
              <li>Cópias de segurança do banco de dados</li>
            </Lista>
          </Secao>

          <Secao n={7}>
            <Lista>
              <li>Dados da conta, das integrações e do CRM: enquanto a conta estiver ativa.</li>
              <li>Fotos, áudios, vídeos e documentos das conversas do WhatsApp: 90 dias; depois disso o arquivo é apagado e a conversa fica só com o texto.</li>
              <li>Sessões de login: até 30 dias sem uso.</li>
              <li>Cópias de segurança do banco: 7 dias.</li>
            </Lista>
            <p>
              Quando a exclusão da conta é pedida, os dados pessoais e os tokens das integrações são apagados em até 30 dias.
              Dados que a lei obriga a guardar, como os de cobrança, ficam pelo prazo legal.
            </p>
          </Secao>

          <Secao n={8}>
            <p>Pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode:</p>
            <Lista>
              <li>Confirmar se tratamos seus dados e acessá-los</li>
              <li>Corrigir dados incompletos ou desatualizados (nome, telefone, foto e e-mail podem ser alterados em Minha conta)</li>
              <li>Pedir anonimização, bloqueio ou eliminação</li>
              <li>Pedir a portabilidade</li>
              <li>Revogar o consentimento e desconectar qualquer integração a qualquer momento</li>
            </Lista>
            <p>
              Para exercer esses direitos, escreva para <A href={`mailto:${EMAIL}`}>{EMAIL}</A>. Se você é contato de uma empresa
              que usa o Cromalex Growth, procure primeiro essa empresa, que é a controladora dos seus dados; nós a ajudamos a atender o pedido.
            </p>
          </Secao>

          <Secao n={9}>
            <p>
              Para pedir a exclusão completa dos seus dados, envie um e-mail para <A href={`mailto:${EMAIL}`}>{EMAIL}</A> com o
              assunto <B>&quot;Exclusão de dados&quot;</B> e o e-mail cadastrado na sua conta.
            </p>
            <p>Processamos o pedido em até 30 dias e confirmamos por e-mail quando a exclusão terminar.</p>
          </Secao>

          <Secao n={10}>
            <p>
              Não usamos cookies de rastreamento ou de publicidade próprios. Sua sessão fica no armazenamento local (localStorage) do
              navegador, com tokens que expiram sozinhos.
            </p>
            <p>
              O site carrega o SDK do Facebook para permitir conectar contas da Meta. Esse SDK pode gravar cookies da própria Meta,
              regidos pela <A href="https://www.facebook.com/privacy/policy/">Política de Privacidade da Meta</A>.
            </p>
          </Secao>

          <Secao n={11}>
            <p>
              Podemos atualizar esta política. Mudanças relevantes são avisadas por e-mail aos usuários ativos com pelo menos
              15 dias de antecedência. Continuar usando a plataforma depois do aviso significa concordar com a nova versão.
            </p>
          </Secao>

          <Secao n={12}>
            <div className="ui-card space-y-1">
              <p><B>Cortex Tech Locação e Desenvolvimento de Sistemas Ltda</B></p>
              <p>CNPJ 52.722.681/0001-03</p>
              <p>E-mail: <A href={`mailto:${EMAIL}`}>{EMAIL}</A></p>
              <p>Site: <A href="https://www.cortexgrowth.com.br">cortexgrowth.com.br</A></p>
            </div>
          </Secao>
        </main>
      </div>

      <footer className="border-t px-4 py-8 sm:px-6" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <p>© 2026 Cortex Tech. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-[var(--text-primary)]">Termos de Serviço</Link>
            <Link href="/" className="hover:text-[var(--text-primary)]">Voltar ao início</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
