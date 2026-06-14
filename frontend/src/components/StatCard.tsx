import React from 'react';
import { Badge } from './Badge';
import { ChannelTag } from './ChannelTag';
import type { ChannelType } from './ChannelTag';

interface StatCardProps {
  label: string;
  value: string | number;
  percentChange?: string | number;
  percentVariant?: 'success' | 'danger' | 'warning' | 'info';
  channel?: ChannelType;
  icon?: React.ReactNode;
  className?: string;
  trend?: string;
  trendText?: string;
  sparkline?: number[];
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  percentChange,
  percentVariant = 'success',
  channel,
  icon,
  className = '',
  trend,
  trendText,
  sparkline
}) => {
  const drawSparkline = (points: number[]) => {
    if (!points || points.length < 2) return null;
    const width = 65;
    const height = 20;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    const pathData = points
      .map((val, index) => {
        const x = (index / (points.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 4) - 2; // leave 2px padding top/bottom
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    const strokeColor = percentVariant === 'danger' ? '#EF4444' : '#10B981';
    return (
      <svg className="kpi-sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ overflow: 'visible' }}>
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className={`stat-card kpi-card ${className}`} style={{ minHeight: '115px' }}>
      <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-card-label" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {channel ? (
            <ChannelTag 
              channel={channel} 
              className="!p-0 !border-none !bg-transparent"
            />
          ) : (
            <span>{label}</span>
          )}
        </div>
        {icon && <div className="stat-card-icon" style={{ opacity: 0.6 }}>{icon}</div>}
      </div>

      <div className="stat-card-value-container" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '6px' }}>
        <span className="stat-card-value" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
        {sparkline && drawSparkline(sparkline)}
      </div>

      {/* Footer Sparklines / Trend info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '11px' }}>
        {trend && (
          <span style={{ 
            fontWeight: 600, 
            color: percentVariant === 'danger' ? 'var(--danger)' : 'var(--success)' 
          }}>
            {trend}
          </span>
        )}
        {trendText && (
          <span className="text-muted" style={{ fontSize: '10px' }}>
            {trendText}
          </span>
        )}
        {percentChange && (
          <div style={{ marginLeft: 'auto' }}>
            <Badge variant={percentVariant}>
              {percentChange}
            </Badge>
          </div>
        )}
      </div>
      
      {channel && <div className="text-label" style={{ marginTop: '4px' }}>{label}</div>}
    </div>
  );
};

export default StatCard;
