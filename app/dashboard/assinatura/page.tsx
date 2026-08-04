'use client';

import { useEffect, useState } from 'react';
import { apiService } from '@/lib/api';
import PlanoCheckout from '@/components/PlanoCheckout';
import ConfirmarSenha from '@/components/ConfirmarSenha';
import type { BillingStatus, PaymentRecord, BillingCycle, PaymentStatus } from '@/types';

const CICLO: Record<BillingCycle, string> = {
  MONTHLY: 'Mensal',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

const STATUS_PGTO: Record<PaymentStatus, { label: string; cor: string; fundo: string }> = {
  CONFIRMED: { label: 'Pago',      cor: 'var(--badge-success-text)', fundo: 'var(--badge-success-bg)' },
  PENDING:   { label: 'Pendente',  cor: 'var(--badge-warn-text)',    fundo: 'var(--badge-warn-bg)' },
  OVERDUE:   { label: 'Vencido',   cor: 'var(--badge-error-text)',   fundo: 'var(--badge-error-bg)' },
  REFUNDED:  { label: 'Estornado', cor: 'var(--text-muted)',         fundo: 'var(--bg-elevated)' },
  CANCELLED: { label: 'Cancelado', cor: 'var(--text-muted)',         fundo: 'var(--bg-elevated)' },
};

const METODO: Record<string, string> = {
  PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', MANUAL: 'Manual',
};

const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const card = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border)',
};

function Kpi({ titulo, valor, nota, cor }: { titulo: string; valor: string; nota?: string; cor?: string }) {
  return (
    <div className="rounded-xl p-4" style={card}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{titulo}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: cor ?? 'var(--text-primary)' }}>{valor}</p>
      {nota && <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{nota}</p>}
    </div>
  );
}

