'use client';

// Catálogo de produtos do CRM (pedido do Ruan, 28/10/2026 — EM AVALIAÇÃO, não deployado).
// Cadastra aqui; no card, a venda é montada escolhendo produto + quantidade + desconto.
// Sem "excluir": desativar tira da lista da venda nova e preserva o relatório.

import { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/lib/api';
import type { CrmProduct } from '@/types';

const input = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-md)',
  color: 'var(--text-primary)',
} as const;

function fmtMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Mesma máscara do CRM: digita em reais, ponto de milhar ao vivo, vírgula para centavos.
function maskMoney(raw: string): string {
  let s = raw.replace(/[^\d,]/g, '');
  const firstComma = s.indexOf(',');
  if (firstComma !== -1) s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, '');
  const hasComma = s.includes(',');
  const [intRaw = '', decRaw = ''] = s.split(',');
  const intDigits = intRaw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const intFmt = intDigits === '' ? '' : Number(intDigits).toLocaleString('pt-BR');
  if (!hasComma) return intFmt;
  return `${intFmt === '' ? '0' : intFmt},${decRaw.replace(/\D/g, '').slice(0, 2)}`;
}

function parseMoney(masked: string): number {
  const n = parseFloat(masked.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const paraMascara = (v: number) => maskMoney(v.toFixed(2).replace('.', ','));

function erroDaApi(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; errors?: { msg?: string }[] } } };
  return e.response?.data?.message ?? fallback;
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<CrmProduct[] | null>(null);
  const [verDesativados, setVerDesativados] = useState(false);
  const [nome, setNome] = useState('');
  const [sku, setSku] = useState('');
  const [preco, setPreco] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);
  const [editando, setEditando] = useState<{ id: string; name: string; sku: string; price: string } | null>(null);

  const carregar = useCallback(() => {
    apiService.getCrmProducts(true)
      .then((r) => setProdutos(r.data))
      .catch((err) => { setProdutos([]); setAviso({ tipo: 'erro', msg: erroDaApi(err, 'Não foi possível carregar os produtos.') }); });
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const avisar = (tipo: 'ok' | 'erro', msg: string) => {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 3500);
  };

  const cadastrar = async () => {
    if (!nome.trim()) { avisar('erro', 'Dê um nome ao produto.'); return; }
    if (preco.trim() === '') { avisar('erro', 'Informe o preço.'); return; }
    setSalvando(true);
    try {
      await apiService.createCrmProduct({ name: nome.trim(), sku: sku.trim() || null, price: parseMoney(preco) });
      setNome(''); setSku(''); setPreco('');
      avisar('ok', 'Produto cadastrado.');
      carregar();
    } catch (err) {
      avisar('erro', erroDaApi(err, 'Erro ao cadastrar o produto.'));
    } finally {
      setSalvando(false);
    }
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    try {
      await apiService.updateCrmProduct(editando.id, { name: editando.name.trim(), sku: editando.sku.trim() || null, price: parseMoney(editando.price) });
      setEditando(null);
      avisar('ok', 'Produto atualizado. Vendas já feitas mantêm o preço da época.');
      carregar();
    } catch (err) {
      avisar('erro', erroDaApi(err, 'Erro ao salvar o produto.'));
    }
  };

  const alternarAtivo = async (p: CrmProduct) => {
    try {
      await apiService.updateCrmProduct(p.id, { active: !p.active });
      carregar();
    } catch (err) {
      avisar('erro', erroDaApi(err, 'Erro ao alterar o produto.'));
    }
  };

  const visiveis = (produtos ?? []).filter((p) => verDesativados || p.active);
  const desativados = (produtos ?? []).filter((p) => !p.active).length;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="ui-h1">Produtos</h1>
          <p className="ui-sub">Cadastre uma vez; no card do cliente a venda é montada escolhendo produto, quantidade e desconto.</p>
        </div>
        <a href="/dashboard/crm" className="ui-btn ui-btn-secondary ui-btn-sm">← Funil</a>
      </div>

      <div className="ui-card space-y-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Novo produto</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_140px_auto] gap-2 items-end">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Nome
            <input className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={input} value={nome} maxLength={120}
              onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Calça Tech — Masculino" />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Código (SKU) — opcional
            <input className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={input} value={sku} maxLength={60}
              onChange={(e) => setSku(e.target.value)} placeholder="Ex.: SKU4718" />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Preço (R$)
            <input className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-right" style={input} inputMode="decimal" placeholder="0,00"
              value={preco} onChange={(e) => setPreco(maskMoney(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') void cadastrar(); }} />
          </label>
          <button onClick={() => void cadastrar()} disabled={salvando} className="ui-btn ui-btn-primary disabled:opacity-60">
            {salvando ? 'Salvando…' : 'Cadastrar'}
          </button>
        </div>
      </div>

      {aviso && (
        <p className="text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: aviso.tipo === 'ok' ? 'var(--badge-success-text)' : 'var(--badge-error-text)' }} />
          {aviso.msg}
        </p>
      )}

      <div className="ui-card !p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Catálogo {produtos && <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>· {produtos.length - desativados} ativo{produtos.length - desativados === 1 ? '' : 's'}</span>}
          </p>
          {desativados > 0 && (
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Mostrar desativados ({desativados})
              <button className="ui-switch" role="switch" aria-checked={verDesativados} onClick={() => setVerDesativados((v) => !v)} />
            </label>
          )}
        </div>
        {produtos === null ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Carregando…</p>
        ) : visiveis.length === 0 ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum produto cadastrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="ui-table !text-[13px]">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Código</th>
                  <th className="ui-num">Preço</th>
                  <th className="ui-num">Ativo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visiveis.map((p) => editando?.id === p.id ? (
                  <tr key={p.id}>
                    <td><input className="w-full rounded-md px-2 py-1 text-sm" style={input} value={editando.name} maxLength={120}
                      onChange={(e) => setEditando({ ...editando, name: e.target.value })} /></td>
                    <td><input className="w-full rounded-md px-2 py-1 text-sm" style={input} value={editando.sku} maxLength={60}
                      onChange={(e) => setEditando({ ...editando, sku: e.target.value })} /></td>
                    <td className="ui-num"><input className="w-28 rounded-md px-2 py-1 text-sm text-right" style={input} inputMode="decimal"
                      value={editando.price} onChange={(e) => setEditando({ ...editando, price: maskMoney(e.target.value) })}
                      onKeyDown={(e) => { if (e.key === 'Enter') void salvarEdicao(); if (e.key === 'Escape') setEditando(null); }} /></td>
                    <td />
                    <td className="whitespace-nowrap text-right">
                      <button onClick={() => void salvarEdicao()} className="ui-btn ui-btn-primary ui-btn-sm">Salvar</button>{' '}
                      <button onClick={() => setEditando(null)} className="ui-btn ui-btn-secondary ui-btn-sm">Cancelar</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} style={{ opacity: p.active ? 1 : 0.6 }}>
                    <td style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.sku ?? '—'}</td>
                    <td className="ui-num tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtMoney(p.price)}</td>
                    <td className="ui-num">
                      <button className="ui-switch" role="switch" aria-checked={p.active} aria-label={p.active ? `Desativar ${p.name}` : `Reativar ${p.name}`}
                        onClick={() => void alternarAtivo(p)} />
                    </td>
                    <td className="text-right">
                      <button onClick={() => setEditando({ id: p.id, name: p.name, sku: p.sku ?? '', price: paraMascara(p.price) })}
                        className="ui-btn ui-btn-secondary ui-btn-sm">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
