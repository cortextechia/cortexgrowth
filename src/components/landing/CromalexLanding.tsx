'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import type { BillingCycle } from '@/types';

// Link do "Falar no WhatsApp". Vazio = o botão não aparece (não publicar com número inventado).
const WHATSAPP_URL = '';

const DISPLAY = 'var(--font-cx-display), system-ui, sans-serif';
const MONO = 'var(--font-cx-mono), ui-monospace, monospace';

// Preços espelham `planLimits.ts` do backend (PRECO_MENSAL_NO_CICLO do CRM e o desconto
// −10%/−20% do STARTER). Mudou lá, muda aqui.
const PRECOS: Record<BillingCycle, {
  crm: { preco: string; economia: string };
  growth: { preco: string; economia: string };
  nota: string;
}> = {
  MONTHLY: {
    crm: { preco: '149', economia: '' },
    growth: { preco: '297', economia: '' },
    nota: '*Preço por mês no plano mensal, cobrado todo mês. Sem fidelidade: cancele quando quiser.\nNo anual, o CRM sai por R$ 99/mês e o Growth + CRM por R$ 237,60/mês.',
  },
  SEMIANNUAL: {
    crm: { preco: '129', economia: 'Economize R$ 120 por semestre' },
    growth: { preco: '267,30', economia: 'Economize R$ 178,20 por semestre' },
    nota: '*Preço equivalente por mês no plano semestral. Cobrança única a cada 6 meses: CRM R$ 774,00 · Growth + CRM R$ 1.603,80.\nNo mensal: CRM R$ 149/mês · Growth + CRM R$ 297/mês. Pagamento por PIX ou boleto.',
  },
  ANNUAL: {
    crm: { preco: '99', economia: 'Economize R$ 600 por ano' },
    growth: { preco: '237,60', economia: 'Economize R$ 712,80 por ano' },
    nota: '*Preço equivalente por mês no plano anual. Cobrança única a cada 12 meses: CRM R$ 1.188,00 · Growth + CRM R$ 2.851,20.\nNo mensal: CRM R$ 149/mês · Growth + CRM R$ 297/mês. Pagamento por PIX ou boleto.',
  },
};

const CICLOS: [BillingCycle, string][] = [['MONTHLY', 'Mensal'], ['SEMIANNUAL', 'Semestral'], ['ANNUAL', 'Anual · até −33%']];

const DORES = [
  ['O lead some no celular do vendedor', 'A conversa fica num aparelho só. Se ele sai de férias, o cliente fica sem resposta.'],
  ['A Meta conta conversa, não venda', 'O gerenciador diz que a campanha trouxe 170 conversas. Quantas compraram? Ele não sabe.'],
  ['A verba vai para o anúncio errado', 'Sem saber quem vende, você corta a campanha que dava lucro e mantém a que só dava curtida.'],
];

const PASSOS = [
  ['1 · CLIQUE', 'A pessoa clica no anúncio e manda “oi”', 'Ela abre o WhatsApp da sua empresa, como sempre. Nada de formulário, nada de link estranho.'],
  ['2 · CARD', 'O card nasce no CRM com o anúncio', 'O Cromalex lê de qual anúncio a conversa veio e cria o lead sozinho, com campanha e conjunto.'],
  ['3 · VENDA', 'A venda volta para a campanha', 'Quando o vendedor marca a venda, o valor aparece no painel daquela campanha. É o seu ROAS de verdade.'],
];

const RECURSOS = [
  ['WHATSAPP DA EQUIPE', 'Cada vendedor no próprio número', 'Conecte por QR code, como no WhatsApp Web. Fotos, áudios e localização aparecem no card.'],
  ['FUNIL VISUAL', 'Kanban com as suas etapas', 'Arraste o card, crie tarefas e follow-ups, marque o motivo de cada perda.'],
  ['AUTOMAÇÕES', 'Boas-vindas e cobrança no automático', 'Mensagem para todo lead novo, lembrete para quem sumiu e rodízio entre vendedores.'],
  ['DISPAROS', 'Promoção para quem já é cliente', 'Escolha por tag ou tipo de cliente. O envio sai aos poucos para proteger o seu número.'],
  ['PAINEL META + GOOGLE', 'CPL por lead, ROAS por venda', 'Gasto das duas plataformas lado a lado com o que o CRM vendeu.'],
  ['INTELIGÊNCIA ARTIFICIAL', 'Um analista que lê tudo por você', 'Relatório que cruza marketing e vendas e diz, em português, onde está o gargalo.'],
  ['ALERTAS E RELATÓRIOS', 'O número chega no seu grupo', 'Relatório agendado no WhatsApp ou Telegram e alerta quando o gasto sobe sem lead.'],
];

