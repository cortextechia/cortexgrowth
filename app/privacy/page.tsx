import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Cortex Growth',
  description: 'Saiba como o Cortex Growth coleta, usa e protege seus dados pessoais.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #080d19 0%, #0a1628 50%, #0d1f3c 100%)', color: '#f1f5f9' }}>

      {/* Navbar simples */}
      <nav className="border-b px-6 py-4" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(8,13,25,0.9)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="font-bold text-white">Cortex Growth</span>
          </Link>
          <Link href="/" className="text-sm transition-colors" style={{ color: '#94a3b8' }}>
            ← Voltar
          </Link>
        </div>
      </nav>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-3" style={{ color: '#f1f5f9' }}>Política de Privacidade</h1>
          <p className="text-sm" style={{ color: '#475569' }}>Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>1. Introdução</h2>
            <p>
              O <strong style={{ color: '#f1f5f9' }}>Cortex Growth</strong>, desenvolvido e operado pela <strong style={{ color: '#f1f5f9' }}>IA Cortex Tech</strong>
              {' '}(CNPJ em processo de atualização cadastral), é uma plataforma SaaS de analytics de marketing que centraliza dados
              de Meta Ads, Google Ads e Kommo CRM em um único dashboard inteligente.
            </p>
            <p className="mt-3">
              Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações
              ao utilizar nossa plataforma. Ao criar uma conta e usar o Cortex Growth, você concorda com os termos desta política.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>2. Dados que coletamos</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="font-medium mb-2" style={{ color: '#f1f5f9' }}>Dados de cadastro</h3>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Nome completo</li>
                  <li>Endereço de e-mail</li>
                  <li>Senha (armazenada com hash bcrypt — nunca em texto plano)</li>
                  <li>Nome da organização/empresa</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="font-medium mb-2" style={{ color: '#f1f5f9' }}>Dados de integrações OAuth</h3>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Tokens de acesso OAuth (Meta Ads, Google Ads, Kommo CRM) — armazenados criptografados com AES-256-GCM</li>
                  <li>Métricas de campanhas de anúncios (gastos, impressões, cliques, conversões)</li>
                  <li>Dados de leads e negociações do CRM (nome, status, pipeline)</li>
                  <li>ID de contas de anúncios vinculadas</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="font-medium mb-2" style={{ color: '#f1f5f9' }}>Dados de uso</h3>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Logs de acesso e autenticação</li>
                  <li>Data e hora de login</li>
                  <li>Endereço IP (para segurança e rate limiting)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>3. Como usamos seus dados</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>Autenticar e manter sua sessão na plataforma</li>
              <li>Importar e exibir métricas de performance de marketing no dashboard</li>
              <li>Gerar análises e insights automáticos via agentes de IA</li>
              <li>Enviar alertas e notificações sobre sua conta</li>
              <li>Melhorar a segurança e prevenir fraudes</li>
              <li>Cumprir obrigações legais</li>
            </ul>
            <p className="mt-3">
              <strong style={{ color: '#f1f5f9' }}>Não</strong> utilizamos seus dados para fins publicitários, não os vendemos
              a terceiros e não os compartilhamos com parceiros comerciais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>4. Compartilhamento de dados</h2>
            <p>Seus dados são compartilhados apenas nas seguintes situações:</p>
            <ul className="space-y-2 mt-3 list-disc list-inside">
              <li><strong style={{ color: '#f1f5f9' }}>Meta Platforms Inc.</strong> — via API oficial do Meta Ads, para importação de dados de campanhas autorizadas por você via OAuth.</li>
              <li><strong style={{ color: '#f1f5f9' }}>Google LLC</strong> — via API oficial do Google Ads e Google Analytics, para importação de métricas autorizadas por você.</li>
              <li><strong style={{ color: '#f1f5f9' }}>Kommo (amocrm)</strong> — via API oficial do Kommo CRM, para sincronização de leads autorizados por você.</li>
              <li><strong style={{ color: '#f1f5f9' }}>Google (Gemini API)</strong> — para geração de insights de IA. Apenas métricas agregadas são enviadas, sem dados pessoais identificáveis.</li>
            </ul>
            <p className="mt-3">
              Nenhuma outra empresa ou terceiro tem acesso aos seus dados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>5. Segurança dos dados</h2>
            <p>Adotamos medidas técnicas rigorosas para proteger seus dados:</p>
            <ul className="space-y-2 mt-3 list-disc list-inside">
              <li>Tokens OAuth criptografados com <strong style={{ color: '#f1f5f9' }}>AES-256-GCM</strong> em repouso</li>
              <li>Senhas com hash <strong style={{ color: '#f1f5f9' }}>bcrypt</strong> (fator 12) — nunca armazenadas em texto plano</li>
              <li>Comunicação via <strong style={{ color: '#f1f5f9' }}>HTTPS/TLS</strong> em todas as requisições</li>
              <li>Tokens JWT com expiração de 15 minutos e refresh token com rotação</li>
              <li>Rate limiting e proteção contra ataques de força bruta</li>
              <li>Headers de segurança via Helmet.js</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>6. Retenção de dados</h2>
            <p>
              Seus dados são mantidos enquanto sua conta estiver ativa. Dados de métricas de campanhas são mantidos
              por até 12 meses para análise histórica. Logs de autenticação são mantidos por 30 dias.
            </p>
            <p className="mt-3">
              Ao solicitar a exclusão da conta, todos os seus dados pessoais e tokens OAuth são removidos
              permanentemente em até 30 dias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>7. Seus direitos (LGPD)</h2>
            <p>De acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
            <ul className="space-y-2 mt-3 list-disc list-inside">
              <li>Confirmar a existência de tratamento dos seus dados</li>
              <li>Acessar seus dados pessoais armazenados</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação dos dados</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar a portabilidade dos dados</li>
            </ul>
            <p className="mt-3">
              Para exercer qualquer um desses direitos, entre em contato pelo e-mail:{' '}
              <a href="mailto:privacidade@iacortextech.com.br" className="underline" style={{ color: '#3b82f6' }}>
                privacidade@iacortextech.com.br
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>8. Exclusão de dados do usuário</h2>
            <p>
              Para solicitar a exclusão completa dos seus dados da plataforma Cortex Growth, envie um e-mail para{' '}
              <a href="mailto:privacidade@iacortextech.com.br" className="underline" style={{ color: '#3b82f6' }}>
                privacidade@iacortextech.com.br
              </a>{' '}
              com o assunto <strong style={{ color: '#f1f5f9' }}>"Exclusão de dados"</strong> e o e-mail cadastrado na sua conta.
            </p>
            <p className="mt-3">
              Processaremos sua solicitação em até 30 dias. Você receberá uma confirmação por e-mail quando a exclusão for concluída.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>9. Cookies</h2>
            <p>
              O Cortex Growth não utiliza cookies de rastreamento ou publicidade. Utilizamos apenas o armazenamento
              local (localStorage) do navegador para manter a sessão autenticada, com tokens JWT que expiram automaticamente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>10. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos usuários ativos por e-mail sobre mudanças
              significativas com pelo menos 15 dias de antecedência. O uso continuado da plataforma após a notificação
              implica concordância com a nova política.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>11. Contato</h2>
            <p>Para dúvidas, solicitações ou reclamações relacionadas a esta política:</p>
            <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <p><strong style={{ color: '#f1f5f9' }}>IA Cortex Tech</strong></p>
              <p className="mt-1">E-mail: <a href="mailto:privacidade@iacortextech.com.br" className="underline" style={{ color: '#3b82f6' }}>privacidade@iacortextech.com.br</a></p>
              <p>Site: <a href="https://iacortextech.com.br" className="underline" style={{ color: '#3b82f6' }}>iacortextech.com.br</a></p>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 mt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-xs" style={{ color: '#475569' }}>
            © {new Date().getFullYear()} IA Cortex Tech. Todos os direitos reservados.
          </p>
          <Link href="/" className="text-xs transition-colors" style={{ color: '#475569' }}
            onMouseEnter={undefined}
            onMouseLeave={undefined}>
            Voltar ao início
          </Link>
        </div>
      </footer>
    </div>
  );
}