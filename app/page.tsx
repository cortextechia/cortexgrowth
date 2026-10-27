import type { Metadata } from 'next';
import { Manrope, Geist_Mono } from 'next/font/google';
import CromalexLanding from '@/components/landing/CromalexLanding';

const manrope = Manrope({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-cx-display' });
const geistMono = Geist_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-cx-mono' });

// Só a landing leva o nome novo; o app segue "Cortex Growth" até a troca completa.
export const metadata: Metadata = {
  title: 'Cromalex Growth — CRM com WhatsApp que mostra qual anúncio vende',
  description:
    'Todo lead que chega no WhatsApp entra no CRM já com o anúncio que o trouxe. Painel Meta Ads + Google Ads, automações e relatórios de IA. CRM a partir de R$ 99/mês no plano anual.',
};

export default function Page() {
  return <CromalexLanding fontClass={`${manrope.variable} ${geistMono.variable}`} />;
}
