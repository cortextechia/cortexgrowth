import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Serviço — Cortex Growth',
  description: 'Leia os Termos de Serviço do Cortex Growth antes de utilizar a plataforma.',
};

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold mb-3" style={{ color: '#f1f5f9' }}>Termos de Serviço</h1>
          <p className="text-sm" style={{ color: '#475569' }}>Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>1. Aceitação dos Termos</h2>
            <p>
              Ao criar uma conta e utilizar o <strong style={{ color: '#f1f5f9' }}>Cortex Growth</strong>, você concorda com estes Termos de Serviço.
              A plataforma é desenvolvida e operada pela <strong style={{ color: '#f1f5f9' }}>Cortex Tech Locação e Desenvolvimento de Sistemas Ltda</strong>
              {' '}(CNPJ 52.722.681/0001-03), com sede em Maranguape, CE.
            </p>
            <p className="mt-3">
              Se você não concordar com qualquer parte destes termos, não utilize a plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>2. Descrição do Serviço</h2>
            <p>
              O Cortex Growth é uma plataforma SaaS de analytics de marketing que consolida dados de Meta Ads,
              Google Ads e Kommo CRM em um único dashboard, utilizando inteligência artificial para gerar
              insights e recomendações automáticas.
            </p>
            <p className="mt-3">
              O serviço inclui sincronização de dados de campanhas, geração de relatórios automatizados,
              alertas de anomalias e ferramentas de criação de conteúdo assistidas por IA.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>3. Cadastro e Responsabilidades do Usuário</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>Você é responsável por manter a confidencialidade de suas credenciais de acesso.</li>
              <li>As informações fornecidas no cadastro devem ser verdadeiras e atualizadas.</li>
              <li>Você é responsável por todas as atividades realizadas em sua conta.</li>
              <li>É proibido compartilhar credenciais de acesso com terceiros não autorizados.</li>
              <li>Notifique-nos imediatamente em caso de acesso não autorizado à sua conta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>4. Integrações de Terceiros</h2>
            <p>
              A plataforma integra-se com serviços de terceiros (Meta Ads, Google Ads, Kommo CRM) mediante
              autorização explícita do usuário via OAuth. Ao conectar essas integrações:
            </p>
            <ul className="space-y-2 mt-3 list-disc list-inside">
              <li>Você autoriza o Cortex Growth a acessar os dados das plataformas conectadas em seu nome.</li>
              <li>Você declara ter os direitos necessários para compartilhar esses dados.</li>
              <li>Você pode revogar o acesso a qualquer momento desconectando a integração na plataforma ou diretamente nas configurações da plataforma de origem.</li>
            </ul>
            <p className="mt-3">
              O uso de dados obtidos via Meta Ads API está sujeito à{' '}
              <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#3b82f6' }}>
                Política de Plataforma do Meta
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>5. Planos e Pagamentos</h2>
            <div className="space-y-3">
              <p>O Cortex Growth oferece planos pagos com diferentes funcionalidades:</p>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <ul className="space-y-1">
                  <li><strong style={{ color: '#f1f5f9' }}>Starter</strong> — 1 usuário · sem integração CRM</li>
                  <li><strong style={{ color: '#f1f5f9' }}>Professional</strong> — até 3 usuários · com Kommo CRM</li>
                  <li><strong style={{ color: '#f1f5f9' }}>Enterprise</strong> — usuários ilimitados · com Kommo CRM</li>
                </ul>
              </div>
              <p>
                O não pagamento dentro do prazo pode resultar na suspensão ou encerramento do acesso à plataforma.
                Todas as cobranças são em Reais (BRL).
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>6. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo, código-fonte, design e funcionalidades do Cortex Growth são propriedade exclusiva
              da Cortex Tech Locação e Desenvolvimento de Sistemas Ltda. É proibida a reprodução, distribuição
              ou criação de obras derivadas sem autorização expressa por escrito.
            </p>
            <p className="mt-3">
              Os dados de campanhas e métricas sincronizados pertencem ao usuário e às plataformas de origem.
              O Cortex Growth não reivindica propriedade sobre esses dados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>7. Limitação de Responsabilidade</h2>
            <p>O Cortex Growth não se responsabiliza por:</p>
            <ul className="space-y-2 mt-3 list-disc list-inside">
              <li>Decisões tomadas com base nos dados ou insights gerados pela plataforma.</li>
              <li>Interrupções temporárias de serviço por manutenção ou falhas de terceiros.</li>
              <li>Perda de dados causada por falhas nas plataformas de origem (Meta, Google, Kommo).</li>
              <li>Desempenho ou resultados de campanhas de marketing.</li>
            </ul>
            <p className="mt-3">
              A responsabilidade máxima da Cortex Tech em relação a qualquer reclamação é limitada ao valor
              pago pelo usuário nos últimos 3 meses de assinatura.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>8. Disponibilidade do Serviço</h2>
            <p>
              Nos esforçamos para manter o Cortex Growth disponível 24/7, mas não garantimos disponibilidade
              ininterrupta. Realizamos manutenções programadas com aviso prévio quando possível.
              Não nos responsabilizamos por indisponibilidades causadas por falhas de infraestrutura de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>9. Encerramento de Conta</h2>
            <p>
              Você pode encerrar sua conta a qualquer momento entrando em contato conosco pelo e-mail{' '}
              <a href="mailto:contato@iacortextech.com.br" className="underline" style={{ color: '#3b82f6' }}>
                contato@iacortextech.com.br
              </a>.
              Após o encerramento, seus dados serão removidos conforme descrito em nossa{' '}
              <Link href="/privacy" className="underline" style={{ color: '#3b82f6' }}>Política de Privacidade</Link>.
            </p>
            <p className="mt-3">
              Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos, com ou sem aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>10. Alterações nos Termos</h2>
            <p>
              Podemos atualizar estes Termos periodicamente. Notificaremos usuários ativos por e-mail sobre
              mudanças significativas com pelo menos 15 dias de antecedência. O uso continuado da plataforma
              após a notificação implica concordância com os novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>11. Lei Aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de Fortaleza, CE,
              para dirimir quaisquer controvérsias decorrentes deste contrato.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1f5f9' }}>12. Contato</h2>
            <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <p><strong style={{ color: '#f1f5f9' }}>Cortex Tech Locação e Desenvolvimento de Sistemas Ltda</strong></p>
              <p className="mt-1">CNPJ: 52.722.681/0001-03</p>
              <p>E-mail: <a href="mailto:contato@iacortextech.com.br" className="underline" style={{ color: '#3b82f6' }}>contato@iacortextech.com.br</a></p>
              <p>Site: <a href="https://iacortextech.com.br" className="underline" style={{ color: '#3b82f6' }}>iacortextech.com.br</a></p>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 mt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-xs" style={{ color: '#475569' }}>
            © {new Date().getFullYear()} Cortex Tech Locação e Desenvolvimento de Sistemas Ltda. Todos os direitos reservados.
          </p>
          <Link href="/" className="text-xs transition-colors" style={{ color: '#475569' }}>
            Voltar ao início
          </Link>
        </div>
      </footer>
    </div>
  );
}
