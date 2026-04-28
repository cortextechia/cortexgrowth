'use client';

import { useState } from 'react';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
  displayValue?: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  animKey?: number;
}

export default function DonutChart({
  data,
  size = 180,
  thickness = 28,
  centerLabel,
  centerValue,
  animKey = 0,
}: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const innerR = r - thickness;

  let cumulative = 0;
  const segments = data.map((d) => {
    const startAngle = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
    const large = endAngle - startAngle > Math.PI ? 1 : 0;

    const x1 = cx + Math.cos(startAngle) * r;
    const y1 = cy + Math.sin(startAngle) * r;
    const x2 = cx + Math.cos(endAngle) * r;
    const y2 = cy + Math.sin(endAngle) * r;
    const x3 = cx + Math.cos(endAngle) * innerR;
    const y3 = cy + Math.sin(endAngle) * innerR;
    const x4 = cx + Math.cos(startAngle) * innerR;
    const y4 = cy + Math.sin(startAngle) * innerR;

    const path = `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} A${innerR},${innerR} 0 ${large} 0 ${x4.toFixed(2)},${y4.toFixed(2)} Z`;
    return { ...d, path, pct: (d.value / total) * 100 };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative' }}>
        <svg
          key={animKey}
          width={size}
          height={size}
          style={{ overflow: 'visible' }}
        >
          <style>{`
            @keyframes donut-spin-${animKey} {
              from { transform: rotate(-90deg) scale(0.85); opacity: 0; }
              to   { transform: rotate(0deg)  scale(1);    opacity: 1; }
            }
          `}</style>
          <g style={{
            animation: `donut-spin-${animKey} 0.7s cubic-bezier(0.2,0.6,0.2,1) forwards`,
            transformOrigin: `${cx}px ${cy}px`,
          }}>
            {segments.map((s, i) => (
              <path
                key={i}
                d={s.path}
                fill={s.color}
                fillOpacity={hovered === i ? 1 : 0.85}
                stroke="rgba(15,22,41,1)"
                strokeWidth="2"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  cursor: 'pointer',
                  transform: hovered === i ? 'scale(1.04)' : 'scale(1)',
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: 'transform 0.2s, filter 0.2s',
                  filter: hovered === i ? `drop-shadow(0 0 8px ${s.color}88)` : 'none',
                }}
              />
            ))}
          </g>

          {centerLabel && (
            <text x={cx} y={cy - 6} textAnchor="middle" fill="#475569" fontSize="10"
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'inherit' }}>
              {centerLabel}
            </text>
          )}
          {centerValue && (
            <text x={cx} y={cy + 14} textAnchor="middle" fill="#f1f5f9" fontSize="18" fontWeight="600"
              style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit' }}>
              {centerValue}
            </text>
          )}

          {hovered !== null && (
            <text x={cx} y={cy + 32} textAnchor="middle" fill="#60a5fa" fontSize="11"
              style={{ fontFamily: 'inherit' }}>
              {segments[hovered].pct.toFixed(1)}%
            </text>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((s, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, gap: 8 }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: s.color,
                flexShrink: 0, boxShadow: hovered === i ? `0 0 6px ${s.color}` : 'none',
                transition: 'box-shadow 0.2s',
              }} />
              <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            <span style={{ color: '#f1f5f9', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 500 }}>
              {s.displayValue ?? s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}