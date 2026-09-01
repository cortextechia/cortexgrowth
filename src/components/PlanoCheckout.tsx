'use client';

import { useEffect, useState } from 'react';
import { apiService } from '@/lib/api';
import type { BillingStatus, BillingCycle, PlanOption } from '@/types';

// Bloco de escolher plano + gerar cobrança. Vive aqui porque tem DOIS pontos de uso
// reais: a aba de assinatura do dashboard e a tela de bloqueio (/assinatura), que
// fica fora de /dashboard para não virar loop de redirecionamento no 402.
//
// Quem está bloqueado precisa conseguir pagar: /api/billing/* é isento do gate
// (BILLING_EXEMPT_PREFIXES no backend), então este bloco funciona nos dois estados.

const CICLO: Record<BillingCycle, string> = {
  MONTHLY: 'Mensal',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

// Identidade visual por plano, a mesma do cadastro — o cliente reconhece o plano
// pela cor. As vars --plano-* existem nos dois temas.
const IDENTIDADE: Record<string, { cor: string; corSuave: string; chamada: string; publico: string; inclui: string[] }> = {
  DEMO: {
    cor: 'var(--plano-demo)', corSuave: 'var(--plano-demo-soft)',
    chamada: 'Para conhecer a plataforma', publico: 'até 4 usuários · mensal',
    inclui: ['Meta Ads e Google Ads no mesmo painel', 'CRM Cortex até 100 clientes', 'Relatórios e insights de IA'],
  },
  STARTER: {
    cor: 'var(--plano-starter)', corSuave: 'var(--plano-starter-soft)',
    chamada: 'Para quem toca sozinho', publico: '1 usuário',
    inclui: ['Meta Ads e Google Ads no mesmo painel', 'CRM Cortex até 100 clientes', 'Relatórios e insights de IA'],
  },
  PROFESSIONAL: {
    cor: 'var(--plano-pro)', corSuave: 'var(--plano-pro-soft)',
    chamada: 'Para equipe pequena', publico: 'até 3 usuários',
    inclui: ['Tudo do Starter', 'CRM Cortex sem limite de clientes', 'Integração com o Kommo'],
  },
  ENTERPRISE: {
    cor: 'var(--plano-enterprise)', corSuave: 'var(--plano-enterprise-soft)',
    chamada: 'Para agência', publico: 'usuários ilimitados',
    inclui: ['Tudo do Professional', 'Usuários sem limite', 'Vários clientes na mesma conta'],
  },
};

const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// Máscara de CPF/CNPJ. O CNPJ pode ser ALFANUMÉRICO desde 06/07/2026 (IN RFB
// 2.229/2024) — por isso o filtro aceita letras, não só dígitos.
const mascaraDoc = (v: string) => {
  const limpo = v.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);
  if (limpo.length <= 11) {
    return limpo.replace(/^(.{1,3})(.{1,3})?(.{1,3})?(.{1,2})?$/, (_, a, b, c, d) =>
      [a, b && `.${b}`, c && `.${c}`, d && `-${d}`].filter(Boolean).join(''));
  }
  return limpo.replace(/^(.{2})(.{1,3})?(.{1,3})?(.{1,4})?(.{1,2})?$/, (_, a, b, c, d, e) =>
    [a, b && `.${b}`, c && `.${c}`, d && `/${d}`, e && `-${e}`].filter(Boolean).join(''));
};

