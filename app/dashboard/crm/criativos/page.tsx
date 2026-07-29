'use client';

// CRM · Criativos — rastreia de qual criativo veio cada lead.
//
// Duas fontes, nesta ordem:
// 1) O anúncio Click-to-WhatsApp: a Meta manda o ID do anúncio junto da primeira
//    mensagem. Não exige nada de você nem do cliente, e anúncio ainda não
//    cadastrado é DETECTADO sozinho — só falta dar nome (ou puxar da Meta).
// 2) A frase pré-preenchida do link wa.me, para Google e links que não são CTWA.
//
// Em qualquer dos dois o card nasce com origem Meta/Google em vez de WhatsApp,
// e é isso que faz o lead entrar no ROAS. Sem nenhum sinal nada muda.
//
// A lista é um RANKING: ordenada por leads e com barra proporcional ao líder,
// porque a pergunta que a tela responde é "qual criativo está ganhando".
// Só ADMIN/gestor.

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import type { CrmAdCreative, CrmAdNumber, CrmAdPlatform } from '@/types';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'TRAFFIC_MANAGER'];

const card = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' };
const input = { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-primary)' } as const;

// Regra do design system: as cores de plataforma não têm contraste no tema claro
// quando usadas como texto — alterna por tema em vez de fixar o hex.
function platformStyle(p: CrmAdPlatform, isDark: boolean) {
  if (p === 'GOOGLE') {
    return { label: 'Google', color: isDark ? '#6ee7b7' : '#047857', bg: isDark ? 'rgba(110,231,183,0.12)' : 'rgba(4,120,87,0.10)' };
  }
  return { label: 'Meta', color: isDark ? '#a5b4fc' : '#4338ca', bg: isDark ? 'rgba(165,180,252,0.12)' : 'rgba(67,56,202,0.10)' };
}

function fmtPhone(digits: string | null): string {
  if (!digits) return '';
  const d = digits.replace(/\D/g, '');
  const nac = d.startsWith('55') ? d.slice(2) : d;
  if (nac.length < 10) return d;
  return `(${nac.slice(0, 2)}) ${nac.slice(2, -4)}-${nac.slice(-4)}`;
}