export default function AssinaturaPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [pagamentos, setPagamentos] = useState<PaymentRecord[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pedindoSenha, setPedindoSenha] = useState(false);
  const [avisoCancelar, setAvisoCancelar] = useState<string | null>(null);
  // Erro da AÇÃO, separado do erro de carregamento: `erro` dispara o return antecipado
  // lá em cima e apagaria a tela inteira só porque um cancelamento falhou.
  const [erroCancelar, setErroCancelar] = useState<string | null>(null);

  const recarregar = () =>
    Promise.all([apiService.getBillingStatus(), apiService.getBillingPayments()])
      .then(([s, p]) => { setStatus(s.data); setPagamentos(p.data); });

  useEffect(() => {
    recarregar()
      .catch(() => setErro('Não foi possível carregar os dados da assinatura.'))
      .finally(() => setCarregando(false));
  }, []);

  // Mesma razão da tela de bloqueio: quem confirma o pagamento é o webhook do Asaas,
  // segundos depois. Sem isto a tela segue mostrando "cobrança em aberto" para quem
  // já pagou. Consulta só o status (1 request); o histórico só é recarregado quando a
  // cobrança de fato sai, para não gastar cota do rate limit por IP à toa.
  const chargeId = status?.pendingCharge?.paymentId ?? null;
  useEffect(() => {
    if (!chargeId) return;

    const rever = () => {
      if (document.hidden) return;
      apiService.getBillingStatus()
        .then((s) => {
          if (s.data.pendingCharge?.paymentId === chargeId) setStatus(s.data);
          else recarregar().catch(() => undefined); // saiu: traz o histórico junto
        })
        .catch(() => undefined);
    };
    // Mesmo ritmo em dois tempos da tela de bloqueio: 5s nos 2 primeiros minutos,
    // depois 20s por mais ~10 min. Teto curto desistiria bem na hora em que o cliente
    // termina de pagar.
    const RAPIDAS = 24;
    const TOTAL = RAPIDAS + 30;
    let n = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const agendar = () => {
      if (n >= TOTAL) return;
      const intervalo = n < RAPIDAS ? 5000 : 20000;
      n++;
      timer = setTimeout(() => { rever(); agendar(); }, intervalo);
    };
    agendar();

    document.addEventListener('visibilitychange', rever);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', rever); };
  }, [chargeId]);

  if (carregando) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando assinatura…</p>;
  }
  if (erro || !status) {
    return <p className="text-sm" style={{ color: 'var(--badge-error-text)' }}>{erro}</p>;
  }

  // Sem subscriptionEnds a cobrança ainda é manual e não há prazo a exibir —
  // mostrar "0 dias" ali seria mentira.
  const semPrazo = status.subscriptionEnds === null;
  const dias = status.daysLeft ?? 0;
  const corPrazo = semPrazo
    ? 'var(--text-primary)'
    : dias < 0 ? 'var(--badge-error-text)'
    : dias <= 7 ? 'var(--badge-warn-text)'
    : 'var(--badge-success-text)';

  const totalCiclo = status.monthlyListPrice * (status.billingCycle === 'ANNUAL' ? 12 : status.billingCycle === 'SEMIANNUAL' ? 6 : 1);
  const economia = Math.round((totalCiclo - status.price) * 100) / 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Assinatura</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Seu plano, o que já foi pago e quanto tempo resta de acesso.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          titulo="Plano atual"
          valor={status.plan}
          nota={`${CICLO[status.billingCycle]} · ${fmtMoney(status.price)}`}
        />
        <Kpi
          titulo={semPrazo ? 'Acesso' : dias < 0 ? 'Vencida há' : 'Tempo restante'}
          valor={semPrazo ? 'Sem prazo' : `${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`}
          nota={semPrazo ? 'cobrança manual — sem vencimento definido' : `vence em ${fmtDate(status.subscriptionEnds)}`}
          cor={corPrazo}
        />
        <Kpi
          titulo="Meses pagos"
          valor={String(status.monthsPaid)}
          nota={`${status.paymentsCount} ${status.paymentsCount === 1 ? 'pagamento' : 'pagamentos'} confirmados`}
        />
        <Kpi
          titulo="Total pago"
          valor={fmtMoney(status.totalPaid)}
          nota={status.lastPaymentAt ? `último em ${fmtDate(status.lastPaymentAt)}` : 'nenhum pagamento registrado'}
        />
      </div>

      {status.billingCycle !== 'MONTHLY' && economia > 0 && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ ...card, color: 'var(--badge-success-text)' }}>
          No ciclo {CICLO[status.billingCycle].toLowerCase()} você paga {fmtMoney(status.monthlyEquivalent)}/mês —
          economia de {fmtMoney(economia)} por ciclo em relação ao mensal.
        </div>
      )}

      {status.orgStatus !== 'ACTIVE' && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ ...card, color: 'var(--badge-error-text)' }}>
          Esta conta está com status <strong>{status.orgStatus}</strong>. O acesso à plataforma fica bloqueado
          até a regularização.
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={card}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Histórico de pagamentos</p>
        </div>

        {pagamentos.length === 0 ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            Nenhum pagamento registrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  {['Período', 'Plano', 'Ciclo', 'Valor', 'Método', 'Pago em', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p) => {
                  const s = STATUS_PGTO[p.status];
                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {fmtDate(p.periodStart)} — {fmtDate(p.periodEnd)}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{p.plan}</td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{CICLO[p.billingCycle]}</td>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{fmtMoney(p.amount)}</td>
                      {/* Enquanto está PENDENTE o método é desconhecido: o cliente ainda
                          vai escolher PIX ou boleto na fatura. Mostrar "Manual" seria mentira. */}
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                        {p.status === 'PENDING' ? '—' : METODO[p.method] ?? p.method}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.paidAt)}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ color: s.cor, backgroundColor: s.fundo }}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PlanoCheckout status={status} onAtualizado={() => recarregar().catch(() => undefined)} />

      {/* FORA do bloco de cancelar: assim que cancela, `hasActiveSubscription` vira
          false e a seção some — se a confirmação morasse lá dentro, o cliente clicaria
          e a tela mudaria sem dizer nada. */}
      {avisoCancelar && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ ...card, borderColor: 'var(--badge-success-text)', color: 'var(--badge-success-text)' }}>
          {avisoCancelar}
        </div>
      )}

      {/* Cancelar só aparece com assinatura viva. O acesso NÃO some na hora: vai até
          o fim do período pago — por isso o aviso diz a data, não "você perde tudo". */}
      {status.hasActiveSubscription && (
        <div className="rounded-xl px-4 py-3" style={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Cancelar assinatura</p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                As próximas cobranças param.{' '}
                {status.subscriptionEnds
                  ? `Seu acesso continua até ${fmtDate(status.subscriptionEnds)}.`
                  : 'O acesso continua até o fim do período já pago.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPedindoSenha(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ border: '1px solid var(--badge-error-text)', color: 'var(--badge-error-text)' }}
            >
              Cancelar assinatura
            </button>
          </div>
          {erroCancelar && (
            <p className="mt-3 text-sm" style={{ color: 'var(--badge-error-text)' }}>{erroCancelar}</p>
          )}
        </div>
      )}

      {pedindoSenha && (
        <ConfirmarSenha
          titulo="Cancelar assinatura"
          aviso={status.subscriptionEnds
            ? `As próximas cobranças param. Seu acesso continua até ${fmtDate(status.subscriptionEnds)}.`
            : 'As próximas cobranças param.'}
          rotuloConfirmar="Cancelar assinatura"
          onCancelar={() => setPedindoSenha(false)}
          onConfirmado={async (stepUpToken) => {
            setErroCancelar(null);
            try {
              const r = await apiService.cancelSubscription(stepUpToken);
              setPedindoSenha(false);
              setAvisoCancelar(r.message);
              await recarregar().catch(() => undefined);
            } catch (e) {
              const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
              setPedindoSenha(false);
              setErroCancelar(msg ?? 'Não foi possível cancelar agora. Tente em alguns minutos.');
            }
          }}
        />
      )}
    </div>
  );
}
