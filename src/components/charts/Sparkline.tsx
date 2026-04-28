'use client';

import { useRef, useEffect, useState } from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  animKey?: number;
}

export default function Sparkline({
  data,
  color = '#3b82f6',
  height = 40,
  width = 120,
  animKey = 0,
}: SparklineProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLen, setPathLen] = useState(0);
  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}-${Math.random().toString(36).slice(2, 6)}`;

  const pts = (() => {
    if (data.length < 2) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    return data.map((v, i) => [
      i * stepX,
      height - ((v - min) / range) * (height - 6) - 3,
    ]);
  })();

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = pts.length
    ? `${linePath} L${width},${height} L0,${height} Z`
    : '';

  useEffect(() => {
    if (pathRef.current) setPathLen(pathRef.current.getTotalLength());
  }, [animKey, data.length]);

  if (pts.length < 2) return null;

  return (
    <svg
      key={animKey}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <style>{`
          @keyframes spark-draw-${animKey} { to { stroke-dashoffset: 0; } }
          @keyframes spark-fade-${animKey} { to { opacity: 1; } }
        `}</style>
      </defs>
      <path
        d={areaPath}
        fill={`url(#${id})`}
        style={{ opacity: 0, animation: `spark-fade-${animKey} 0.5s ease 0.1s forwards` }}
      />
      <path
        ref={pathRef}
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={pathLen ? {
          strokeDasharray: pathLen,
          strokeDashoffset: pathLen,
          animation: `spark-draw-${animKey} 1s cubic-bezier(0.2,0.6,0.2,1) forwards`,
        } : undefined}
      />
      {pts.length > 0 && (
        <circle
          cx={pts[pts.length - 1][0]}
          cy={pts[pts.length - 1][1]}
          r="2.5"
          fill={color}
          style={{ opacity: 0, animation: `spark-fade-${animKey} 0.3s ease 0.9s forwards` }}
        />
      )}
    </svg>
  );
}