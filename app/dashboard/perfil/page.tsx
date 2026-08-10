'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import type { CompanyProfile, ModuleKey, ScoreItem, SetupScore } from '@/types';

/**
 * Perfil da conta — Setup Score.
 *
 * A nota mede o quanto a plataforma consegue trabalhar com o que sabe da empresa.
 * Cada ponto que falta tem dono: um módulo e uma frase dizendo o que deixa de acontecer.
 *
 * Nada aqui trava a plataforma. A obrigatoriedade acontece no ponto de uso (a tela do
 * briefing pede o que ela precisa) — quem já paga não pode levar um segundo muro
 * depois do muro da cobrança.
 */

const MODULOS: { key: ModuleKey; label: string; cor: string }[] = [
  { key: 'radar', label: '📡 RADAR', cor: 'var(--mod-radar)' },
  { key: 'ads', label: '🎯 ADS', cor: 'var(--mod-ads)' },
  { key: 'crm', label: '🤝 CRM', cor: 'var(--mod-crm)' },
  { key: 'ia', label: '🧠 IA (núcleo)', cor: 'var(--accent)' },
];

const FAIXAS = [
  { nome: 'Bronze', min: 40, desc: 'o painel liga' },
  { nome: 'Prata', min: 75, desc: 'ROAS + alertas com contexto' },
  { nome: 'Ouro', min: 95, desc: 'a IA com o quadro completo' },
];

/** Campos de texto que o cliente responde aqui. Os demais itens da nota são
 *  conexões e cadastros que acontecem em outras telas. */
const PERGUNTAS: {
  key: keyof CompanyProfile;
  pergunta: string;
  placeholder: string;
  linhas: number;
}[] = [
  {
    key: 'productDescription',
    pergunta: 'O que você vende, exatamente?',
    placeholder: 'Ex.: ferro, aço e material básico de obra, para construtora de médio porte e pedreiro autônomo, com entrega em 24h…',
    linhas: 3,
  },
  {
    key: 'idealCustomer',
    pergunta: 'Quem é o cliente que compra mais de você?',
    placeholder: 'Ex.: construtora com obra de médio porte, que compra recorrente e fecha pedido acima de R$ 8 mil…',
    linhas: 3,
  },
  {
    key: 'differentiator',
    pergunta: 'Por que ele te escolhe em vez do concorrente?',
    placeholder: 'Ex.: entregamos em 24h e cortamos na medida — o concorrente entrega em 5 dias e só vende barra inteira…',
    linhas: 3,
  },
  {
    key: 'goodLeadCriteria',
    pergunta: 'O que é um lead bom para você?',
    placeholder: 'Ex.: obra acima de 5 toneladas, com projeto aprovado e prazo definido. Reforma pequena consome o vendedor e quase nunca fecha…',
    linhas: 3,
  },
  {
    key: 'serviceRegion',
    pergunta: 'Qual região você atende?',
    placeholder: 'Ex.: região metropolitana de Fortaleza',
    linhas: 1,
  },
];

/**
 * Onde cada ponto que falta se resolve.
 *
 * É isto que torna esta tela auto-suficiente: todo item que não se responde aqui leva
 * para a tela onde ele acontece. Sem estes links, quem pula a Configuração Inicial
 * fica olhando para uma lista de pendências sem saber onde clicar.
 */
const DESTINOS: Record<string, { href: string; label: string }> = {
  meta: { href: '/dashboard/integrations', label: 'Conectar em Integrações →' },
  google: { href: '/dashboard/integrations', label: 'Conectar em Integrações →' },
  site: { href: '/dashboard/seo', label: 'Informar o site no RADAR →' },
  crm: { href: '/dashboard/crm', label: 'Ativar o CRM →' },
  competitorUrls: { href: '/dashboard/seo', label: 'Cadastrar concorrentes no RADAR →' },
  competitorPageIds: { href: '/dashboard/criativo', label: 'Cadastrar páginas na Inteligência Criativa →' },
};

const OBJETIVOS = [
  { v: 'volume', label: 'Volume', desc: 'mais leads, mesmo com CPL maior' },
  { v: 'margem', label: 'Margem', desc: 'menos leads, melhores' },
  { v: 'marca', label: 'Marca', desc: 'ser lembrado antes de comprar' },
];