const COMPARATIVO = [
  ['De onde veio o lead', '“Acho que foi do Instagram”', 'Anúncio, conjunto e campanha no card'],
  ['Conversa do cliente', 'No celular de um vendedor', 'No CRM, visível para o gestor'],
  ['Lead que sumiu', 'Esquecido', 'Lembrete automático'],
  ['ROAS', 'Estimado pela plataforma', 'Calculado com a venda real'],
  ['Relatório para o dono', 'Montado na mão, toda semana', 'Chega sozinho no grupo'],
];

const DUVIDAS = [
  ['Preciso trocar meu número de WhatsApp?', 'Não. Você conecta o número que já usa lendo um QR code, como no WhatsApp Web.'],
  ['Funciona com Google Ads?', 'Sim. O painel mostra gasto, cliques e conversões de cada campanha do Google, e o lead do Google entra no CRM marcado como Google. A ligação de cada lead à campanha exata do Google ainda depende do seu site.'],
  ['Tem fidelidade?', 'No mensal, não: você cancela quando quiser. Semestral e anual são pagos pelo período, com desconto, e o acesso vai até o fim dele.'],
  ['Como eu pago?', 'Por PIX ou boleto. O acesso libera assim que o pagamento é confirmado.'],
  ['Quantas pessoas podem usar?', 'O CRM vem com 1 usuário e o Growth + CRM com 3. Cada vendedor vê só os próprios clientes; o gestor vê tudo.'],
  ['Meus dados ficam seguros?', 'Cada empresa vê só os próprios dados, e as chaves de acesso às suas contas ficam guardadas criptografadas.'],
];

function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="cx-logo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--cx-logo-1)' }} />
          <stop offset="0.45" style={{ stopColor: 'var(--cx-logo-2)' }} />
          <stop offset="0.6" style={{ stopColor: 'var(--cx-logo-3)' }} />
          <stop offset="1" style={{ stopColor: 'var(--cx-logo-4)' }} />
        </linearGradient>
      </defs>
      <path d="M31 11 A14 14 0 1 0 31 29" fill="none" stroke="url(#cx-logo)" strokeWidth="7" strokeLinecap="round" />
      <rect x="27" y="16.5" width="9" height="7" rx="2" style={{ fill: 'var(--cx-lime)' }} />
    </svg>
  );
}

function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <Logo />
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em' }}>
        Cromalex <span style={{ fontWeight: 600, color: 'var(--cx-text-3)' }}>Growth</span>
      </span>
    </span>
  );
}

function BotaoTema() {
  const { resolvedTheme, setTheme } = useTheme();
  // false no servidor, true no navegador — sem setState em effect.
  const montado = useSyncExternalStore(() => () => {}, () => true, () => false);
  // Antes de montar o tema é desconhecido no servidor: reserva o espaço sem ícone.
  if (!montado) return <span className="inline-block h-11 w-11" />;
  const escuro = resolvedTheme !== 'light';
  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? 'light' : 'dark')}
      aria-label={escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      className="cx-btn-line inline-flex h-11 w-11 items-center justify-center rounded-xl"
    >
      {escuro ? (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
    </button>
  );
}

// Número que conta de 0 até o alvo quando entra na tela. Escreve direto no DOM: o
// servidor já entrega o valor final, e sem JS (ou com movimento reduzido) ele fica.
function Contador({ alvo, sufixo = '' }: { alvo: number; sufixo?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.textContent = `0${sufixo}`;
    let raf = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      obs.disconnect();
      const inicio = performance.now();
      const passo = (t: number) => {
        const p = Math.min((t - inicio) / 1400, 1);
        el.textContent = `${Math.round(alvo * (1 - Math.pow(1 - p, 3)))}${sufixo}`;
        if (p < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); el.textContent = `${alvo}${sufixo}`; };
  }, [alvo, sufixo]);
  return <span ref={ref}>{alvo}{sufixo}</span>;
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="m-0" style={{ fontFamily: MONO, fontSize: 13, color: 'var(--cx-label)' }}>{children}</p>;
}

