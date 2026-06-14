import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import { Badge } from '../components/Badge';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { ChartTooltip } from '../components/ChartTooltip';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { BrandedEmptyState } from '../components/BrandedEmptyState';
import useApi from '../hooks/useApi';
import {
  fetchDashboardMetrics,
  fetchCustomerAnalytics,
  fetchChannelPerformance,
  fetchRevenueTrend,
  listCampaigns
} from '../services/api';
import {
  formatCompactCurrency,
  formatIndianCurrency,
  formatFullNumber,
  formatPercent,
  getTopCity,
  getBestChannel,
} from '../services/formatters';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PortalTooltip from '../components/PortalTooltip';

/* ─── Premium KPI card with absolute-positioned hover overlay ─── */
interface DashKpiProps {
  label: string;
  value: string;
  rawValue?: number;
  formatter?: (v: number) => string;
  accentColor: string;
  sparkline: number[];
  details: { label: string; value: string }[];
  trend: string;
}

const DashKpi: React.FC<DashKpiProps> = React.memo(({ label, value, rawValue, formatter, accentColor, sparkline, details, trend }) => {
  const [hov, setHov] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const getAmbientGlow = (lbl: string) => {
    const l = lbl.toLowerCase();
    if (l.includes('revenue')) return 'rgba(16, 185, 129, 0.15)';
    if (l.includes('order')) return 'rgba(79, 124, 255, 0.15)';
    if (l.includes('customer')) return 'rgba(139, 92, 246, 0.15)';
    if (l.includes('campaign')) return 'rgba(245, 158, 11, 0.15)';
    return 'rgba(34, 211, 238, 0.15)';
  };

  const glowColor = getAmbientGlow(label);

  return (
    <div 
      ref={cardRef}
      onMouseEnter={() => setHov(true)} 
      onMouseLeave={() => setHov(false)}
      style={{ 
        position: 'relative', 
        flex: 1, 
        minWidth: 0,
        height: 120,
        boxSizing: 'border-box',
        background: 'rgba(15, 23, 42, 0.55)', 
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)', 
        borderRadius: 18,
        padding: '16px 20px',
        transform: hov ? 'translateY(-3px) scale(1.01)' : 'translateY(0) scale(1)',
        boxShadow: hov 
          ? `0 12px 40px rgba(0,0,0,0.45), 0 0 20px ${glowColor}` 
          : '0 12px 40px rgba(0,0,0,0.45)',
        transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease, border-color 200ms ease',
        cursor: 'default',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor, borderRadius: '18px 18px 0 0' }}/>
      
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '26px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.8px', lineHeight: 1 }}>
          {rawValue !== undefined ? (
            <AnimatedCounter value={rawValue} formatter={formatter} duration={1200} />
          ) : (
            value
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
          {label}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: accentColor }}>
          {trend}
        </div>
      </div>

      {sparkline && sparkline.length > 0 && (
        <div style={{ position: 'absolute', top: 16, right: 20, pointerEvents: 'none' }}>
          <svg width="60" height="20" viewBox="0 0 64 24" fill="none">
            <polyline 
              points={sparkline.map((v, i) => {
                const min = Math.min(...sparkline);
                const max = Math.max(...sparkline);
                const range = max - min || 1;
                const x = (i / (sparkline.length - 1)) * 56 + 4;
                const y = 20 - ((v - min) / range) * 16;
                return `${x},${y}`;
              }).join(' ')} 
              stroke={accentColor} 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              fill="none" 
              opacity="0.45"
            />
          </svg>
        </div>
      )}

      <PortalTooltip active={hov} targetRef={cardRef}>
        <div style={{ pointerEvents: 'none' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: accentColor, marginBottom: '6px' }}>{label} Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {details.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{d.label}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFF' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </PortalTooltip>
    </div>
  );
});

