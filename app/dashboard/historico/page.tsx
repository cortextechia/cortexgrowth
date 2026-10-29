'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hrefAba } from '@/lib/abasDashboard';

// A Evolução virou aba do dashboard (28/10/2026). A rota fica para quem tinha o
// endereço salvo ou o link antigo não cair numa página 404.
export default function HistoricoRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace(hrefAba('evolucao')); }, [router]);
  return null;
}