function Titulo({ children, cromo = false, className = '' }: { children: React.ReactNode; cromo?: boolean; className?: string }) {
  return (
    <h2
      className={`m-0 ${cromo ? 'cx-cromo' : ''} ${className}`}
      style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.05, letterSpacing: '-0.035em' }}
    >
      {children}
    </h2>
  );
}

function BotaoWhatsApp({ className = '' }: { className?: string }) {
  if (!WHATSAPP_URL) return null;
  return (
    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={`cx-btn-line rounded-[14px] px-6 py-[15px] text-base font-semibold no-underline ${className}`}>
      Falar no WhatsApp
    </a>
  );
}

const linkCadastro = (plano: 'CRM' | 'STARTER', ciclo: BillingCycle) => `/auth/register?plano=${plano}&ciclo=${ciclo}`;

export default function CromalexLanding({ fontClass }: { fontClass: string }) {
  const raiz = useRef<HTMLDivElement>(null);
  const cartao = useRef<HTMLDivElement>(null);
  const [ciclo, setCiclo] = useState<BillingCycle>('ANNUAL');
  const precos = PRECOS[ciclo];
  const comDesconto = ciclo !== 'MONTHLY';

  // Seções entram suaves ao rolar. A classe de esconder só liga depois do JS, então sem JS
  // (ou com movimento reduzido) tudo aparece normal.
  useEffect(() => {
    const el = raiz.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.dataset.anim = 'on';
    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) { e.target.classList.add('cx-in'); obs.unobserve(e.target); }
    }, { threshold: 0.12 });
    el.querySelectorAll('.cx-reveal').forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  // Cartão do hero inclina seguindo o mouse.
  const inclinar = (e: React.MouseEvent<HTMLDivElement>) => {
    const c = cartao.current;
    if (!c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = `perspective(1200px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`;
  };
  const soltar = () => { if (cartao.current) cartao.current.style.transform = 'perspective(1200px) rotateY(-6deg) rotateX(3deg)'; };

  const caixa = 'mx-auto box-border max-w-[1200px] px-4 sm:px-6';
  const cardBase = { background: 'var(--cx-surface)', border: '1px solid var(--cx-border)' };
  const textoSec = { color: 'var(--cx-text-2)' };

  return (
    <div ref={raiz} className={`cx min-h-screen overflow-x-hidden ${fontClass}`}>

      {/* ── Navegação ── */}
      <nav className="sticky top-0 z-50" style={{ background: 'var(--cx-nav)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--cx-line)' }}>
        <div className={`${caixa} flex items-center justify-between gap-4 py-3`}>
          <Link href="/" className="no-underline" style={{ color: 'var(--cx-text)' }}><Marca /></Link>
          <div className="hidden items-center gap-6 text-sm md:flex">
            <a href="#produto" className="cx-link no-underline">Produto</a>
            <a href="#como" className="cx-link no-underline">Como funciona</a>
            <a href="#precos" className="cx-link no-underline">Preços</a>
            <a href="#duvidas" className="cx-link no-underline">Dúvidas</a>
          </div>
          <div className="flex items-center gap-2">
            <BotaoTema />
            <Link href="/auth/login" className="cx-link hidden rounded-xl px-4 py-2.5 text-sm font-semibold no-underline sm:inline-block">Entrar</Link>
            <a href="#precos" className="cx-btn-lime rounded-xl px-[18px] py-2.5 text-sm font-bold no-underline">Assinar</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute right-[-10%] top-[10%] h-[90%] w-[60%] rounded-full" style={{ background: 'radial-gradient(closest-side, var(--cx-glow), transparent)' }} />
        <div className={`${caixa} relative grid items-center gap-12 pb-24 pt-16 md:grid-cols-2 md:pt-24`}>
          <div className="flex flex-col gap-6">
            <p className="m-0 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5" style={{ fontFamily: MONO, fontSize: 12, border: '1px solid var(--cx-border-2)', color: 'var(--cx-text-2)' }}>
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: 'var(--cx-lime)' }} />
              Meta Ads · Google Ads · WhatsApp · IA
            </p>
            <h1 className="cx-cromo m-0" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 1, letterSpacing: '-0.045em' }}>
              Pare de adivinhar qual anúncio vende.
            </h1>
            <p className="m-0 max-w-[560px] text-[19px] leading-relaxed" style={textoSec}>
              Todo lead que chega no WhatsApp entra no CRM já com o anúncio que o trouxe. O time atende ali mesmo, e quando a venda fecha você vê quanto cada campanha faturou.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#precos" className="cx-btn-lime rounded-[14px] px-6 py-[15px] text-base font-bold no-underline">Ver planos</a>
              <BotaoWhatsApp />
            </div>
            <p className="m-0 text-sm" style={{ color: 'var(--cx-text-3)' }}>
              CRM com WhatsApp a partir de <strong className="whitespace-nowrap" style={{ color: 'var(--cx-text)' }}>R$ 99/mês*</strong> · mensal sem fidelidade
            </p>
          </div>

          <div onMouseMove={inclinar} onMouseLeave={soltar} className="min-w-0">
            <div
              ref={cartao}
              className="cx-tilt flex flex-col gap-3 rounded-[22px] p-[18px]"
              style={{ background: 'linear-gradient(180deg, var(--cx-card-1), var(--cx-card-2))', border: '1px solid var(--cx-border-2)', boxShadow: '0 40px 90px var(--cx-shadow)', transform: 'perspective(1200px) rotateY(-6deg) rotateX(3deg)' }}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--cx-text-3)' }}>NOVO LEAD · AGORA</span>
                <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: 'var(--cx-lime)', color: 'var(--cx-on-lime)' }}>VEIO DO ANÚNCIO</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-[42px] w-[42px] shrink-0 rounded-full" style={{ background: 'var(--cx-border-2)' }} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">Lead novo</span>
                  <span className="text-xs" style={{ color: 'var(--cx-text-3)' }}>Anúncio “Vídeo do produto” · campanha Engajamento</span>
                </div>
              </div>
              <div className="rounded-xl px-3.5 py-3 text-sm" style={{ background: 'var(--cx-bg)', border: '1px solid var(--cx-border)', color: 'var(--cx-text-2)' }}>
                Oi! Vi o anúncio de vocês e queria um orçamento.
              </div>
              <div className="max-w-[80%] self-end rounded-xl px-3.5 py-3 text-sm" style={{ background: 'var(--cx-tint-bg)', color: 'var(--cx-tint-text)' }}>
                Olá! Já te mando os valores.
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[['Etapa', 'Orçamento'], ['Origem', 'Meta'], ['Conjunto', 'Público quente']].map(([k, v]) => (
                  <div key={k} className="min-w-0 rounded-[10px] p-2.5" style={{ background: 'var(--cx-bg)', border: '1px solid var(--cx-border)' }}>
                    <span className="block text-[11px]" style={{ color: 'var(--cx-text-3)' }}>{k}</span>
                    <span className="block truncate text-[13px] font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Integrações ── */}
      <div style={{ borderTop: '1px solid var(--cx-line)', borderBottom: '1px solid var(--cx-line)' }}>
        <div className={`${caixa} flex flex-wrap items-center justify-center gap-x-10 gap-y-3.5 py-6`} style={{ fontFamily: MONO, fontSize: 14, color: 'var(--cx-text-3)' }}>
          <span>CONECTA COM</span>
          {['Meta Ads', 'Google Ads', 'WhatsApp', 'Telegram'].map((n) => <span key={n} style={{ color: 'var(--cx-text)' }}>{n}</span>)}
        </div>
      </div>

      {/* ── O problema ── */}
      <section className={`${caixa} cx-reveal flex flex-col gap-10 pb-10 pt-28`}>
        <div className="flex max-w-[760px] flex-col gap-3.5">
          <Rotulo>O PROBLEMA</Rotulo>
          <Titulo>Você paga a Meta por mensagem. Ninguém sabe qual mensagem virou venda.</Titulo>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {DORES.map(([t, d], i) => (
            <div key={t} className="flex flex-col gap-2.5 rounded-[20px] p-7" style={cardBase}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, color: 'var(--cx-dim)' }}>0{i + 1}</span>
              <h3 className="m-0 text-[19px] font-bold">{t}</h3>
              <p className="m-0 text-[15px] leading-relaxed" style={textoSec}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section id="como" className={`${caixa} cx-reveal flex scroll-mt-20 flex-col gap-10 py-24`}>
        <div className="flex max-w-[760px] flex-col gap-3.5">
          <Rotulo>COMO FUNCIONA</Rotulo>
          <Titulo cromo>Do anúncio à venda, sem planilha no meio.</Titulo>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PASSOS.map(([tag, t, d]) => (
            <div key={tag} className="flex flex-col gap-3 rounded-[20px] p-7" style={{ border: '1px solid var(--cx-border-2)' }}>
              <span className="self-start rounded-full px-2.5 py-1" style={{ fontFamily: MONO, fontSize: 12, background: 'var(--cx-lime)', color: 'var(--cx-on-lime)' }}>{tag}</span>
              <h3 className="m-0 text-xl font-bold">{t}</h3>
              <p className="m-0 text-[15px] leading-relaxed" style={textoSec}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Produto ── */}
      <section id="produto" className={`${caixa} cx-reveal flex scroll-mt-20 flex-col gap-10 pb-28 pt-10`}>
        <div className="flex max-w-[760px] flex-col gap-3.5">
          <Rotulo>O PRODUTO</Rotulo>
          <Titulo>Tudo que o seu time comercial usa, num lugar só.</Titulo>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-[22px] p-8 md:col-span-2" style={{ background: 'linear-gradient(160deg, var(--cx-hl), var(--cx-surface) 60%)', border: '1px solid var(--cx-hl-border)' }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--cx-label)' }}>RASTREIO POR ANÚNCIO</span>
            <h3 className="m-0 text-[28px] font-extrabold" style={{ fontFamily: DISPLAY, letterSpacing: '-0.02em' }}>Cada lead com nome, sobrenome e anúncio de origem.</h3>
            <p className="m-0 max-w-[620px] text-[15px] leading-relaxed" style={textoSec}>Veja quantos contatos, orçamentos e vendas cada anúncio e cada conjunto trouxe. Sem pedir nada para o cliente e sem configurar código.</p>
          </div>
          {RECURSOS.map(([tag, t, d]) => (
            <div key={tag} className="flex flex-col gap-2.5 rounded-[22px] p-7" style={cardBase}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--cx-text-3)' }}>{tag}</span>
              <h3 className="m-0 text-xl font-bold">{t}</h3>
              <p className="m-0 text-[15px] leading-relaxed" style={textoSec}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Prova ── */}
      <section style={{ background: 'var(--cx-surface)', borderTop: '1px solid var(--cx-border)', borderBottom: '1px solid var(--cx-border)' }}>
        <div className={`${caixa} cx-reveal grid items-center gap-12 py-24 md:grid-cols-2`}>
          <div className="flex flex-col gap-4">
            <Rotulo>NA PRÁTICA · GALPÃO FERRIAÇO</Rotulo>
            <h2 className="m-0" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 'clamp(30px, 3.6vw, 46px)', lineHeight: 1.08, letterSpacing: '-0.03em' }}>
              Quase todo lead da Meta chega com o anúncio de origem.
            </h2>
            <p className="m-0 text-base leading-relaxed" style={textoSec}>
              Em 90 dias, praticamente toda conversa vinda de anúncio da Meta entrou no CRM já marcada com o anúncio, o conjunto e a campanha.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { n: 99, suf: '%', txt: 'dos leads da Meta identificados até o anúncio (206 de 208)' },
              { n: 718, suf: '', txt: 'contatos organizados no CRM' },
            ].map((s) => (
              <div key={s.txt} className="flex min-w-0 flex-col gap-1.5 rounded-[20px] p-6 sm:p-7" style={{ background: 'var(--cx-bg)', border: '1px solid var(--cx-border-2)' }}>
                <span className="cx-cromo" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 'clamp(40px, 5vw, 56px)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                  <Contador alvo={s.n} sufixo={s.suf} />
                </span>
                <span className="text-sm leading-normal" style={textoSec}>{s.txt}</span>
              </div>
            ))}
            <p className="col-span-2 m-0 text-xs" style={{ color: 'var(--cx-text-3)' }}>Dados do Galpão Ferriaço, últimos 90 dias até 27/10/2026.</p>
          </div>
        </div>
      </section>

      {/* ── Preços ── */}
      <section id="precos" className={`${caixa} flex scroll-mt-20 flex-col items-center gap-8 pb-24 pt-28`}>
        <div className="flex max-w-[760px] flex-col items-center gap-3.5 text-center">
          <Rotulo>PREÇOS</Rotulo>
          <h2 className="cx-cromo m-0" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 'clamp(34px, 4.4vw, 60px)', lineHeight: 1.02, letterSpacing: '-0.04em' }}>
            CRM com WhatsApp por <span className="whitespace-nowrap">R$ 99*.</span>
          </h2>
          <p className="m-0 text-[17px] leading-relaxed" style={textoSec}>Menos do que um almoço por semana para não perder nenhum lead.</p>
        </div>

        <div role="group" aria-label="Ciclo de cobrança" className="flex flex-wrap justify-center gap-1 rounded-[14px] p-1" style={{ background: 'var(--cx-surface)', border: '1px solid var(--cx-border-2)' }}>
          {CICLOS.map(([id, rotulo]) => {
            const ativo = ciclo === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCiclo(id)}
                aria-pressed={ativo}
                className="min-h-11 cursor-pointer rounded-[10px] border-0 px-[18px] py-2.5 text-sm font-semibold transition-colors"
                style={ativo ? { background: 'var(--cx-lime)', color: 'var(--cx-on-lime)' } : { background: 'transparent', color: 'var(--cx-text-2)' }}
              >
                {rotulo}
              </button>
            );
          })}
        </div>

        <div className="grid w-full max-w-[920px] gap-5 md:grid-cols-2">
          {/* CRM */}
          <div className="flex flex-col gap-[18px] rounded-3xl p-8" style={{ background: 'var(--cx-surface)', border: '1px solid var(--cx-border-2)' }}>
            <div className="flex flex-col gap-1">
              <h3 className="m-0 text-[22px] font-extrabold" style={{ fontFamily: DISPLAY }}>CRM</h3>
              <span className="text-sm" style={{ color: 'var(--cx-text-3)' }}>Para quem já anuncia e quer organizar o atendimento</span>
            </div>
            <div className="flex flex-col gap-1">
              {comDesconto && <span className="text-[15px] line-through" style={{ color: 'var(--cx-text-3)' }}>R$ 149/mês</span>}
              <div className="flex items-baseline gap-1.5">
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, letterSpacing: '-0.04em' }}>R$ {precos.crm.preco}</span>
                <span className="text-base" style={textoSec}>/mês*</span>
              </div>
              {precos.crm.economia && <span className="self-start rounded-lg px-2.5 py-1 text-[13px] font-bold" style={{ background: 'var(--cx-tint-bg)', color: 'var(--cx-tint-text)' }}>{precos.crm.economia}</span>}
            </div>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
              {['CRM sem limite de contatos', 'WhatsApp dentro do CRM', 'Automações e disparos', '1 usuário'].map((i) => <li key={i}>✓ {i}</li>)}
            </ul>
            <Link href={linkCadastro('CRM', ciclo)} className="cx-btn-line mt-auto rounded-[14px] p-3.5 text-center text-base font-bold no-underline">Assinar o CRM</Link>
          </div>

          {/* Growth + CRM */}
          <div className="relative flex flex-col gap-[18px] rounded-3xl p-8" style={{ background: 'linear-gradient(170deg, var(--cx-hl), var(--cx-surface) 55%)', border: '1.5px solid var(--cx-lime)', boxShadow: '0 30px 80px var(--cx-lime-shadow)' }}>
            <span className="absolute -top-[13px] left-7 rounded-full px-3 py-[5px] text-xs font-extrabold" style={{ background: 'var(--cx-lime)', color: 'var(--cx-on-lime)' }}>MAIS COMPLETO</span>
            <div className="flex flex-col gap-1">
              <h3 className="m-0 text-[22px] font-extrabold" style={{ fontFamily: DISPLAY }}>Growth + CRM</h3>
              <span className="text-sm" style={{ color: 'var(--cx-text-3)' }}>Rastreio, anúncios, CRM e IA — o pacote completo</span>
            </div>
            <div className="flex flex-col gap-1">
              {comDesconto && <span className="text-[15px] line-through" style={{ color: 'var(--cx-text-3)' }}>R$ 297/mês</span>}
              <div className="flex items-baseline gap-1.5">
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, letterSpacing: '-0.04em' }}>R$ {precos.growth.preco}</span>
                <span className="text-base" style={textoSec}>/mês*</span>
              </div>
              {precos.growth.economia && <span className="self-start rounded-lg px-2.5 py-1 text-[13px] font-bold" style={{ background: 'var(--cx-lime)', color: 'var(--cx-on-lime)' }}>{precos.growth.economia}</span>}
            </div>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
              {['Tudo do CRM', 'Rastreio de cada lead até o anúncio', 'Painel Meta Ads + Google Ads', 'Relatórios de IA e alertas', '3 usuários'].map((i) => <li key={i}>✓ {i}</li>)}
            </ul>
            <Link href={linkCadastro('STARTER', ciclo)} className="cx-btn-lime mt-auto rounded-[14px] p-3.5 text-center text-base font-bold no-underline">Assinar o Growth + CRM</Link>
          </div>
        </div>

        <p className="m-0 max-w-[920px] whitespace-pre-line text-center text-xs leading-relaxed" style={{ color: 'var(--cx-text-3)' }}>{precos.nota}</p>
      </section>

      {/* ── Antes e depois ── */}
      <section className={`${caixa} cx-reveal flex flex-col gap-8 pb-28 pt-10`}>
        <h2 className="m-0 max-w-[760px]" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 'clamp(30px, 3.6vw, 46px)', lineHeight: 1.08, letterSpacing: '-0.03em' }}>Antes e depois do Cromalex.</h2>
        <div className="overflow-x-auto rounded-[20px]" style={{ border: '1px solid var(--cx-border-2)' }}>
          <table className="w-full min-w-[620px] border-collapse text-[15px]">
            <thead>
              <tr style={{ background: 'var(--cx-surface)' }}>
                <th className="px-[22px] py-[18px] text-left font-semibold" style={{ color: 'var(--cx-text-3)' }}><span className="sr-only">Situação</span></th>
                <th className="px-[22px] py-[18px] text-left font-semibold" style={{ color: 'var(--cx-text-3)' }}>Planilha + WhatsApp no celular</th>
                <th className="px-[22px] py-[18px] text-left font-bold" style={{ color: 'var(--cx-label)' }}>Cromalex Growth</th>
              </tr>
            </thead>
            <tbody>
              {COMPARATIVO.map(([k, antes, depois]) => (
                <tr key={k} style={{ borderTop: '1px solid var(--cx-border)' }}>
                  <td className="px-[22px] py-[18px] font-semibold">{k}</td>
                  <td className="px-[22px] py-[18px]" style={textoSec}>{antes}</td>
                  <td className="px-[22px] py-[18px]">{depois}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Dúvidas ── */}
      <section id="duvidas" className="cx-reveal mx-auto box-border flex max-w-[900px] scroll-mt-20 flex-col gap-6 px-4 pb-28 pt-10 sm:px-6">
        <h2 className="m-0" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 'clamp(30px, 3.6vw, 46px)', lineHeight: 1.08, letterSpacing: '-0.03em' }}>Dúvidas frequentes</h2>
        <div className="flex flex-col" style={{ borderTop: '1px solid var(--cx-border)' }}>
          {DUVIDAS.map(([q, a]) => (
            <div key={q} className="flex flex-col gap-2 py-[22px]" style={{ borderBottom: '1px solid var(--cx-border)' }}>
              <h3 className="m-0 text-lg font-bold">{q}</h3>
              <p className="m-0 text-[15px] leading-relaxed" style={textoSec}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Chamada final ── */}
      <section className={`${caixa} cx-reveal pb-24`}>
        <div className="flex flex-col items-center gap-5 overflow-hidden rounded-[28px] px-8 text-center" style={{ paddingBlock: 'clamp(40px, 6vw, 80px)', background: 'linear-gradient(160deg, var(--cx-hl), var(--cx-surface) 70%)', border: '1px solid var(--cx-hl-border)' }}>
          <h2 className="cx-cromo m-0 max-w-[820px]" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 'clamp(34px, 4.6vw, 64px)', lineHeight: 1.02, letterSpacing: '-0.04em' }}>
            O próximo lead já vai chegar com o anúncio dele.
          </h2>
          <p className="m-0 max-w-[560px] text-lg" style={textoSec}>Assine hoje e conecte seu WhatsApp em poucos minutos.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="#precos" className="cx-btn-lime rounded-[14px] px-[26px] py-[15px] text-base font-bold no-underline">Ver planos</a>
            <BotaoWhatsApp />
          </div>
        </div>
      </section>

      {/* ── Rodapé ── */}
      <footer style={{ borderTop: '1px solid var(--cx-line)' }}>
        <div className={`${caixa} flex flex-wrap items-center justify-between gap-4 py-8 text-[13px]`} style={{ color: 'var(--cx-text-3)' }}>
          <span>© {new Date().getFullYear()} Cromalex Growth</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="cx-link">Privacidade</Link>
            <Link href="/terms" className="cx-link">Termos</Link>
            <a href="mailto:contato@iacortextech.com.br" className="cx-link">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
