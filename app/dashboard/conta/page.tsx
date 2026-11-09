'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Account } from '@/types';

/**
 * Minha conta — os dados da PESSOA logada (não da empresa; isso é o "Perfil da empresa").
 *
 * Pedido do Ruan (09/11/2026): a agência que recebeu a conta criada por nós precisava trocar a
 * senha. Trocar a senha aqui desconecta os outros aparelhos — é o que tira o acesso de quem
 * sabia a senha antiga.
 */

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10,
  color: 'var(--text-primary)', fontSize: 14, padding: '9px 12px', outline: 'none', width: '100%',
};

type Aviso = { tom: 'ok' | 'erro'; texto: string } | null;

const msgErro = (err: unknown, padrao: string): string => {
  const e = err as { response?: { status?: number; data?: { message?: string } } };
  if (e.response?.status === 429) return e.response.data?.message ?? 'Muitas tentativas. Espere alguns minutos.';
  return e.response?.data?.message ?? padrao;
};

/** 5585999998888 → (85) 99999-8888. Número fora do padrão BR aparece como veio. */
function formatarTelefone(digitos: string | null): string {
  if (!digitos) return '';
  const d = digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13) ? digitos.slice(2) : digitos;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `+${digitos}`;
}

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

/** Recorta no centro e reduz para 256×256 em JPEG — a foto viaja como data URL (~30 KB). */
function reduzirFoto(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx || !lado) return reject(new Error('imagem vazia'));
      ctx.fillStyle = '#ffffff'; // PNG transparente vira fundo branco no JPEG, não preto
      ctx.fillRect(0, 0, 256, 256);
      ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 256, 256);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('formato não suportado')); };
    img.src = url;
  });
}

function AvisoLinha({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  return (
    <p
      role={aviso.tom === 'erro' ? 'alert' : 'status'}
      className="text-xs mt-3 rounded-lg px-3 py-2"
      style={{
        backgroundColor: aviso.tom === 'ok' ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)',
        color: aviso.tom === 'ok' ? 'var(--badge-success-text)' : 'var(--badge-error-text)',
      }}
    >
      {aviso.texto}
    </p>
  );
}

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
      {rotulo}
      {children}
      {dica && <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>{dica}</span>}
    </label>
  );
}

