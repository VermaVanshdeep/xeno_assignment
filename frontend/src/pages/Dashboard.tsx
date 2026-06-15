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
  listCampaigns,
  fetchCRMHealth,
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

/* ─── Premium KPI card ─── */
interface DashKpiProps {
  label: string;
  value: string;
  rawValue?: number;
  formatter?: (v: number) => string;
  accentColor: string;
  sparkline: number[];
  details: { label: string; value: string }[];
  trend: string;
  onClick?: () => void;
}

const DashKpi: React.FC<DashKpiProps> = React.memo(({ label, value, rawValue, formatter, accentColor, sparkline, details, trend, onClick }) => {
  const [hov, setHov] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const glowColor = (() => {
    const l = label.toLowerCase();
    if (l.includes('revenue')) return 'rgba(16, 185, 129, 0.2)';
    if (l.includes('order')) return 'rgba(79, 124, 255, 0.2)';
    if (l.includes('customer')) return 'rgba(139, 92, 246, 0.2)';
    if (l.includes('campaign')) return 'rgba(245, 158, 11, 0.2)';
    return 'rgba(34, 211, 238, 0.2)';
  })();

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        height: 120,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${hov ? 'rgba(255,255,255,0.18)' : 'rgba(255, 255, 255, 0.08)'}`,
        borderRadius: 18,
        padding: '16px 20px',
        transform: hov ? 'translateY(-3px) scale(1.01)' : 'translateY(0) scale(1)',
        boxShadow: hov
          ? `0 12px 40px rgba(0,0,0,0.45), 0 0 20px ${glowColor}`
          : '0 12px 40px rgba(0,0,0,0.45)',
        transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease, border-color 200ms ease',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor, borderRadius: '18px 18px 0 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '26px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.8px', lineHeight: 1 }}>
          {rawValue !== undefined ? (
            <AnimatedCounter value={rawValue} formatter={formatter} duration={1200} />
          ) : value}
        </div>
        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: accentColor }}>{trend}</div>
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
          {onClick && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>Click to drill down →</div>}
        </div>
      </PortalTooltip>
    </div>
  );
});

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: metrics,   loading: loadingMetrics,  error: errorMetrics  } = useApi(fetchDashboardMetrics);
  const { data: customers, loading: loadingCust,     error: errorCust     } = useApi(fetchCustomerAnalytics);
  const { data: campaigns, loading: loadingCamps,    error: errorCamps    } = useApi(listCampaigns);
  const { data: channels,  loading: loadingChannels } = useApi(fetchChannelPerformance);
  const { data: revTrend,  loading: loadingTrend    } = useApi(fetchRevenueTrend);
  const { data: crmHealth, loading: loadingHealth   } = useApi(fetchCRMHealth);

  // Filters
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');

  const isLoading = loadingMetrics || loadingCust || loadingCamps || loadingChannels || loadingTrend;
  const hasError  = errorMetrics || errorCust || errorCamps;

  /* ── Core DB metrics ── */
  const totalCampaigns = metrics?.totalCampaigns ?? 0;
  const totalCustomers = metrics?.totalCustomers  ?? 0;
  const totalRevenue   = metrics?.totalRevenue    ?? 0;
  const totalOrders    = metrics?.totalOrders     ?? 0;
  const aov            = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  /* ── City data ── */
  const cityDistribution  = customers?.cityDistribution ?? [];
  const totalDemographics = useMemo(() => cityDistribution.reduce((a, c) => a + c.count, 0) || 0, [cityDistribution]);
  const sortedCities      = useMemo(() => [...cityDistribution].sort((a, b) => b.count - a.count).slice(0, 5), [cityDistribution]);
  const topCity           = useMemo(() => getTopCity(cityDistribution), [cityDistribution]);

  /* ── Channel aggregates ── */
  const chs            = channels ?? [];
  const totalSent      = useMemo(() => chs.reduce((s, c) => s + c.sent, 0), [chs]);
  const totalDelivered = useMemo(() => chs.reduce((s, c) => s + c.delivered, 0), [chs]);
  const totalOpened    = useMemo(() => chs.reduce((s, c) => {
    const readVal   = (c as any).read   ?? 0;
    const openedVal = c.opened          ?? 0;
    return s + (readVal > 0 ? readVal : openedVal);
  }, 0), [chs]);
  const totalClicked   = useMemo(() => chs.reduce((s, c) => s + c.clicked, 0), [chs]);
  const deliveryRate   = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  const openRate       = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
  const ctr            = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;
  const convRate       = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
  const bestChannel    = useMemo(() => getBestChannel(chs.map(c => ({ channel: c.channel, ctr: c.ctr }))), [chs]);

  const bestChReadRate = useMemo(() => {
    const bestCh = chs.length > 0
      ? [...chs].sort((a, b) => ((b as any).readRate || b.openRate || 0) - ((a as any).readRate || a.openRate || 0))[0]
      : null;
    return bestCh ? formatPercent((bestCh as any).readRate || bestCh.openRate || 0) : '—';
  }, [chs]);

  /* ── Revenue trend ── */
  const trend = revTrend ?? [];
  const trendWithGrowth = useMemo(() => trend.map((item, idx, arr) => {
    const prev = idx > 0 ? arr[idx - 1].revenue : null;
    const growth = prev && prev > 0 ? ((item.revenue - prev) / prev) * 100 : 0;
    return { ...item, growth };
  }), [trend]);

  const momGrowth = useMemo(() => {
    return trendWithGrowth.length >= 2
      ? ((trendWithGrowth[trendWithGrowth.length - 1].revenue - trendWithGrowth[trendWithGrowth.length - 2].revenue) /
          Math.max(trendWithGrowth[trendWithGrowth.length - 2].revenue, 1)) * 100
      : null;
  }, [trendWithGrowth]);

  const latestRevenue = trendWithGrowth.length > 0 ? trendWithGrowth[trendWithGrowth.length - 1].revenue : totalRevenue;

  const revSparkline  = useMemo(() => trendWithGrowth.length >= 2 ? trendWithGrowth.map(t => t.revenue / 1e7) : [totalRevenue / 1e7], [trendWithGrowth, totalRevenue]);
  const custSparkline = useMemo(() => [totalCustomers], [totalCustomers]);

  /* ── Campaign stats ── */
  const campSummary    = campaigns ?? [];
  const completedCamps = useMemo(() => campSummary.filter((c: any) => c.status === 'COMPLETED').length, [campSummary]);
  const runningCamps   = useMemo(() => campSummary.filter((c: any) => c.status === 'RUNNING').length, [campSummary]);

  /* ── Filtered campaigns for table ── */
  const filteredCampaigns = useMemo(() => {
    let list = campSummary;
    if (channelFilter !== 'ALL') {
      list = list.filter((c: any) => c.channel === channelFilter);
    }
    if (dateFilter !== 'ALL') {
      const days = dateFilter === '7D' ? 7 : dateFilter === '30D' ? 30 : 90;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      list = list.filter((c: any) => new Date(c.createdAt) >= cutoff);
    }
    return list;
  }, [campSummary, channelFilter, dateFilter]);

  /* ── Performance metrics ── */
  const perfMetrics = useMemo(() => [
    { label: 'Delivery Rate',      value: deliveryRate, color: '#10B981' },
    { label: 'Open / Read Rate',   value: openRate,     color: '#4F8CFF' },
    { label: 'Click-Through Rate', value: ctr,          color: '#22D3EE' },
    { label: 'Conversion Rate',    value: convRate,     color: '#8B5CF6' },
  ], [deliveryRate, openRate, ctr, convRate]);

  /* ── KPI Defs ── */
  const KPI_DEFS = useMemo(() => [
    {
      label: 'Total Revenue', value: formatCompactCurrency(totalRevenue), rawValue: totalRevenue, formatter: formatCompactCurrency, accentColor: '#10B981',
      sparkline: revSparkline.length >= 2 ? revSparkline : [0, totalRevenue / 1e7],
      trend: momGrowth !== null ? `${momGrowth >= 0 ? '+' : ''}${momGrowth.toFixed(1)}% MoM` : '—',
      details: [
        { label: 'Full Amount',       value: formatIndianCurrency(totalRevenue) },
        { label: 'Attributed Orders', value: formatFullNumber(totalOrders) },
        { label: 'Avg. Order Value',  value: formatIndianCurrency(aov) },
        { label: 'Top City',          value: topCity },
      ],
      onClick: () => navigate('/analytics'),
    },
    {
      label: 'Total Orders', value: formatFullNumber(totalOrders), rawValue: totalOrders, formatter: formatFullNumber, accentColor: '#4F7CFF',
      sparkline: [totalOrders * 0.87, totalOrders * 0.9, totalOrders * 0.95, totalOrders * 0.99, totalOrders],
      trend: `AOV ${formatIndianCurrency(aov)}`,
      details: [
        { label: 'Avg. per Day',     value: formatFullNumber(Math.round(totalOrders / 30)) },
        { label: 'Avg. Order Value', value: formatIndianCurrency(aov) },
        { label: 'Delivery Rate',    value: formatPercent(deliveryRate) },
        { label: 'Click Rate',       value: formatPercent(ctr) },
      ],
      onClick: () => navigate('/analytics'),
    },
    {
      label: 'Total Customers', value: formatFullNumber(totalCustomers), rawValue: totalCustomers, formatter: formatFullNumber, accentColor: '#8B5CF6',
      sparkline: custSparkline.length >= 2 ? custSparkline : [totalCustomers * 0.9, totalCustomers],
      trend: `${cityDistribution.length} cities covered`,
      details: [
        { label: 'Cities Covered',   value: formatFullNumber(cityDistribution.length) },
        { label: 'Top City',         value: topCity },
        { label: 'Avg. Spend',       value: formatIndianCurrency(aov) },
        { label: 'Orders/User',      value: totalCustomers > 0 ? (totalOrders / totalCustomers).toFixed(1) : '—' },
      ],
      onClick: () => navigate('/customers'),
    },
    {
      label: 'Total Campaigns', value: formatFullNumber(totalCampaigns), rawValue: totalCampaigns, formatter: formatFullNumber, accentColor: '#F59E0B',
      sparkline: [Math.max(1, totalCampaigns - 3), totalCampaigns - 1, totalCampaigns],
      trend: `${completedCamps} completed · ${runningCamps} live`,
      details: [
        { label: 'Completed',    value: formatFullNumber(completedCamps) },
        { label: 'Running',      value: formatFullNumber(runningCamps) },
        { label: 'Best Channel', value: bestChannel },
        { label: 'Open Rate',    value: formatPercent(openRate) },
      ],
      onClick: () => navigate('/campaigns'),
    },
    {
      label: 'Avg. Order Value', value: formatIndianCurrency(aov), rawValue: aov, formatter: formatIndianCurrency, accentColor: '#22D3EE',
      sparkline: [aov * 0.97, aov * 0.98, aov * 0.99, aov],
      trend: `CTR ${formatPercent(ctr)}`,
      details: [
        { label: 'Total Revenue',  value: formatCompactCurrency(totalRevenue) },
        { label: 'Total Orders',   value: formatFullNumber(totalOrders) },
        { label: 'Total Customers', value: formatFullNumber(totalCustomers) },
        { label: 'Best Channel',   value: bestChannel },
      ],
      onClick: () => navigate('/analytics'),
    },
  ], [totalRevenue, revSparkline, totalOrders, aov, topCity, deliveryRate, ctr, totalCustomers, custSparkline, cityDistribution.length, totalCampaigns, completedCamps, runningCamps, bestChannel, openRate, momGrowth, navigate]);

  const last4Months = useMemo(() => trendWithGrowth.slice(-4), [trendWithGrowth]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(79,140,255,0.08)', border: '1px solid rgba(79,140,255,0.2)', borderRadius: 14, padding: '14px 18px' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#4F8CFF" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#F1F5F9' }}>
            No customer data available yet. Create or import customers to get started.
          </span>
        </div>
      )}

      {/* ── KPI CARDS ── */}
      <div className="dashboard-kpi-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, alignItems: 'start' }}>
        {KPI_DEFS.map((k, i) => (
          <DashKpi key={i} {...k} />
        ))}
      </div>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.18)', marginTop: -14, fontStyle: 'italic' }}>
        Hover any metric for breakdown · Click to drill down
      </p>

      {/* ── CAMPAIGNS TABLE + DEMOGRAPHICS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr', gap: 24, alignItems: 'start' }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Campaigns</h3>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: 4 }}>All communication pipelines</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/campaigns')}>+ New Campaign</button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div className="filter-chip-group">
              {['ALL', 'WHATSAPP', 'SMS', 'EMAIL', 'RCS'].map(ch => (
                <button
                  key={ch}
                  className={`filter-chip ${channelFilter === ch ? 'active' : ''}`}
                  onClick={() => setChannelFilter(ch)}
                >
                  {ch === 'ALL' ? 'All Channels' : ch.charAt(0) + ch.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="filter-chip-group">
              {[{ key: 'ALL', label: 'All time' }, { key: '7D', label: 'Last 7d' }, { key: '30D', label: 'Last 30d' }, { key: '90D', label: 'Last 90d' }].map(f => (
                <button
                  key={f.key}
                  className={`filter-chip ${dateFilter === f.key ? 'active' : ''}`}
                  onClick={() => setDateFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredCampaigns.length === 0 ? (
            <BrandedEmptyState title="No campaigns match filters" description="Try changing the channel or date range." />
          ) : (
            <div className="table-container scrollable">
              <DataTable
                columns={[
                  { key: 'name',         label: 'Campaign',  sortable: true },
                  { key: 'channel',      label: 'Channel' },
                  { key: 'audienceSize', label: 'Audience',  sortable: true },
                  { key: 'status',       label: 'Status' },
                  { key: 'createdAt',    label: 'Created',   sortable: true },
                ]}
                data={filteredCampaigns}
                renderRow={(item, idx) => (
                  <tr
                    key={idx}
                    style={{ transition: 'background 150ms', cursor: 'pointer' }}
                    onClick={() => navigate('/campaigns')}
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
          <p style={{ fontSize: '12px', color: '#64748B', marginBottom: 20 }}>Top cities by customer volume</p>

          {sortedCities.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
              <p style={{ fontSize: '13px', color: '#64748B' }}>No demographic data yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sortedCities.map((cityObj, i) => {
                const pct = totalDemographics > 0 ? ((cityObj.count / totalDemographics) * 100) : 0;
                const colors = ['#4F8CFF', '#7C5CFF', '#22D3EE', '#10B981', '#F59E0B'];
                const c = colors[i % colors.length];
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500, marginBottom: 5 }}>
                      <span style={{ color: '#F1F5F9' }}>#{i + 1} {cityObj.city}</span>
                      <span style={{ color: '#64748B' }}>{formatFullNumber(cityObj.count)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div style={{ height: 7, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${c}, ${c}90)`, transition: 'width 1s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── PERFORMANCE + REVENUE TREND ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>Channel Performance</h3>
          <p style={{ fontSize: '12px', color: '#64748B', marginBottom: 20 }}>Aggregated engagement rates across all channels</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {perfMetrics.map((m, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: 5, fontWeight: 500 }}>
                  <span style={{ color: '#64748B' }}>{m.label}</span>
                  <span style={{ fontWeight: 700, color: m.color }}>{formatPercent(m.value)}</span>
                </div>
                <div style={{ height: 7, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(m.value, 100)}%`, background: m.color, borderRadius: 4, transition: 'width 1.2s ease' }} />
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
                <AreaChart data={trendWithGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardRevenueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.65)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.65)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <Tooltip
                    content={<ChartTooltip format="currency" />}
                    cursor={{ stroke: 'rgba(16, 185, 129, 0.2)', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={8} strokeOpacity={0.15} fill="none" activeDot={false} />
                  <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} fill="url(#dashboardRevenueGrad)" activeDot={{ r: 6, strokeWidth: 1.5, stroke: '#FFF' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {last4Months.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${last4Months.length}, 1fr)`, gap: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14, marginTop: 8 }}>
              {last4Months.map((r, i) => {
                const prevRev = i > 0 ? last4Months[i - 1].revenue : null;
                const growth  = prevRev && prevRev > 0 ? ((r.revenue - prevRev) / prevRev) * 100 : null;
                return (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', marginBottom: 3 }}>{r.month}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>{formatCompactCurrency(r.revenue)}</div>
                    {growth !== null && (
                      <div style={{
                        display: 'inline-block', fontSize: '9px', fontWeight: 600,
                        color: growth >= 0 ? '#10B981' : '#EF4444',
                        background: growth >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${growth >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                        borderRadius: 12, padding: '1px 6px', marginTop: 4
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

      {/* ── CRM INTELLIGENCE (Health Score + Business Signals) ── */}
      {crmHealth && !loadingHealth && (
        <div className="card" style={{ padding: 24 }}>
          {/* Section header — title + health rings in one tidy row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>CRM Intelligence</h3>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: 4 }}>Live health scores derived from campaign & customer data</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {/* Compact health badge — Campaign */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)',
                borderRadius: 12, padding: '10px 18px'
              }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: crmHealth.campaignHealthScore >= 70 ? '#10B981' : crmHealth.campaignHealthScore >= 40 ? '#F59E0B' : '#EF4444', lineHeight: 1 }}>
                  {crmHealth.campaignHealthScore}
                </span>
                <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaign Health</span>
              </div>
              {/* Compact health badge — Audience */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.18)',
                borderRadius: 12, padding: '10px 18px'
              }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: crmHealth.audienceQualityScore >= 70 ? '#10B981' : crmHealth.audienceQualityScore >= 40 ? '#F59E0B' : '#EF4444', lineHeight: 1 }}>
                  {crmHealth.audienceQualityScore}
                </span>
                <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audience Quality</span>
              </div>
            </div>
          </div>

          {/* 2x2 clean intelligence grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{
              background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Top Converting City</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981', lineHeight: 1, marginBottom: 4 }}>{crmHealth.topConvertingCity}</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Highest click-rate relative to deliveries</div>
            </div>

            <div style={{
              background: 'rgba(79,140,255,0.05)', border: '1px solid rgba(79,140,255,0.15)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Avg. Campaign ROI</div>
              <div style={{
                fontSize: '20px', fontWeight: 800, lineHeight: 1, marginBottom: 4,
                color: crmHealth.avgCampaignROI >= 0 ? '#10B981' : '#EF4444'
              }}>
                {crmHealth.avgCampaignROI >= 0 ? '+' : ''}{Math.min(crmHealth.avgCampaignROI, 500).toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Avg. across completed campaigns (capped at 500%)</div>
            </div>

            <div style={{
              background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Revenue Attribution</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#22D3EE', lineHeight: 1, marginBottom: 4 }}>{crmHealth.revenueAttributionPct}%</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>{formatCompactCurrency(crmHealth.totalAttributedRevenue)} revenue attributed to campaigns</div>
            </div>

            <div style={{
              background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Best Campaign</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#F59E0B', lineHeight: 1.2, marginBottom: 4 }}>
                {crmHealth.bestCampaign?.name || '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                {crmHealth.bestCampaign ? formatCompactCurrency(crmHealth.bestCampaign.revenue) + ' attributed' : 'No data yet'}
              </div>
            </div>
          </div>

          {crmHealth.worstCampaign && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lowest Performer</span>
                <span style={{ fontSize: '13px', color: '#F1F5F9', fontWeight: 600, marginLeft: 12 }}>{crmHealth.worstCampaign.name}</span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--danger)' }}>{formatCompactCurrency(crmHealth.worstCampaign.revenue)} attributed · {crmHealth.worstCampaign.channel}</span>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default Dashboard;
