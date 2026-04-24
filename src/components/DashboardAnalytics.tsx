'use client';

import { useState } from 'react';
import MetaAdsChart from './MetaAdsChart';
import GoogleAdsChart from './GoogleAdsChart';
import ConsolidatedChart from './ConsolidatedChart';

export interface MetaInsight {
  id: string;
  date: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach?: number;
  conversions?: number;
  organizationId: string;
}

export interface GoogleAdsMetric {
  id: string;
  date: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions?: number;
  organizationId: string;
}

interface DashboardAnalyticsProps {
  metaInsights: MetaInsight[];
  googleAdsMetrics: GoogleAdsMetric[];
  isLoading: boolean;
}

const TABS = [
  { id: 'consolidated', label: 'Visão Consolidada', requiresMeta: false, requiresGoogle: false },
  { id: 'meta',         label: 'Meta Ads',           requiresMeta: true,  requiresGoogle: false },
  { id: 'google',       label: 'Google Ads',          requiresMeta: false, requiresGoogle: true  },
] as const;

export default function DashboardAnalytics({
  metaInsights,
  googleAdsMetrics,
  isLoading,
}: DashboardAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'consolidated' | 'meta' | 'google'>('consolidated');

  const isEnabled = (tab: typeof TABS[number]) => {
    if (tab.requiresMeta && metaInsights.length === 0) return false;
    if (tab.requiresGoogle && googleAdsMetrics.length === 0) return false;
    if (!tab.requiresMeta && !tab.requiresGoogle) return metaInsights.length > 0 || googleAdsMetrics.length > 0;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div
        className="rounded-xl p-1 flex flex-wrap gap-1"
        style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {TABS.map((tab) => {
          const enabled = isEnabled(tab);
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { if (enabled) setActiveTab(tab.id); }}
              disabled={!enabled}
              className="flex-1 min-w-[120px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all"
              style={
                active
                  ? { backgroundColor: '#3b82f6', color: '#ffffff' }
                  : enabled
                  ? { color: '#64748b', backgroundColor: 'transparent' }
                  : { color: '#334155', cursor: 'not-allowed', backgroundColor: 'transparent' }
              }
              onMouseEnter={e => { if (enabled && !active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3" style={{ color: '#475569' }}>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" />
              <path className="opacity-75" fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Carregando dados...</span>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <>
          {activeTab === 'consolidated' && (
            <ConsolidatedChart metaInsights={metaInsights} googleAdsMetrics={googleAdsMetrics} />
          )}
          {activeTab === 'meta' && <MetaAdsChart data={metaInsights} />}
          {activeTab === 'google' && <GoogleAdsChart data={googleAdsMetrics} />}
        </>
      )}
    </div>
  );
}