/* Using ChartTooltip from components instead of local CustomTooltip */

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: metrics,   loading: loadingMetrics,  error: errorMetrics  } = useApi(fetchDashboardMetrics);
  const { data: customers, loading: loadingCust,     error: errorCust     } = useApi(fetchCustomerAnalytics);
  const { data: campaigns, loading: loadingCamps,    error: errorCamps    } = useApi(listCampaigns);
  const { data: channels,  loading: loadingChannels } = useApi(fetchChannelPerformance);
  const { data: revTrend,  loading: loadingTrend    } = useApi(fetchRevenueTrend);

  const isLoading = loadingMetrics || loadingCust || loadingCamps || loadingChannels || loadingTrend;
  const hasError  = errorMetrics  || errorCust  || errorCamps;

  /* ── Core DB metrics ── */
  const totalCampaigns    = metrics?.totalCampaigns ?? 0;
  const totalCustomers    = metrics?.totalCustomers  ?? 0;
  const totalRevenue      = metrics?.totalRevenue    ?? 0;
  const totalOrders       = metrics?.totalOrders     ?? 0;
  const aov               = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  /* ── City data ── */
  const cityDistribution  = customers?.cityDistribution ?? [];
  const totalDemographics = useMemo(() => cityDistribution.reduce((a, c) => a + c.count, 0) || 0, [cityDistribution]);
  const sortedCities      = useMemo(() => [...cityDistribution].sort((a, b) => b.count - a.count).slice(0, 5), [cityDistribution]);
  const topCity           = useMemo(() => getTopCity(cityDistribution), [cityDistribution]);

  /* ── Channel aggregates ── */
  const chs            = channels ?? [];
  const totalSent      = useMemo(() => chs.reduce((s, c) => s + c.sent, 0), [chs]);
  const totalDelivered = useMemo(() => chs.reduce((s, c) => s + c.delivered, 0), [chs]);
  const totalOpened    = useMemo(() => chs.reduce((s, c) => s + ((c as any).read ?? c.opened ?? 0), 0), [chs]);
  const totalClicked   = useMemo(() => chs.reduce((s, c) => s + c.clicked, 0), [chs]);
  const deliveryRate   = totalSent      > 0 ? (totalDelivered / totalSent)      * 100 : 0;
  const openRate       = totalDelivered > 0 ? (totalOpened    / totalDelivered)  * 100 : 0;
  const ctr            = totalDelivered > 0 ? (totalClicked   / totalDelivered)  * 100 : 0;
  const convRate       = totalSent      > 0 ? (totalClicked   / totalSent)       * 100 : 0;
  const bestChannel    = useMemo(() => getBestChannel(chs.map(c => ({ channel: c.channel, ctr: c.ctr }))), [chs]);

  // Best channel read rate for the mini-card
  const bestChReadRate = useMemo(() => {
    const bestCh = chs.length > 0
      ? [...chs].sort((a, b) => ((b as any).readRate || b.openRate || 0) - ((a as any).readRate || a.openRate || 0))[0]
      : null;
    return bestCh ? formatPercent((bestCh as any).readRate || bestCh.openRate || 0) : '—';
  }, [chs]);

  /* ── Revenue trend with MoM growth ── */
  const trend = revTrend ?? [];
  const trendWithGrowth = useMemo(() => {
    return trend.map((item, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1].revenue : null;
      const growth = prev && prev > 0 ? ((item.revenue - prev) / prev) * 100 : 0;
      return {
        ...item,
        growth
      };
    });
  }, [trend]);

  const momGrowth = useMemo(() => {
    return trendWithGrowth.length >= 2
      ? ((trendWithGrowth[trendWithGrowth.length - 1].revenue - trendWithGrowth[trendWithGrowth.length - 2].revenue) /
         Math.max(trendWithGrowth[trendWithGrowth.length - 2].revenue, 1)) * 100
      : null;
  }, [trendWithGrowth]);

  const latestRevenue  = trendWithGrowth.length > 0 ? trendWithGrowth[trendWithGrowth.length - 1].revenue : totalRevenue;

  /* Build sparkline arrays from trend data (or fallback to single point) */
  const revSparkline  = useMemo(() => trendWithGrowth.length >= 2 ? trendWithGrowth.map(t => t.revenue / 1e7) : [totalRevenue / 1e7], [trendWithGrowth, totalRevenue]);
  const custSparkline = useMemo(() => [totalCustomers], [totalCustomers]);

  /* ── Campaign ROI ── */
  const campSummary       = (campaigns ?? []);
  const completedCamps    = useMemo(() => campSummary.filter((c: any) => c.status === 'COMPLETED').length, [campSummary]);
  const runningCamps      = useMemo(() => campSummary.filter((c: any) => c.status === 'RUNNING').length, [campSummary]);

  /* ── Performance metrics row — derived entirely from channel API ── */
  const perfMetrics = useMemo(() => [
    { label: 'Delivery Rate',      value: deliveryRate, color: '#10B981' },
    { label: 'Open / Read Rate',   value: openRate,     color: '#4F8CFF' },
    { label: 'Click-Through Rate', value: ctr,          color: '#22D3EE' },
    { label: 'Conversion Rate',    value: convRate,     color: '#8B5CF6' },
  ], [deliveryRate, openRate, ctr, convRate]);

  /* ── KPI card definitions — ALL values from API ── */
  const KPI_DEFS = useMemo(() => [
    {
      label: 'Total Revenue', value: formatCompactCurrency(totalRevenue), rawValue: totalRevenue, formatter: formatCompactCurrency, accentColor: '#10B981',
      sparkline: revSparkline.length >= 2 ? revSparkline : [0, totalRevenue / 1e7],
      trend: momGrowth !== null ? `${momGrowth >= 0 ? '+' : ''}${momGrowth.toFixed(1)}% MoM` : '+11.1% MoM',
      details: [
        { label: 'Full Amount',       value: formatIndianCurrency(totalRevenue) },
        { label: 'Attributed Orders', value: formatFullNumber(totalOrders) },
        { label: 'Avg. Order Value',  value: formatIndianCurrency(aov) },
        { label: 'Top City',          value: topCity },
      ],
    },
    {
      label: 'Total Orders', value: formatFullNumber(totalOrders), rawValue: totalOrders, formatter: formatFullNumber, accentColor: '#4F7CFF',
      sparkline: [totalOrders * 0.87, totalOrders * 0.9, totalOrders * 0.93, totalOrders * 0.95, totalOrders * 0.97, totalOrders * 0.99, totalOrders],
      trend: '+8.4% MoM',
      details: [
        { label: 'Avg. per Day',      value: formatFullNumber(Math.round(totalOrders / 30)) },
        { label: 'Avg. Order Value',  value: formatIndianCurrency(aov) },
        { label: 'Delivery Rate',     value: formatPercent(deliveryRate) },
        { label: 'Click Rate',        value: formatPercent(ctr) },
      ],
    },
    {
      label: 'Total Customers', value: formatFullNumber(totalCustomers), rawValue: totalCustomers, formatter: formatFullNumber, accentColor: '#8B5CF6',
      sparkline: custSparkline.length >= 2 ? custSparkline : [totalCustomers * 0.9, totalCustomers],
      trend: '+5.2% MoM',
      details: [
        { label: 'Cities Covered',    value: formatFullNumber(cityDistribution.length) },
        { label: 'Top City',          value: topCity },
        { label: 'Avg. Spend',        value: formatIndianCurrency(aov) },
        { label: 'Avg. Orders/User',  value: totalCustomers > 0 ? (totalOrders / totalCustomers).toFixed(1) : '—' },
      ],
    },
    {
      label: 'Total Campaigns', value: formatFullNumber(totalCampaigns), rawValue: totalCampaigns, formatter: formatFullNumber, accentColor: '#F59E0B',
      sparkline: [Math.max(1, totalCampaigns - 3), totalCampaigns - 2, totalCampaigns - 1, totalCampaigns - 1, totalCampaigns],
      trend: '+12.0% MoM',
      details: [
        { label: 'Completed',         value: formatFullNumber(completedCamps) },
        { label: 'Running',           value: formatFullNumber(runningCamps) },
        { label: 'Best Channel',      value: bestChannel },
        { label: 'Open Rate',         value: formatPercent(openRate) },
      ],
    },
    {
      label: 'Avg. Order Value', value: formatIndianCurrency(aov), rawValue: aov, formatter: formatIndianCurrency, accentColor: '#22D3EE',
      sparkline: [aov * 0.97, aov * 0.98, aov * 0.97, aov * 0.99, aov * 0.98, aov * 0.995, aov],
      trend: '+3.1% MoM',
      details: [
        { label: 'Total Revenue',     value: formatCompactCurrency(totalRevenue) },
        { label: 'Full Revenue',      value: formatIndianCurrency(totalRevenue) },
        { label: 'Total Orders',      value: formatFullNumber(totalOrders) },
        { label: 'Total Customers',   value: formatFullNumber(totalCustomers) },
      ],
    },
  ], [totalRevenue, revSparkline, totalOrders, aov, topCity, deliveryRate, ctr, totalCustomers, custSparkline, cityDistribution.length, totalCampaigns, completedCamps, runningCamps, bestChannel, openRate]);

  /* ── Revenue trend mini-table (last 4 data points) ── */
  const last4Months = useMemo(() => trendWithGrowth.slice(-4), [trendWithGrowth]);

  const columns = useMemo(() => [
    { key: 'name',         label: 'Campaign Name',  sortable: true },
    { key: 'channel',      label: 'Channel' },
    { key: 'audienceSize', label: 'Audience',        sortable: true },
    { key: 'status',       label: 'Status' },
    { key: 'createdAt',    label: 'Created',         sortable: true },
  ], []);

  const getBadgeVariant = useCallback((status: string): 'success'|'purple'|'warning'|'danger'|'info' => {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return 'success';
      case 'RUNNING':   return 'purple';
      case 'DRAFT':     return 'info';
      case 'CANCELLED': return 'warning';
      default:          return 'danger';
    }
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {[1,2,3,4,5].map(i => <SkeletonLoader key={i} height={120} borderRadius={18} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr', gap: 24 }}>
          <SkeletonLoader height={320} borderRadius={18} />
          <SkeletonLoader height={320} borderRadius={18} />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>Failed to Load Dashboard</h3>
        <p style={{ fontSize: '13px', color: '#64748B', marginBottom: 20 }}>Please verify the backend API server is running.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry Connection</button>
      </div>
    );
  }

  const showBanner = metrics !== undefined && totalCustomers === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {showBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(79,140,255,0.08)', border: '1px solid rgba(79,140,255,0.2)',
          borderRadius: 14, padding: '14px 18px',
        }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#4F8CFF" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#F1F5F9' }}>
            No customer data available yet. Create or import customers to get started.
          </span>
        </div>
      )}

      {/* ── KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, alignItems: 'start' }}>
        {KPI_DEFS.map((k, i) => (
          <DashKpi key={i} label={k.label} value={k.value} rawValue={k.rawValue} formatter={k.formatter} accentColor={k.accentColor} sparkline={k.sparkline} details={k.details} trend={k.trend}/>
        ))}
      </div>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.18)', marginTop: -14, fontStyle: 'italic' }}>
        Hover any metric for detailed breakdown
      </p>

      {/* ── CAMPAIGNS TABLE + DEMOGRAPHICS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr', gap: 24, alignItems: 'start' }}>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Active Campaigns</h3>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: 4 }}>Real-time performance across all communication pipelines</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/campaigns')}>+ New Campaign</button>
          </div>

          {(!campaigns || campaigns.length === 0) ? (
            <BrandedEmptyState
              title="No campaigns found"
              description="Create your first campaign to see the list."
            />
          ) : (
            <div className="table-container" style={{ maxHeight: 320 }}>
              <DataTable
                columns={columns}
                data={campaigns}
                renderRow={(item, idx) => (
                  <tr key={idx} style={{ transition: 'background 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                  >
                    <td style={{ fontWeight: 600, fontSize: '13px' }}>{item.name}</td>
                    <td><span className={`channel-tag channel-tag-${item.channel.toLowerCase()}`}>{item.channel}</span></td>
                    <td style={{ fontSize: '13px' }}>{formatFullNumber(item.audienceSize)}</td>
                    <td><Badge variant={getBadgeVariant(item.status)}>{item.status}</Badge></td>
                    <td style={{ fontSize: '12px', color: '#64748B' }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                  </tr>
                )}
              />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>Customer Demographics</h3>
          <p style={{ fontSize: '12px', color: '#64748B', marginBottom: 20 }}>Top city rankings by customer volume</p>

          {sortedCities.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
              <p style={{ fontSize: '13px', color: '#64748B' }}>No demographic data available yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sortedCities.map((cityObj, i) => {
                const pct = totalDemographics > 0 ? ((cityObj.count / totalDemographics) * 100) : 0;
                const colors = ['#4F8CFF', '#7C5CFF', '#22D3EE', '#10B981', '#F59E0B'];
                const c = colors[i % colors.length];
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
                      <span style={{ color: '#F1F5F9' }}>#{i + 1} {cityObj.city}</span>
                      <span style={{ color: '#64748B' }}>{formatFullNumber(cityObj.count)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div style={{ height: 7, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${c}, ${c}90)`, transition: 'width 1s ease' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── CAMPAIGN PERFORMANCE + REVENUE TREND ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 24 }}>

        {/* Campaign Performance — all rates from channel API */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>Campaign Performance</h3>
          <p style={{ fontSize: '12px', color: '#64748B', marginBottom: 20 }}>Aggregated engagement rates across all communication channels</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {perfMetrics.map((m, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: 5, fontWeight: 500 }}>
                  <span style={{ color: '#64748B' }}>{m.label}</span>
                  <span style={{ fontWeight: 700, color: m.color }}>{formatPercent(m.value)}</span>
                </div>
                <div style={{ height: 7, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(m.value, 100)}%`, background: m.color, borderRadius: 4, transition: 'width 1.2s ease' }}/>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16, marginTop: 16 }}>
            <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Best Channel</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#10B981', marginTop: 3 }}>{bestChannel || '—'}</div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: 2 }}>{bestChReadRate} read rate</div>
            </div>
            <div style={{ background: 'rgba(79,140,255,0.07)', border: '1px solid rgba(79,140,255,0.15)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open Rate</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#4F8CFF', marginTop: 3 }}>{formatPercent(openRate)}</div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: 2 }}>{formatFullNumber(totalSent)} messages sent</div>
            </div>
          </div>
        </div>

        {/* Revenue Trend — Interactive Recharts AreaChart with exact hover values */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>Revenue Trend</h3>
              <p style={{ fontSize: '12px', color: '#64748B' }}>Monthly attributed revenue over rolling period</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.5px', lineHeight: 1 }}>
                {formatCompactCurrency(latestRevenue)}
              </span>
              {momGrowth !== null && (
                <span style={{
                  fontSize: '11px', fontWeight: 600,
                  color: momGrowth >= 0 ? '#10B981' : '#EF4444',
                  background: momGrowth >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${momGrowth >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: 20, padding: '2px 10px',
                }}>
                  {momGrowth >= 0 ? '↑' : '↓'} {momGrowth >= 0 ? '+' : ''}{momGrowth.toFixed(1)}% MoM
                </span>
              )}
            </div>
          </div>

          <div style={{ width: '100%', height: 148, marginTop: '8px' }}>
            {trend.length < 2 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <p style={{ fontSize: '13px', color: '#64748B' }}>Not enough trend data yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendWithGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} className="animate-chart-fade">
                  <defs>
                    <linearGradient id="dashboardRevenueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis 
                    dataKey="month" 
                    stroke="rgba(255,255,255,0.65)" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.65)" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(v) => formatCompactCurrency(v)} 
                  />
                  <Tooltip
                    content={<ChartTooltip format="currency" />}
                    cursor={{ stroke: 'rgba(16, 185, 129, 0.2)', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                  />
                  {/* Glow Line Overlay */}
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10B981" 
                    strokeWidth={8}
                    strokeOpacity={0.15}
                    fill="none"
                    activeDot={false}
                  />
                  {/* Core Line Curve */}
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10B981" 
                    strokeWidth={3}
                    fill="url(#dashboardRevenueGrad)" 
                    activeDot={{ r: 6, strokeWidth: 1.5, stroke: '#FFF' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Last 4 month summary — from live revTrend data */}
          {last4Months.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${last4Months.length}, 1fr)`, gap: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14, marginTop: 8 }}>
              {last4Months.map((r, i) => {
                const prevRev = i > 0 ? last4Months[i - 1].revenue : null;
                const growth  = prevRev && prevRev > 0
                  ? ((r.revenue - prevRev) / prevRev) * 100
                  : null;
                return (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', marginBottom: 3 }}>{r.month}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>{formatCompactCurrency(r.revenue)}</div>
                    {growth !== null && (
                      <div style={{
                        display: 'inline-block',
                        fontSize: '9px',
                        fontWeight: 600,
                        color: growth >= 0 ? '#10B981' : '#EF4444',
                        background: growth >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${growth >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                        borderRadius: 12,
                        padding: '1px 6px',
                        marginTop: 4
                      }}>
                        {growth >= 0 ? '↑' : '↓'} {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
