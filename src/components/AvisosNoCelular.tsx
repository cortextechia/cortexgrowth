'use client';

import { useEffect, useState } from 'react';
import { apiService } from '@/lib/api';

// "Ativar avisos" deste aparelho (notificação do app instalável).
// iPhone: só funciona com o app instalado na tela de início (iOS 16.4+) — fora dele o
// navegador nem oferece notificação, então a tela explica o caminho em vez de um botão morto.
//   variant="card"   → seção da Minha conta (ligar, testar, desligar)
//   variant="banner" → chamada curta no CRM do celular; some quando ligado ou fechado

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'sem-suporte' }
  | { tipo: 'iphone-sem-app' }
  | { tipo: 'servidor-desligado' }
  | { tipo: 'bloqueado' }
  | { tipo: 'desligado' }
  | { tipo: 'ligado'; endpoint: string };

const CHAVE_BANNER = 'push_banner_dismissed_at';

function base64ParaBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const ehIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function lerEstado(): Promise<Estado> {
  const suporta = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!suporta) return ehIphone() && !instalado() ? { tipo: 'iphone-sem-app' } : { tipo: 'sem-suporte' };
  if (ehIphone() && !instalado()) return { tipo: 'iphone-sem-app' };
  const cfg = await apiService.getPushConfig();
  if (!cfg.data.enabled || !cfg.data.publicKey) return { tipo: 'servidor-desligado' };
  if (Notification.permission === 'denied') return { tipo: 'bloqueado' };
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? { tipo: 'ligado', endpoint: sub.endpoint } : { tipo: 'desligado' };
}

export default function AvisosNoCelular({ variant = 'card' }: { variant?: 'card' | 'banner' }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null);
  const [bannerFechado, setBannerFechado] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return Date.now() - Number(localStorage.getItem(CHAVE_BANNER) ?? 0) < 14 * 86_400_000; } catch { return false; }
  });

  useEffect(() => {
    let vivo = true;
    lerEstado()
      .then((e) => { if (vivo) setEstado(e); })
      .catch((err) => {
        console.error('[Push] não consegui ler o estado dos avisos', err);
        if (vivo) setEstado({ tipo: 'sem-suporte' });
      });
    return () => { vivo = false; };
  }, []);

  const ligar = async () => {
    setOcupado(true); setMsg(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') { setEstado({ tipo: permissao === 'denied' ? 'bloqueado' : 'desligado' }); return; }
      const cfg = await apiService.getPushConfig();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(cfg.data.publicKey!) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await apiService.subscribePush({ endpoint: json.endpoint, keys: json.keys });
      setEstado({ tipo: 'ligado', endpoint: sub.endpoint });
      setMsg({ tom: 'ok', texto: 'Avisos ligados neste aparelho.' });
    } catch (err) {
      console.error('[Push] falha ao ligar avisos', err);
      setMsg({ tom: 'erro', texto: 'Não consegui ligar os avisos. Tente de novo; se continuar, recarregue o app.' });
    } finally {
      setOcupado(false);
    }
  };

  const desligar = async () => {
    if (estado.tipo !== 'ligado') return;
    setOcupado(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      await (await reg?.pushManager.getSubscription())?.unsubscribe();
      await apiService.unsubscribePush(estado.endpoint);
      setEstado({ tipo: 'desligado' });
      setMsg({ tom: 'ok', texto: 'Avisos desligados neste aparelho.' });
    } catch (err) {
      console.error('[Push] falha ao desligar avisos', err);
      setMsg({ tom: 'erro', texto: 'Não consegui desligar. Tente de novo.' });
    } finally {
      setOcupado(false);
    }
  };

  const testar = async () => {
    setOcupado(true); setMsg(null);
    try {
      const r = await apiService.testPush();
      setMsg(r.data.sent > 0
        ? { tom: 'ok', texto: 'Aviso de teste enviado. Deve chegar em alguns segundos.' }
        : { tom: 'erro', texto: 'Nenhum aparelho recebeu. Desligue e ligue os avisos de novo.' });
    } catch (err) {
      console.error('[Push] falha no teste', err);
      setMsg({ tom: 'erro', texto: 'Não consegui enviar o teste.' });
    } finally {
      setOcupado(false);
    }
  };

  if (variant === 'banner') {
    if (estado.tipo !== 'desligado' || bannerFechado) return null;
    const fechar = () => {
      setBannerFechado(true);
      try { localStorage.setItem(CHAVE_BANNER, String(Date.now())); } catch { /* sem armazenamento: some só nesta visita */ }
    };
    return (
      <div className="ui-card ui-card-hl !p-3.5 mb-3 flex items-center gap-3" role="region" aria-label="Ativar avisos">
        <p className="flex-1 text-[13px] leading-snug" style={{ color: 'var(--text-primary)' }}>
          Receba aviso de cliente novo e de mensagem neste celular.
        </p>
        <button onClick={() => void ligar()} disabled={ocupado} className="ui-btn ui-btn-primary ui-btn-sm shrink-0">Ativar</button>
        <button onClick={fechar} className="ui-btn ui-btn-secondary ui-btn-sm !px-2.5 shrink-0" aria-label="Fechar">✕</button>
      </div>
    );
  }

  return (
    <section className="ui-card">
      <h2 className="ui-h2">Avisos no celular</h2>
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
        Cliente novo, mensagem nova, cliente esperando há 4 h e o resumo do dia às 8 h. Você só recebe aviso dos seus cards.
      </p>
      <div className="mt-4 text-sm" style={{ color: 'var(--text-primary)' }}>
        {estado.tipo === 'carregando' && <span style={{ color: 'var(--text-secondary)' }}>Verificando este aparelho…</span>}
        {estado.tipo === 'sem-suporte' && <span>Este navegador não recebe avisos. No celular, use o Chrome (Android) ou o Safari (iPhone).</span>}
        {estado.tipo === 'iphone-sem-app' && (
          <span>No iPhone, os avisos só chegam com o app instalado: no Safari, toque em <strong>Compartilhar</strong> e em <strong>Adicionar à Tela de Início</strong>. Depois abra o Cromalex pelo ícone e volte aqui.</span>
        )}
        {estado.tipo === 'servidor-desligado' && <span>Os avisos ainda não foram ligados no servidor.</span>}
        {estado.tipo === 'bloqueado' && <span>Os avisos estão bloqueados neste aparelho. Libere nas configurações do navegador (Notificações › Cromalex) e recarregue.</span>}
        {estado.tipo === 'desligado' && (
          <button onClick={() => void ligar()} disabled={ocupado} className="ui-btn ui-btn-primary ui-btn-sm">
            {ocupado ? 'Ligando…' : 'Ativar avisos neste aparelho'}
          </button>
        )}
        {estado.tipo === 'ligado' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-badge ui-badge-lime">LIGADOS NESTE APARELHO</span>
            <button onClick={() => void testar()} disabled={ocupado} className="ui-btn ui-btn-secondary ui-btn-sm">Enviar aviso de teste</button>
            <button onClick={() => void desligar()} disabled={ocupado} className="ui-btn ui-btn-secondary ui-btn-sm">Desligar</button>
          </div>
        )}
      </div>
      {msg && (
        <p
          role={msg.tom === 'erro' ? 'alert' : 'status'}
          className="text-xs mt-3 rounded-lg px-3 py-2"
          style={{
            backgroundColor: msg.tom === 'ok' ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)',
            color: msg.tom === 'ok' ? 'var(--badge-success-text)' : 'var(--badge-error-text)',
          }}
        >
          {msg.texto}
        </p>
      )}
    </section>
  );
}