function BannerPlano({
  opcao, ciclo, selecionado, atual, onSelect,
}: {
  opcao: PlanOption;
  ciclo: BillingCycle;
  selecionado: boolean;
  atual: boolean;
  onSelect: () => void;
}) {
  const id = IDENTIDADE[opcao.plan] ?? IDENTIDADE.STARTER!;
  const info = opcao.cycles.find((c) => c.cycle === ciclo) ?? opcao.cycles[0]!;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selecionado}
      className="relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left transition-shadow"
      style={{
        // Fundo do não-selecionado é var(--bg-elevated), NÃO o rgba(255,255,255,X) do
        // cadastro: aquele é dark-only e sumiria no tema claro.
        backgroundColor: selecionado ? 'var(--bg-surface)' : 'var(--bg-elevated)',
        backgroundImage: selecionado ? `linear-gradient(100deg, ${id.corSuave} 0%, transparent 62%)` : 'none',
        border: `1px solid ${selecionado ? id.cor : 'var(--border)'}`,
        boxShadow: selecionado ? `0 0 0 1px ${id.cor}22, 0 14px 40px -22px ${id.cor}` : 'none',
      }}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: id.cor, opacity: selecionado ? 1 : 0.45 }} />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold tracking-wide" style={{ color: selecionado ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {opcao.plan}
            </span>
            {atual && (
              <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Plano atual
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{id.chamada} · {id.publico}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-2xl font-extrabold leading-none tabular-nums tracking-tight"
            style={{ color: selecionado ? id.cor : 'var(--text-secondary)' }}>
            {fmtMoney(info.monthlyEquivalent)}
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>por mês</p>
        </div>
      </div>

      {/* info.cycle, não `ciclo`: plano que não tem o ciclo selecionado (o DEMO é só
          mensal) cai no que ele oferece, e o texto tem que acompanhar o preço. */}
      {info.cycle !== 'MONTHLY' && (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--badge-success-text)' }}>
          {fmtMoney(info.total)} a cada {info.months} meses · você economiza <strong>{fmtMoney(info.savings)}</strong>
        </p>
      )}

      <div className="grid transition-[grid-template-rows] duration-300" style={{ gridTemplateRows: selecionado ? '1fr' : '0fr' }}>
        <ul className="overflow-hidden">
          {id.inclui.map((item) => (
            <li key={item} className="mt-2 flex items-start gap-2 text-xs first:mt-3" style={{ color: 'var(--text-secondary)' }}>
              <span aria-hidden style={{ color: id.cor }}>✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}

export default function PlanoCheckout({
  status, titulo, onAtualizado,
}: {
  status: BillingStatus;
  titulo?: string;
  onAtualizado?: () => void | Promise<void>;
}) {
  const [planos, setPlanos] = useState<PlanOption[]>([]);
  // Começa no que a pessoa JÁ escolheu no cadastro (a cobrança pendente guarda essa
  // escolha; a org nasce sempre STARTER/MONTHLY). Fazer ela escolher de novo o que
  // acabou de escolher é atrito à toa.
  const planoInicial = status.pendingCharge?.plan ?? status.plan;
  const cicloInicial = status.pendingCharge?.billingCycle ?? status.billingCycle;
  const [plano, setPlano] = useState<string>(planoInicial);
  const [ciclo, setCiclo] = useState<BillingCycle>(cicloInicial);
  const [doc, setDoc] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiService.getPlans().then((r) => setPlanos(r.data)).catch(() => setPlanos([]));
  }, []);

  const opcaoSelecionada = planos.find((p) => p.plan === plano);
  // Nem todo plano aceita todo ciclo (o DEMO é só mensal). Com o seletor em Anual e o
  // DEMO marcado, o ciclo pedido não existe: cai no que o plano oferece, senão a tela
  // ficaria sem preço e o checkout enviaria um ciclo que o backend recusa com 400.
  const cicloSelecionado = opcaoSelecionada?.cycles.find((c) => c.cycle === ciclo) ?? opcaoSelecionada?.cycles[0];
  const cicloEfetivo = cicloSelecionado?.cycle ?? ciclo;
  const precoSelecionado = cicloSelecionado?.total ?? null;
  // Compara com o que a tela ABRIU marcado, não com o plano da org: quem escolheu
  // ENTERPRISE no cadastro não está "trocando de plano" ao pagar o que escolheu.
  const trocandoPlano = plano !== planoInicial || cicloEfetivo !== cicloInicial;
  const docIncompleto = !status.hasTaxId && doc.replace(/[^0-9A-Z]/gi, '').length < 11;

  const gerarCobranca = async () => {
    setGerando(true);
    setErro(null);
    try {
      const r = await apiService.createCheckout({
        plan: plano, billingCycle: cicloEfetivo,
        ...(status.hasTaxId ? {} : { taxId: doc }),
      });
      await onAtualizado?.();
      // A fatura abre em aba nova: o pagamento acontece no Asaas, não aqui.
      window.open(r.data.invoiceUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(msg ?? 'Não foi possível gerar a cobrança agora. Tente em alguns minutos.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      {/* Só quando a cobrança FOI emitida: a linha do cadastro não tem fatura para abrir. */}
      {status.pendingCharge?.invoiceUrl && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
          style={{ backgroundColor: 'var(--badge-warn-bg)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--badge-warn-text)' }}>
              Você tem uma cobrança em aberto
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {fmtMoney(status.pendingCharge.amount)}
              {status.pendingCharge.dueDate && ` · vence em ${fmtDate(status.pendingCharge.dueDate)}`}
            </p>
          </div>
          <a href={status.pendingCharge.invoiceUrl} target="_blank" rel="noopener noreferrer"
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: 'var(--badge-warn-text)', color: 'var(--bg-base)' }}>
            Abrir fatura
          </a>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {titulo ?? (status.hasActiveSubscription
              ? 'Trocar de plano'
              : status.subscriptionEnds === null ? 'Escolher plano' : 'Reativar assinatura')}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {/* Com assinatura ativa não há o que pagar aqui: o Asaas emite a próxima
                cobrança sozinho. Oferecer "pagar" sugeriria pendência inexistente — e
                gerar cobrança agora criaria uma fatura extra pra quem já está em dia. */}
            {status.hasActiveSubscription
              ? 'A próxima cobrança é emitida automaticamente e chega no seu e-mail. Você não precisa fazer nada.'
              : 'O pagamento é por PIX, boleto ou cartão — você escolhe na fatura.'}
          </p>
        </div>

        <div className="flex rounded-lg p-0.5" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          {(['MONTHLY', 'SEMIANNUAL', 'ANNUAL'] as BillingCycle[]).map((c) => (
            <button key={c} type="button" onClick={() => setCiclo(c)}
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={ciclo === c
                ? { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
                : { color: 'var(--text-muted)' }}>
              {CICLO[c]}
            </button>
          ))}
        </div>
      </div>

      {/* "Plano atual" só para quem JÁ pagou por ele: org nova nasce STARTER por default,
          e marcar isso como "atual" para quem escolheu outro no cadastro seria mentira. */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {planos.map((op) => (
          <BannerPlano key={op.plan} opcao={op} ciclo={ciclo}
            selecionado={plano === op.plan}
            atual={status.paymentsCount > 0 && status.plan === op.plan}
            onSelect={() => setPlano(op.plan)} />
        ))}
      </div>

      {/* Documento só na PRIMEIRA assinatura: depois o cliente já existe no gateway */}
      {!status.hasTaxId && (
        <div className="mt-4">
          <label htmlFor="doc" className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            CPF ou CNPJ do titular
          </label>
          <input id="doc" value={doc} onChange={(e) => setDoc(mascaraDoc(e.target.value))}
            placeholder="000.000.000-00" inputMode="text"
            className="mt-1 w-full max-w-xs rounded-lg px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Exigido pelo emissor da cobrança. Pedimos uma vez só.
          </p>
        </div>
      )}

      {erro && <p className="mt-3 text-sm" style={{ color: 'var(--badge-error-text)' }}>{erro}</p>}

      {/* Assinatura ativa e nenhum plano novo escolhido = não há ação a oferecer.
          O botão some em vez de ficar desabilitado: botão apagado ainda sugere que
          existe algo pendente ali. */}
      {(!status.hasActiveSubscription || trocandoPlano) && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={gerarCobranca} disabled={gerando || docIncompleto}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              {/* "Gerar cobrança" é linguagem de quem EMITE. Para quem paga, o botão
                  leva à fatura do Asaas, onde ele escolhe PIX, boleto ou cartão. */}
              {gerando ? 'Abrindo pagamento…' : trocandoPlano ? 'Mudar de plano e pagar' : 'Ir para o pagamento'}
            </button>
            {precoSelecionado !== null && (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {/* "a cada {rótulo}" sai errado no anual ("a cada anual") — contar em meses */}
                {fmtMoney(precoSelecionado)} {cicloEfetivo === 'MONTHLY' ? 'por mês' : `a cada ${cicloSelecionado?.months ?? ''} meses`}
              </span>
            )}
          </div>

          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {trocandoPlano
              ? 'A assinatura atual é encerrada e a nova passa a valer quando o pagamento for confirmado.'
              : 'O acesso é liberado assim que o pagamento for confirmado — no PIX leva segundos, no boleto pode levar até 3 dias úteis. Você recebe um e-mail quando entrar.'}
          </p>
        </>
      )}

      {status.hasActiveSubscription && !trocandoPlano && status.subscriptionEnds && (
        <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          Seu ciclo atual vai até <strong>{fmtDate(status.subscriptionEnds)}</strong>. Para mudar de plano,
          escolha outro acima.
        </p>
      )}
    </div>
  );
}