export default function CrmCriativosPage() {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  const [list, setList] = useState<CrmAdCreative[]>([]);
  const [numbers, setNumbers] = useState<CrmAdNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Formulário de novo criativo
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [adMediaUrl, setAdMediaUrl] = useState('');
  const [platform, setPlatform] = useState<CrmAdPlatform>('META');
  const [campaignName, setCampaignName] = useState('');
  const [destPhone, setDestPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Criativo descoberto sozinho nasce com o título do anúncio; a Meta tem o nome
  // real que o gestor deu, e é esse que ele reconhece.
  const sincronizarNomes = async () => {
    setSyncing(true);
    try {
      const r = await apiService.syncCrmAdCreativeNames();
      await load();
      showToast('success', r.message);
    } catch {
      showToast('error', 'Não foi possível buscar os nomes na Meta.');
    } finally {
      setSyncing(false);
    }
  };

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const [c, n] = await Promise.all([apiService.listCrmAdCreatives(), apiService.listCrmAdNumbers()]);
      setList(c.data);
      setNumbers(n.data);
      if (!destPhone && n.data[0]?.phone) setDestPhone(n.data[0].phone);
    } catch {
      showToast('error', 'Não foi possível carregar os criativos.');
    } finally {
      setLoading(false);
    }
    // destPhone fora das deps de propósito: só serve para o primeiro preenchimento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  const criar = async () => {
    if (!name.trim()) { showToast('error', 'Dê um nome ao criativo.'); return; }
    if (!adMediaUrl.trim() && message.trim().length < 8) {
      showToast('error', 'Informe o link do anúncio ou a frase que o cliente vai enviar.');
      return;
    }
    setSaving(true);
    try {
      await apiService.createCrmAdCreative({
        name: name.trim(),
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(adMediaUrl.trim() ? { adMediaUrl: adMediaUrl.trim() } : {}),
        platform,
        ...(campaignName.trim() ? { campaignName: campaignName.trim() } : {}),
        ...(destPhone ? { destPhone } : {}),
      });
      setName(''); setMessage(''); setAdMediaUrl(''); setCampaignName(''); setOpen(false);
      await load();
      showToast('success', 'Criativo criado. Copie o link e use como destino do anúncio.');
    } catch (e) {
      const motivo = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast('error', motivo ?? 'Não foi possível criar o criativo.');
    } finally {
      setSaving(false);
    }
  };

  const copiar = async (c: CrmAdCreative) => {
    if (!c.waLink) { showToast('error', 'Escolha um número de destino para gerar o link.'); return; }
    try {
      await navigator.clipboard.writeText(c.waLink);
      setCopied(c.id);
      setTimeout(() => setCopied((v) => (v === c.id ? null : v)), 2000);
    } catch {
      showToast('error', 'O navegador bloqueou a cópia. Selecione o link manualmente.');
    }
  };

  const alternarAtivo = async (c: CrmAdCreative) => {
    try {
      await apiService.updateCrmAdCreative(c.id, { active: !c.active });
      await load();
    } catch {
      showToast('error', 'Não foi possível alterar o criativo.');
    }
  };

  const remover = async (c: CrmAdCreative) => {
    if (!confirm(`Remover "${c.name}"? Os ${c.leads} leads já atribuídos continuam no CRM.`)) return;
    try {
      await apiService.deleteCrmAdCreative(c.id);
      await load();
      showToast('success', 'Criativo removido.');
    } catch {
      showToast('error', 'Não foi possível remover o criativo.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p style={{ color: 'var(--text-muted)' }}>Esta página é restrita a administradores.</p>
      </div>
    );
  }

  const ranked = [...list].sort((a, b) => b.leads - a.leads);
  const lider = ranked[0]?.leads ?? 0;
  const totalLeads = list.reduce((s, c) => s + c.leads, 0);
  const ativos = list.filter((c) => c.active).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Rastreio de criativos</h1>
          <p className="mt-1 max-w-xl text-sm" style={{ color: 'var(--text-muted)' }}>
            Descubra qual anúncio traz mais leads. Anúncios de WhatsApp da Meta são
            reconhecidos sozinhos; para Google e outros links, use a frase de cada criativo.
          </p>
        </div>
        <div className="flex gap-2">
          {list.some((c) => c.autoCreated) && (
            <button
              onClick={() => void sincronizarNomes()}
              disabled={syncing}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-60"
              style={{ border: '1px solid var(--border-md)', color: 'var(--text-secondary)' }}
            >
              {syncing ? 'Buscando…' : 'Buscar nomes na Meta'}
            </button>
          )}
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Novo criativo
          </button>
        </div>
      </div>

      {/* Resumo — some quando não há nada, para não mostrar três zeros */}
      {list.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { rotulo: 'Leads rastreados', valor: totalLeads },
            { rotulo: 'Criativos ativos', valor: ativos },
            { rotulo: 'Melhor criativo', valor: lider, sufixo: lider === 1 ? 'lead' : 'leads' },
          ].map((k) => (
            <div key={k.rotulo} className="rounded-xl p-4" style={card}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.rotulo}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {k.valor}
                {k.sufixo && <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{k.sufixo}</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="mt-5 space-y-3">
        {loading && (
          <div className="rounded-xl p-6 text-center text-sm" style={{ ...card, color: 'var(--text-muted)' }}>
            Carregando…
          </div>
        )}

        {!loading && list.length === 0 && (
          <div className="rounded-xl p-6" style={card}>
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Comece rastreando seu primeiro criativo
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Hoje os leads que chegam pelo WhatsApp entram sem origem — e ficam de fora do ROAS.
              Com um link por criativo, você passa a saber de qual anúncio veio cada um.
            </p>
            <ol className="mt-4 space-y-2">
              {[
                'Cadastre o criativo e escolha para qual número o lead vai falar.',
                'Copie o link gerado e use como destino do anúncio na Meta ou no Google.',
                'O lead manda a mensagem já preenchida e aparece aqui, contado.',
              ].map((passo, i) => (
                <li key={i} className="flex gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
                  >
                    {i + 1}
                  </span>
                  {passo}
                </li>
              ))}
            </ol>
          </div>
        )}

        {ranked.map((c) => {
          const p = platformStyle(c.platform, isDark);
          const pct = lider > 0 ? Math.round((c.leads / lider) * 100) : 0;
          return (
            <div key={c.id} className="rounded-xl p-4" style={{ ...card, opacity: c.active ? 1 : 0.55 }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-md px-1.5 py-0.5 font-mono text-xs font-bold"
                      style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
                    >
                      {c.code}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: p.bg, color: p.color }}>
                      {p.label}
                    </span>
                    {c.autoCreated && (
                      <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)' }}>
                        Detectado — confira o nome
                      </span>
                    )}
                    {!c.active && (
                      <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                        Pausado
                      </span>
                    )}
                  </div>
                  {(c.campaignName || c.destPhone) && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.campaignName}
                      {c.campaignName && c.destPhone && ' · '}
                      {c.destPhone && `responde em ${fmtPhone(c.destPhone)}`}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>{c.leads}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.leads === 1 ? 'lead' : 'leads'}</p>
                </div>
              </div>

              {/* A barra é a comparação: proporcional ao líder, não ao total */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--border-md)' }}>
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${pct}%`, backgroundColor: c.leads > 0 ? 'var(--accent)' : 'transparent' }}
                />
              </div>

              {/* Link + ações. O link só existe para o rastreio por frase — criativo
                  reconhecido pelo próprio anúncio não precisa de link nenhum. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {c.message && <code
                  className="min-w-0 flex-1 truncate rounded-lg px-2.5 py-1.5 text-xs"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                  title={c.waLink ?? 'Escolha um número de destino'}
                >
                  {c.waLink ?? 'Sem número de destino — edite para gerar o link'}
                </code>}
                {c.message && <button
                  onClick={() => void copiar(c)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                  style={
                    copied === c.id
                      ? { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }
                      : { backgroundColor: 'var(--accent)', color: '#fff' }
                  }
                >
                  {copied === c.id ? 'Copiado' : 'Copiar link'}
                </button>}
                <button
                  onClick={() => void alternarAtivo(c)}
                  className="rounded-lg px-3 py-1.5 text-xs transition-colors"
                  style={{ border: '1px solid var(--border-md)', color: 'var(--text-secondary)' }}
                >
                  {c.active ? 'Pausar' : 'Reativar'}
                </button>
                <button
                  onClick={() => void remover(c)}
                  className="rounded-lg px-3 py-1.5 text-xs transition-colors"
                  style={{ border: '1px solid var(--border-md)', color: 'var(--badge-error-text)' }}
                >
                  Remover
                </button>
              </div>

              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {c.adSourceId
                  ? <>Reconhecido pelo anúncio <span style={{ color: 'var(--text-secondary)' }}>{c.adSourceId}</span> na Meta</>
                  : c.adMediaUrl
                    ? <>Reconhecido pelo anúncio: <span style={{ color: 'var(--text-secondary)' }}>{c.adMediaUrl}</span></>
                    : <>O cliente enviará: <span style={{ color: 'var(--text-secondary)' }}>“{c.message ?? '—'}”</span></>}
              </p>
            </div>
          );
        })}
      </div>

      {/* Novo criativo */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl"
            style={card}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Novo criativo</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Informe o link do anúncio, a frase, ou os dois — quanto mais, melhor o rastreio.
            </p>

            <label className="mt-4 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nome do criativo
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vídeo depoimento do cliente"
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              style={input}
            />

            <label className="mt-3 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Link do anúncio <span style={{ color: 'var(--text-muted)' }}>(recomendado)</span>
            </label>
            <input
              value={adMediaUrl}
              onChange={(e) => setAdMediaUrl(e.target.value)}
              placeholder="https://www.facebook.com/.../videos/2063547864239811/"
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              style={input}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Se o anúncio for Click-to-WhatsApp, o próprio WhatsApp informa de qual vídeo o
              lead veio — e aí o rastreio não depende do cliente manter o texto.
            </p>

            <label className="mt-3 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Frase que o cliente vai enviar
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Olá! Quero saber sobre o galpão coberto"
              className="mt-1 w-full resize-none rounded-lg px-3 py-2 text-sm"
              style={input}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              É por ela que o lead é reconhecido — escreva algo diferente em cada criativo.
            </p>
            {/* Prévia: o que aparece no WhatsApp do cliente quando ele clica no anúncio */}
            {message.trim() && (
              <div className="mt-2 rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>O cliente verá</p>
                <p className="mt-1 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--text-primary)' }}>
                  {message}
                </p>
              </div>
            )}

            <label className="mt-3 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Plataforma</label>
            <div className="mt-1 flex gap-2">
              {(['META', 'GOOGLE'] as CrmAdPlatform[]).map((op) => {
                const st = platformStyle(op, isDark);
                const sel = platform === op;
                return (
                  <button
                    key={op}
                    onClick={() => setPlatform(op)}
                    className="flex-1 rounded-lg py-2 text-sm font-semibold transition-all"
                    style={sel
                      ? { backgroundColor: st.bg, color: st.color, border: `1px solid ${st.color}` }
                      : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-md)' }}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>

            <label className="mt-3 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Campanha <span style={{ color: 'var(--text-muted)' }}>(opcional)</span>
            </label>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Promoção de julho"
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              style={input}
            />

            <label className="mt-3 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              O lead vai falar com
            </label>
            {numbers.length === 0 ? (
              <p className="mt-1 text-xs" style={{ color: 'var(--badge-warn-text)' }}>
                Nenhum WhatsApp conectado. Conecte um vendedor no CRM para gerar o link.
              </p>
            ) : (
              <select
                value={destPhone}
                onChange={(e) => setDestPhone(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
                style={input}
              >
                {numbers.map((n) => (
                  <option key={n.phone ?? ''} value={n.phone ?? ''}>
                    {n.sellerName} — {fmtPhone(n.phone)}
                  </option>
                ))}
              </select>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg py-2 text-sm"
                style={{ border: '1px solid var(--border-md)', color: 'var(--text-secondary)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void criar()}
                disabled={saving}
                className="flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {saving ? 'Criando…' : 'Criar criativo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg"
          style={{
            backgroundColor: toast.type === 'success' ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)',
            color: toast.type === 'success' ? 'var(--badge-success-text)' : 'var(--badge-error-text)',
            border: '1px solid var(--border)',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