function CampoSenha({ rotulo, valor, onChange, autoComplete, dica }: {
  rotulo: string; valor: string; onChange: (v: string) => void; autoComplete: string; dica?: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <div className="relative">
        <input
          type={ver ? 'text' : 'password'} value={valor} onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete} style={{ ...inputStyle, paddingRight: 64 }} maxLength={100}
        />
        <button
          type="button" onClick={() => setVer((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-1 rounded-md"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={ver ? `Esconder ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`}
        >
          {ver ? 'Esconder' : 'Mostrar'}
        </button>
      </div>
    </Campo>
  );
}

// ─── Foto, nome e telefone ────────────────────────────────────────────────────

function SecaoDados({ conta, onConta }: { conta: Account; onConta: (c: Account) => void }) {
  const { patchUser } = useAuth();
  const [nome, setNome] = useState(conta.name);
  const [telefone, setTelefone] = useState(formatarTelefone(conta.phone));
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [avisoFoto, setAvisoFoto] = useState<Aviso>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const mudou = nome.trim() !== conta.name || telefone.replace(/\D/g, '') !== (formatarTelefone(conta.phone).replace(/\D/g, ''));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setAviso(null);
    try {
      const r = await apiService.updateAccount({ name: nome.trim(), phone: telefone.trim() || null });
      onConta(r.data);
      patchUser({ name: r.data.name, phone: r.data.phone });
      setNome(r.data.name);
      setTelefone(formatarTelefone(r.data.phone));
      setAviso({ tom: 'ok', texto: 'Dados salvos.' });
    } catch (err) {
      setAviso({ tom: 'erro', texto: msgErro(err, 'Não foi possível salvar agora. Tente de novo.') });
    } finally {
      setSalvando(false);
    }
  };

  const escolherFoto = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setAvisoFoto(null);
    if (!arquivo.type.startsWith('image/')) {
      setAvisoFoto({ tom: 'erro', texto: 'Escolha uma imagem (JPG, PNG ou WebP).' });
      return;
    }
    if (arquivo.size > 15 * 1024 * 1024) {
      setAvisoFoto({ tom: 'erro', texto: 'Imagem grande demais (máximo 15 MB).' });
      return;
    }
    setEnviandoFoto(true);
    try {
      const dataUrl = await reduzirFoto(arquivo);
      const r = await apiService.updateAvatar(dataUrl);
      onConta(r.data);
      patchUser({ avatar: r.data.avatar });
      setAvisoFoto({ tom: 'ok', texto: 'Foto atualizada.' });
    } catch (err) {
      const e = err as Error & { response?: unknown };
      setAvisoFoto({
        tom: 'erro',
        texto: e.response ? msgErro(err, 'Não foi possível salvar a foto.') : 'Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.',
      });
    } finally {
      setEnviandoFoto(false);
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  const removerFoto = async () => {
    setEnviandoFoto(true);
    setAvisoFoto(null);
    try {
      const r = await apiService.updateAvatar(null);
      onConta(r.data);
      patchUser({ avatar: null });
      setAvisoFoto({ tom: 'ok', texto: 'Foto removida.' });
    } catch (err) {
      setAvisoFoto({ tom: 'erro', texto: msgErro(err, 'Não foi possível remover a foto.') });
    } finally {
      setEnviandoFoto(false);
    }
  };

  return (
    <section className="ui-card">
      <h2 className="ui-h2">Seus dados</h2>

      <div className="flex flex-wrap items-center gap-4 mt-4">
        {conta.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={conta.avatar} alt="Sua foto" width={72} height={72} className="rounded-full object-cover" style={{ width: 72, height: 72, border: '1px solid var(--border)' }} />
        ) : (
          <div
            className="rounded-full flex items-center justify-center text-xl font-bold"
            style={{ width: 72, height: 72, backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)' }}
            aria-hidden
          >
            {iniciais(conta.name)}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={arquivoRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
            id="foto-conta" onChange={(e) => void escolherFoto(e.target.files?.[0])}
          />
          <label htmlFor="foto-conta" className={`ui-btn ui-btn-secondary ui-btn-sm ${enviandoFoto ? 'pointer-events-none opacity-50' : ''}`}>
            {enviandoFoto ? 'Enviando…' : conta.avatar ? 'Trocar foto' : 'Enviar foto'}
          </label>
          {conta.avatar && (
            <button type="button" className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => void removerFoto()} disabled={enviandoFoto}>
              Remover
            </button>
          )}
        </div>
      </div>
      <AvisoLinha aviso={avisoFoto} />

      <form onSubmit={salvar} className="grid sm:grid-cols-2 gap-4 mt-5">
        <Campo rotulo="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} maxLength={100} autoComplete="name" required minLength={2} />
        </Campo>
        <Campo rotulo="Telefone" dica="Com DDD. Deixe vazio para apagar.">
          <input
            value={telefone} onChange={(e) => setTelefone(e.target.value)} style={inputStyle}
            inputMode="tel" autoComplete="tel" placeholder="(85) 99999-8888" maxLength={30}
          />
        </Campo>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" className="ui-btn ui-btn-primary" disabled={salvando || !mudou || nome.trim().length < 2}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
      <AvisoLinha aviso={aviso} />
    </section>
  );
}

// ─── E-mail ───────────────────────────────────────────────────────────────────

function SecaoEmail({ conta, onConta }: { conta: Account; onConta: (c: Account) => void }) {
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const pedir = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setAviso(null);
    try {
      const r = await apiService.requestEmailChange(novo.trim(), senha);
      onConta(r.data);
      setAberto(false);
      setNovo('');
      setSenha('');
      setAviso({ tom: 'ok', texto: r.message });
    } catch (err) {
      setAviso({ tom: 'erro', texto: msgErro(err, 'Não foi possível pedir a troca agora.') });
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async () => {
    setAviso(null);
    try {
      const r = await apiService.cancelEmailChange();
      onConta(r.data);
      setAviso({ tom: 'ok', texto: 'Troca de e-mail cancelada.' });
    } catch (err) {
      setAviso({ tom: 'erro', texto: msgErro(err, 'Não foi possível cancelar.') });
    }
  };

  return (
    <section className="ui-card">
      <h2 className="ui-h2">E-mail de acesso</h2>
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
        É com ele que você entra e é para ele que vai o link de &quot;esqueci minha senha&quot;.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold break-all" style={{ color: 'var(--text-primary)' }}>{conta.email}</p>
          <p className="text-xs mt-0.5" style={{ color: conta.emailVerified ? 'var(--badge-success-text)' : 'var(--badge-warn-text)' }}>
            {conta.emailVerified ? 'Confirmado' : 'Ainda não confirmado'}
          </p>
        </div>
        {!aberto && !conta.pendingEmail && (
          <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => { setAberto(true); setAviso(null); }}>
            Trocar e-mail
          </button>
        )}
      </div>

      {conta.pendingEmail && (
        <div className="ui-inset px-4 py-3 mt-4">
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
            Aguardando confirmação de <b className="break-all">{conta.pendingEmail}</b>
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Abra o link que mandamos para esse endereço. Até lá, continue entrando com {conta.email}.
            {conta.pendingEmailExpires && ` O link vale até ${new Date(conta.pendingEmailExpires).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => { setAberto(true); setAviso(null); }}>
              Mandar de novo / usar outro
            </button>
            <button type="button" className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => void cancelar()}>
              Cancelar troca
            </button>
          </div>
        </div>
      )}

      {aberto && (
        <form onSubmit={pedir} className="grid sm:grid-cols-2 gap-4 mt-4">
          <Campo rotulo="Novo e-mail">
            <input type="email" value={novo} onChange={(e) => setNovo(e.target.value)} style={inputStyle} autoComplete="email" required maxLength={200} />
          </Campo>
          {conta.hasPassword ? (
            <CampoSenha rotulo="Sua senha atual" valor={senha} onChange={setSenha} autoComplete="current-password" dica="Para confirmar que é você." />
          ) : null}
          <p className="sm:col-span-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Vamos mandar um link para o endereço novo. O e-mail só muda quando você abrir esse link,
            e avisamos o endereço atual.
          </p>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button type="submit" className="ui-btn ui-btn-primary" disabled={enviando || !novo.trim() || !senha || !conta.hasPassword}>
              {enviando ? 'Enviando…' : 'Enviar link de confirmação'}
            </button>
            <button type="button" className="ui-btn ui-btn-secondary" onClick={() => { setAberto(false); setSenha(''); }}>
              Cancelar
            </button>
          </div>
          {!conta.hasPassword && (
            <p className="sm:col-span-2 text-xs" style={{ color: 'var(--badge-warn-text)' }}>
              Sua conta ainda não tem senha. Crie uma pelo &quot;Esqueci minha senha&quot; na tela de login antes de trocar o e-mail.
            </p>
          )}
        </form>
      )}
      <AvisoLinha aviso={aviso} />
    </section>
  );
}

// ─── Senha ────────────────────────────────────────────────────────────────────

function SecaoSenha({ conta, onTrocou }: { conta: Account; onTrocou: () => void }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [repetir, setRepetir] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const regras = [
    { ok: nova.length >= 8, texto: '8 caracteres ou mais' },
    { ok: /[A-Z]/.test(nova), texto: 'uma letra maiúscula' },
    { ok: /[0-9]/.test(nova), texto: 'um número' },
  ];
  const confere = repetir.length > 0 && nova === repetir;
  const pronta = atual.length > 0 && regras.every((r) => r.ok) && confere;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setAviso(null);
    try {
      const r = await apiService.changePassword(atual, nova);
      setAtual(''); setNova(''); setRepetir('');
      setAviso({ tom: 'ok', texto: r.message });
      onTrocou();
    } catch (err) {
      setAviso({ tom: 'erro', texto: msgErro(err, 'Não foi possível alterar a senha agora.') });
    } finally {
      setSalvando(false);
    }
  };

  if (!conta.hasPassword) {
    return (
      <section className="ui-card">
        <h2 className="ui-h2">Senha</h2>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          Sua conta entra pelo Google e ainda não tem senha. Para criar uma, saia e use
          &quot;Esqueci minha senha&quot; na tela de login com {conta.email}.
        </p>
      </section>
    );
  }

  return (
    <section className="ui-card">
      <h2 className="ui-h2">Senha</h2>
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
        Ao trocar a senha, todos os outros aparelhos conectados nesta conta são desconectados. Este continua.
      </p>
      <form onSubmit={salvar} className="grid sm:grid-cols-2 gap-4 mt-4">
        <div className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
          <CampoSenha rotulo="Senha atual" valor={atual} onChange={setAtual} autoComplete="current-password" />
        </div>
        <CampoSenha rotulo="Nova senha" valor={nova} onChange={setNova} autoComplete="new-password" />
        <CampoSenha rotulo="Repita a nova senha" valor={repetir} onChange={setRepetir} autoComplete="new-password" />
        <ul className="sm:col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Regras da nova senha">
          {regras.map((r) => (
            <li key={r.texto} style={{ color: r.ok ? 'var(--badge-success-text)' : 'var(--text-secondary)' }}>
              {r.ok ? '✓' : '○'} {r.texto}
            </li>
          ))}
          {repetir.length > 0 && (
            <li style={{ color: confere ? 'var(--badge-success-text)' : 'var(--badge-error-text)' }}>
              {confere ? '✓ as duas conferem' : '✗ as duas não conferem'}
            </li>
          )}
        </ul>
        <div className="sm:col-span-2">
          <button type="submit" className="ui-btn ui-btn-primary" disabled={salvando || !pronta}>
            {salvando ? 'Alterando…' : 'Alterar senha'}
          </button>
        </div>
      </form>
      <AvisoLinha aviso={aviso} />
    </section>
  );
}

// ─── Aparelhos ────────────────────────────────────────────────────────────────

function SecaoAparelhos({ conta, onSaiu }: { conta: Account; onSaiu: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const outros = Math.max(conta.sessions - 1, 0);

  const sair = async () => {
    setSaindo(true);
    setAviso(null);
    try {
      const r = await apiService.logoutOtherDevices();
      setAviso({ tom: 'ok', texto: r.message });
      setConfirmando(false);
      onSaiu();
    } catch (err) {
      setAviso({ tom: 'erro', texto: msgErro(err, 'Não foi possível desconectar agora.') });
    } finally {
      setSaindo(false);
    }
  };

  return (
    <section className="ui-card">
      <h2 className="ui-h2">Aparelhos conectados</h2>
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
        {outros === 0
          ? 'Só este aparelho está conectado na sua conta.'
          : `Além deste, ${outros === 1 ? 'há 1 outro aparelho conectado' : `há ${outros} outros aparelhos conectados`} na sua conta.`}
        {' '}Se alguém que não deveria tem acesso, desconecte todos e troque a senha.
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        {!confirmando ? (
          <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setConfirmando(true)} disabled={outros === 0}>
            Sair de todos os outros aparelhos
          </button>
        ) : (
          <>
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Desconectar {outros === 1 ? 'o outro aparelho' : `os ${outros} outros aparelhos`}?</span>
            <button type="button" className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => void sair()} disabled={saindo}>
              {saindo ? 'Desconectando…' : 'Sim, desconectar'}
            </button>
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setConfirmando(false)} disabled={saindo}>
              Não
            </button>
          </>
        )}
      </div>
      <AvisoLinha aviso={aviso} />
    </section>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function MinhaContaPage() {
  const [conta, setConta] = useState<Account | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await apiService.getAccount();
      setConta(r.data);
      setErro(null);
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível carregar sua conta.'));
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    apiService.getAccount()
      .then((r) => { if (vivo) setConta(r.data); })
      .catch((err) => { if (vivo) setErro(msgErro(err, 'Não foi possível carregar sua conta.')); });
    return () => { vivo = false; };
  }, []);

  if (erro) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm" style={{ color: 'var(--badge-error-text)' }}>{erro}</p>
        <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm mt-3" onClick={() => void carregar()}>Tentar de novo</button>
      </div>
    );
  }
  if (!conta) {
    return <div className="max-w-3xl h-40 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />;
  }

  return (
    <div className="max-w-3xl space-y-4">
      <header className="mb-2">
        <h1 className="ui-h1">Minha conta</h1>
        <p className="ui-sub">Seus dados de acesso. O que é da empresa fica em Perfil da empresa.</p>
      </header>
      <SecaoDados conta={conta} onConta={setConta} />
      <SecaoEmail conta={conta} onConta={setConta} />
      <SecaoSenha conta={conta} onTrocou={() => void carregar()} />
      <SecaoAparelhos conta={conta} onSaiu={() => void carregar()} />
    </div>
  );
}