type Estado = 'parado' | 'salvando' | 'ok' | 'recusado';

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [score, setScore] = useState<SetupScore | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Texto em edição por campo — separado do que está salvo, para o "Pular" não perder nada.
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<Record<string, Estado>>({});
  const [veredito, setVeredito] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    try {
      const res = await apiService.getCompanyProfile();
      setProfile(res.data.profile);
      setScore(res.data.setupScore);
      const inicial: Record<string, string> = {};
      for (const p of PERGUNTAS) inicial[p.key] = (res.data.profile[p.key] as string | null) ?? '';
      setRascunho(inicial);
    } catch {
      setErro('Não foi possível carregar o perfil. Tente recarregar a página.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const salvar = async (campo: string, valor: string) => {
    setEstado((e) => ({ ...e, [campo]: 'salvando' }));
    setVeredito((v) => ({ ...v, [campo]: '' }));
    try {
      const res = await apiService.updateCompanyProfile({ [campo]: valor });
      setScore(res.data.setupScore);
      setProfile((p) => (p ? { ...p, [campo]: valor || null } : p));
      setEstado((e) => ({ ...e, [campo]: 'ok' }));
      setTimeout(() => setEstado((e) => ({ ...e, [campo]: 'parado' })), 2500);
    } catch (err: unknown) {
      // 422 = resposta vaga. O texto NÃO é gravado (viraria frase vaga dentro do
      // prompt dos agentes), mas continua na tela para a pessoa melhorar em cima.
      const e = err as { response?: { status?: number; data?: { data?: { rejected?: Record<string, string> } } } };
      const repergunta = e.response?.data?.data?.rejected?.[campo];
      if (e.response?.status === 422 && repergunta) {
        setVeredito((v) => ({ ...v, [campo]: repergunta }));
        setEstado((s) => ({ ...s, [campo]: 'recusado' }));
      } else {
        setVeredito((v) => ({ ...v, [campo]: 'Não foi possível salvar agora. Tente de novo.' }));
        setEstado((s) => ({ ...s, [campo]: 'recusado' }));
      }
    }
  };

  if (carregando) {
    return (
      <div className="p-6">
        <div className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />
      </div>
    );
  }

  if (erro || !profile || !score) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--badge-error-text)' }}>{erro ?? 'Perfil indisponível.'}</p>
      </div>
    );
  }

  const raio = 37;
  const volta = 2 * Math.PI * raio;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
      {/* ─── Cabeçalho do score ─────────────────────────────────────────── */}
      <section className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative" style={{ width: 88, height: 88 }}>
            <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="44" cy="44" r={raio} fill="none" stroke="var(--border-md)" strokeWidth="7" />
              <circle
                cx="44" cy="44" r={raio} fill="none"
                stroke="var(--accent)" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={volta}
                strokeDashoffset={volta - (volta * score.score) / 100}
                style={{ transition: 'stroke-dashoffset .6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{score.score}</span>
            </div>
          </div>

          <div className="flex-1 min-w-[250px]">
            <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Perfil da conta</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              A plataforma está usando{' '}
              <b style={{ color: 'var(--text-primary)' }}>{score.score}%</b> do que ela consegue fazer por você.
            </p>

            <div className="flex gap-1.5 mt-3">
              {FAIXAS.map((f) => {
                const atingida = score.score >= f.min;
                return (
                  <div
                    key={f.nome}
                    className="flex-1 rounded-lg px-2.5 py-1.5"
                    style={{
                      backgroundColor: atingida ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      border: `1px solid ${atingida ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    <p className="text-[11px] font-semibold" style={{ color: atingida ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {f.nome} <span className="font-normal">{f.min}</span>
                    </p>
                    <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* capacidade por módulo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {MODULOS.map((m) => {
            const dados = score.modules[m.key];
            return (
              <div key={m.key}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                  <span className="text-[11px] font-semibold" style={{ color: m.cor }}>{dados.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  <div style={{ width: `${dados.pct}%`, height: '100%', backgroundColor: m.cor, transition: 'width .6s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {score.missing.length > 0 && (
          <p
            className="text-xs mt-4 rounded-lg px-3 py-2"
            style={{ backgroundColor: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)' }}
          >
            Faltam <b>{100 - score.score} pontos</b>. O de maior impacto agora:{' '}
            <b>{score.missing[0].label}</b> ({score.missing[0].points} pts) — {score.missing[0].unlock}.
          </p>
        )}
      </section>

      {/* ─── Blocos da nota ─────────────────────────────────────────────── */}
      {score.blocks.map((bloco) => (
        <section key={bloco.key} className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{bloco.label}</h2>
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {bloco.earned} de {bloco.total} pts
            </span>
          </div>

          {bloco.key === 'conexoes' && (
            <p className="text-[11px] rounded-lg px-3 py-2 mb-3" style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--text-secondary)' }}>
              Estes quatro não têm caixa para marcar. O ✓ aparece sozinho, e o critério não é
              “conectei” — é <b style={{ color: 'var(--text-primary)' }}>chegou dado nos últimos 7 dias</b>.
              Integração que diz estar conectada mas parou de trazer número não conta.
            </p>
          )}

          {bloco.key === 'perfil' && (
            <p className="text-[11px] rounded-lg px-3 py-2 mb-3" style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--text-secondary)' }}>
              <b style={{ color: 'var(--text-primary)' }}>Todas podem ficar em branco — nada aqui trava a plataforma.</b>{' '}
              Cada resposta é lida pelos agentes antes de escrever o seu relatório.
            </p>
          )}

          <div className="space-y-2">
            {bloco.items.map((item) => {
              // Item que a pessoa responde AQUI vira o próprio campo — com a pergunta,
              // os pontos e o "o que destrava" na mesma caixa. Sem isso a pergunta
              // apareceria duas vezes: como linha e como campo logo abaixo.
              const pergunta = PERGUNTAS.find((p) => p.key === item.key);
              if (pergunta) {
                return (
                  <CampoResposta
                    key={item.key}
                    item={item}
                    placeholder={pergunta.placeholder}
                    linhas={pergunta.linhas}
                    valor={rascunho[item.key] ?? ''}
                    salvo={(profile[pergunta.key] as string | null) ?? ''}
                    estado={estado[item.key] ?? 'parado'}
                    veredito={veredito[item.key] ?? ''}
                    onChange={(v) => setRascunho((r) => ({ ...r, [item.key]: v }))}
                    onSalvar={() => void salvar(item.key, rascunho[item.key] ?? '')}
                  />
                );
              }

              if (item.key === 'businessGoal') {
                return (
                  <CaixaItem key={item.key} item={item}>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {OBJETIVOS.map((o) => {
                        const ativo = profile.businessGoal === o.v;
                        return (
                          <button
                            key={o.v}
                            onClick={() => void salvar('businessGoal', ativo ? '' : o.v)}
                            className="rounded-lg px-3 py-2 text-left transition-colors"
                            style={{
                              backgroundColor: ativo ? 'var(--accent-dim)' : 'var(--bg-surface)',
                              border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border-md)'}`,
                              minWidth: 148,
                            }}
                          >
                            <span className="block text-xs font-semibold" style={{ color: ativo ? 'var(--accent)' : 'var(--text-primary)' }}>
                              {o.label}
                            </span>
                            <span className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>{o.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CaixaItem>
                );
              }

              return <CaixaItem key={item.key} item={item} onIr={router.push} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Caixa de item da nota ────────────────────────────────────────────────────
// Serve tanto para item só-leitura (conexão, cadastro em outra tela) quanto como
// moldura do campo que a pessoa responde aqui — mesma marca de ✓ e mesmos pontos.

function CaixaItem({
  item, children, onIr,
}: {
  item: ScoreItem;
  children?: React.ReactNode;
  onIr?: (href: string) => void;
}) {
  // O link só aparece enquanto o ponto está aberto: item resolvido não precisa de atalho.
  const destino = !item.done && onIr ? DESTINOS[item.key] : undefined;

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 shrink-0 rounded flex items-center justify-center"
          style={{
            width: 16, height: 16,
            backgroundColor: item.done ? 'var(--badge-success-text)' : 'transparent',
            border: item.done ? 'none' : '1.5px solid var(--border-md)',
            color: 'var(--bg-surface)',
            fontSize: 11,
            lineHeight: 1,
          }}
        >
          {item.done ? '✓' : ''}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {item.label}
          </span>
          <span className="block text-[10.5px] leading-snug mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {item.unlock}
          </span>
        </span>
        <span
          className="text-[11px] font-semibold shrink-0"
          style={{ color: item.done ? 'var(--badge-success-text)' : 'var(--text-muted)' }}
        >
          {item.points}
        </span>
      </div>
      {destino && (
        <button
          onClick={() => onIr!(destino.href)}
          className="text-[11px] underline mt-1.5 ml-[26px]"
          style={{ color: 'var(--accent)' }}
        >
          {destino.label}
        </button>
      )}
      {children}
    </div>
  );
}

// ─── Campo com validação em dois estágios ─────────────────────────────────────

function CampoResposta({
  item, placeholder, linhas, valor, salvo, estado, veredito, onChange, onSalvar,
}: {
  item: ScoreItem;
  placeholder: string;
  linhas: number;
  valor: string;
  salvo: string;
  estado: Estado;
  veredito: string;
  onChange: (v: string) => void;
  onSalvar: () => void;
}) {
  const mudou = valor.trim() !== salvo.trim();

  return (
    <CaixaItem item={item}>
      <div className="mt-2">
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={linhas}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: `1px solid ${estado === 'recusado' ? 'var(--badge-error-text)' : 'var(--border-md)'}`,
          color: 'var(--text-primary)',
        }}
      />

      <div className="flex items-center justify-between gap-3 mt-1.5">
        <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
          {estado === 'ok' && '✓ salvo — a nota já subiu'}
          {estado === 'salvando' && 'conferindo a resposta…'}
          {estado === 'parado' && salvo && !mudou && 'respondido'}
          {estado === 'parado' && !salvo && 'pode deixar em branco — nada trava'}
        </span>
        <button
          onClick={onSalvar}
          disabled={!mudou || estado === 'salvando'}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-40"
          style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
        >
          {estado === 'salvando' ? 'Conferindo…' : 'Salvar resposta'}
        </button>
      </div>

      {veredito && estado === 'recusado' && (
        <p
          className="text-[11.5px] leading-snug mt-2 rounded-lg px-3 py-2"
          style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }}
        >
          {veredito}
        </p>
      )}
      </div>
    </CaixaItem>
  );
}
