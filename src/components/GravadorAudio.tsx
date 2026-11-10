'use client';

import { useEffect, useRef, useState } from 'react';

// Gravar áudio no campo da conversa do WhatsApp (pedido da Roberta, 10/11/2026).
// O navegador grava em webm/opus (Chrome, Android) ou mp4 (iPhone); o servidor manda
// para a Evolution, que converte para mensagem de voz do WhatsApp.
// Enquanto grava, o componente ocupa o lugar da caixa de texto (o pai esconde o resto
// pelo onAtivo).

const LIMITE_S = 120;
const FORMATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function formatoSuportado(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return FORMATOS.find((f) => MediaRecorder.isTypeSupported(f));
}

async function paraBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function GravadorAudio({ onEnviar, onAtivo, disabled }: {
  onEnviar: (audio: { base64: string; mimetype: string }) => Promise<void>;
  onAtivo: (ativo: boolean) => void;
  disabled?: boolean;
}) {
  const [fase, setFase] = useState<'parado' | 'gravando' | 'enviando'>('parado');
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const enviarAoParar = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const limpar = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    rec.current?.stream.getTracks().forEach((t) => t.stop());
    rec.current = null;
  };
  useEffect(() => () => limpar(), []);

  const começar = async () => {
    setErro(null);
    if (!navigator.mediaDevices?.getUserMedia || !formatoSuportado()) {
      setErro('Este navegador não grava áudio. No celular, use o Chrome (Android) ou o Safari (iPhone).');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('[Audio] microfone negado', err);
      setErro('Sem acesso ao microfone. Libere o microfone para o Cromalex nas configurações do navegador.');
      return;
    }
    const mimeType = formatoSuportado()!;
    const r = new MediaRecorder(stream, { mimeType });
    pedacos.current = [];
    enviarAoParar.current = false;
    r.ondataavailable = (e) => { if (e.data.size > 0) pedacos.current.push(e.data); };
    r.onstop = async () => {
      const tipo = (r.mimeType || mimeType).split(';')[0]!;
      const blob = new Blob(pedacos.current, { type: tipo });
      limpar();
      if (!enviarAoParar.current || blob.size === 0) { setFase('parado'); onAtivo(false); return; }
      setFase('enviando');
      try {
        await onEnviar({ base64: await paraBase64(blob), mimetype: r.mimeType || mimeType });
        setFase('parado');
        onAtivo(false);
      } catch (err) {
        console.error('[Audio] falha no envio', err);
        const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        setErro(msg ?? 'Não consegui enviar o áudio. Tente de novo.');
        setFase('parado');
        onAtivo(false);
      }
    };
    rec.current = r;
    r.start(1000);
    setSegundos(0);
    setFase('gravando');
    onAtivo(true);
    timer.current = setInterval(() => {
      setSegundos((s) => {
        if (s + 1 >= LIMITE_S) { enviarAoParar.current = true; rec.current?.stop(); }
        return s + 1;
      });
    }, 1000);
  };

  const parar = (enviar: boolean) => {
    enviarAoParar.current = enviar;
    rec.current?.stop();
  };

  if (fase === 'parado') {
    return (
      <>
        <button
          type="button"
          onClick={() => void começar()}
          disabled={disabled}
          aria-label="Gravar áudio"
          title="Gravar áudio"
          className="px-2 py-2 rounded-lg shrink-0 disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm6-3a6 6 0 01-12 0m6 6v3m-3 0h6" />
          </svg>
        </button>
        {erro && <p role="alert" className="basis-full order-last text-xs" style={{ color: 'var(--badge-error-text)' }}>{erro}</p>}
      </>
    );
  }

  return (
    <div className="flex-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }} role="status" aria-live="polite">
      {fase === 'gravando' ? (
        <>
          <span className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: 'var(--badge-error-text)' }} aria-hidden />
          <span className="text-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>{mmss(segundos)}</span>
          <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>Gravando… até {mmss(LIMITE_S)}</span>
          <button type="button" onClick={() => parar(false)} className="ui-btn ui-btn-secondary ui-btn-sm">Cancelar</button>
          <button type="button" onClick={() => parar(true)} className="ui-btn ui-btn-primary ui-btn-sm">Enviar</button>
        </>
      ) : (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Enviando áudio…</span>
      )}
    </div>
  );
}
