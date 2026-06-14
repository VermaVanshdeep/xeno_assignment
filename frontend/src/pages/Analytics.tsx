import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useApi from '../hooks/useApi';
import { 
  fetchDashboardMetrics, 
  fetchChannelPerformance, 
  fetchCampaignAnalytics, 
  listCampaigns,
  fetchCustomerAnalytics,
  fetchRevenueTrend,
  fetchCampaignsSummary
} from '../services/api';
import type { CampaignAnalytics } from '../services/api';
import StatCard from '../components/StatCard';
import { PremiumGlassCard } from '../components/PremiumGlassCard';
import {
  formatCompactCurrency,
  formatIndianCurrency,
  formatFullNumber,
  formatPercent,
  getTopCity,
  getBestChannel,
} from '../services/formatters';
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer 
} from 'recharts';


export const Analytics: React.FC = () => {
  // Sync Timestamp states
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // General metrics
  const { data: dashboard, refetch: refetchDashboard } = useApi(fetchDashboardMetrics);
  const { data: channels, refetch: refetchChannels } = useApi(fetchChannelPerformance);
  const { data: campaigns, loading: loadingCampaigns, refetch: refetchCampaigns } = useApi(listCampaigns);
  const { data: customerData, refetch: refetchCustomers } = useApi(fetchCustomerAnalytics);
  const { data: revenueTrend, refetch: refetchRevenueTrend } = useApi(fetchRevenueTrend);
  const { data: campaignsSummary, refetch: refetchSummary } = useApi(fetchCampaignsSummary);

  // Active campaign selector
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [campaignAnalytics, setCampaignAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loadingCampMetrics, setLoadingCampMetrics] = useState(false);
  const [campMetricsError, setCampMetricsError] = useState<string | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);


  // Filter campaigns that have been launched (RUNNING, COMPLETED, CANCELLED, FAILED) (Memoized)
  const launchedCampaigns = useMemo(() => {
    return campaigns ? campaigns.filter(c => c.status !== 'DRAFT') : [];
  }, [campaigns]);

  useEffect(() => {
    if (launchedCampaigns.length > 0 && !selectedCampaignId) {
      const preferred = launchedCampaigns.find(c => c.status === 'RUNNING' || c.status === 'COMPLETED')
        || launchedCampaigns[0];
      setSelectedCampaignId(preferred.id);
    }
  }, [launchedCampaigns, selectedCampaignId]);

  // Load single campaign metrics on selection
  useEffect(() => {
    if (!selectedCampaignId) return;

    const loadMetrics = async () => {
      setLoadingCampMetrics(true);
      setCampMetricsError(null);
      try {
        const res = await fetchCampaignAnalytics(selectedCampaignId);
        setCampaignAnalytics(res);
      } catch (err: any) {
        setCampMetricsError(err.message || 'Failed to load campaign analytics');
      } finally {
        setLoadingCampMetrics(false);
      }
    };

    loadMetrics();
  }, [selectedCampaignId]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchDashboard(),
        refetchChannels(),
        refetchCampaigns(),
        refetchCustomers(),
        refetchRevenueTrend(),
        refetchSummary()
      ]);
      if (selectedCampaignId) {
        const res = await fetchCampaignAnalytics(selectedCampaignId);
        setCampaignAnalytics(res);
      }
      setLastSyncedTime(new Date());
    } catch (err) {
      console.error('Failed to refresh analytics', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchDashboard, refetchChannels, refetchCampaigns, refetchCustomers, refetchRevenueTrend, refetchSummary, selectedCampaignId]);

  // Channel percentages calculations for Donut Chart (Memoized)
  const defaultChannels = useMemo(() => [
    { channel: 'WHATSAPP', label: 'WhatsApp', color: '#10B981', order: 0 },
    { channel: 'EMAIL', label: 'Email', color: '#7C5CFF', order: 1 },
    { channel: 'SMS', label: 'SMS', color: '#4F8CFF', order: 2 },
    { channel: 'RCS', label: 'RCS', color: '#22D3EE', order: 3 }
  ], []);

  const mergedChannels = useMemo(() => {
    const channelDataList = channels || [];
    return defaultChannels.map(def => {
      const match = channelDataList.find(c => c.channel.toUpperCase() === def.channel);
      return {
        ...def,
        sent: match ? match.sent : 0,
        delivered: match ? match.delivered : 0,
        opened: match ? match.opened : 0,
        read: match ? match.read : 0,
        clicked: match ? match.clicked : 0
      };
    });
  }, [channels, defaultChannels]);

  const totalSent = useMemo(() => mergedChannels.reduce((acc, curr) => acc + curr.sent, 0), [mergedChannels]);

  // Pie chart segments calculation (Memoized)
  const donutSlicesData = useMemo(() => {
    return mergedChannels.map(ch => {
      const percentage = totalSent > 0 ? (ch.sent / totalSent) * 100 : 0;
      return {
        name: ch.label,
        rawChannel: ch.channel,
        value: ch.sent,
        percentage,
        color: ch.color
      };
    });
  }, [mergedChannels, totalSent]);

  // Calculate dynamic Sparklines based on actual API data (Memoized)
  const revenueTrendData = useMemo(() => revenueTrend || [], [revenueTrend]);
  const maxRevenueTrend = useMemo(() => {
    return Math.max(...revenueTrendData.map(t => t.revenue), 1);
  }, [revenueTrendData]);

  const revenueSparkline = useMemo(() => {
    return revenueTrendData.length > 0
      ? revenueTrendData.map(t => Number((t.revenue / 100000).toFixed(1)))
      : [dashboard?.totalRevenue ? dashboard.totalRevenue / 100000 : 0];
  }, [revenueTrendData, dashboard]);

  // Calculate dynamic growth percentage (Memoized)
  const growthPercentage = useMemo(() => {
    if (revenueTrendData.length >= 2) {
      const lastRev = revenueTrendData[revenueTrendData.length - 1].revenue;
      const prevRev = revenueTrendData[revenueTrendData.length - 2].revenue;
      return prevRev > 0 ? ((lastRev - prevRev) / prevRev) * 100 : 0;
    }
    return 0;
  }, [revenueTrendData]);

  const latestMonthRevenue = useMemo(() => {
    return revenueTrendData.length > 0 
      ? revenueTrendData[revenueTrendData.length - 1].revenue 
      : 0;
  }, [revenueTrendData]);

  // Active Campaign Conversions Bar Chart data (Memoized)
  const barChartData = useMemo(() => {
    if (!campaignAnalytics) {
      return [
        { name: 'Audience', count: 0, color: '#4F8CFF' },
        { name: 'Delivered', count: 0, color: '#22D3EE' },
        { name: 'Opened', count: 0, color: '#10B981' },
        { name: 'Clicked', count: 0, color: '#F59E0B' }
      ];
    }
    return [
      { name: 'Audience', count: campaignAnalytics.audienceSize, color: '#4F8CFF' },
      { name: 'Delivered', count: campaignAnalytics.delivered, color: '#22D3EE' },
      { name: 'Opened', count: campaignAnalytics.read || campaignAnalytics.opened, color: '#10B981' },
      { name: 'Clicked', count: campaignAnalytics.clicked, color: '#F59E0B' }
    ];
  }, [campaignAnalytics]);

  // Funnel calculations (Memoized)
  const funnelData = useMemo(() => {
    const totalSentFunnel = channels?.reduce((acc, c) => acc + c.sent, 0) || 0;
    const totalDeliveredFunnel = channels?.reduce((acc, c) => acc + c.delivered, 0) || 0;
    const totalOpenedFunnel = channels?.reduce((acc, c) => acc + (c.read || c.opened), 0) || 0;
    const totalClickedFunnel = channels?.reduce((acc, c) => acc + c.clicked, 0) || 0;

    const overallDeliveryRate = totalSentFunnel > 0 ? (totalDeliveredFunnel / totalSentFunnel) * 100 : 0;
    const overallOpenRate = totalDeliveredFunnel > 0 ? (totalOpenedFunnel / totalDeliveredFunnel) * 100 : 0;
    const overallCtr = totalDeliveredFunnel > 0 ? (totalClickedFunnel / totalDeliveredFunnel) * 100 : 0;

    return campaignAnalytics ? {
      sent: campaignAnalytics.sent,
      delivered: campaignAnalytics.delivered,
      opened: campaignAnalytics.read || campaignAnalytics.opened,
      clicked: campaignAnalytics.clicked,
      deliveryRate: campaignAnalytics.deliveryRate,
      openRate: campaignAnalytics.readRate || campaignAnalytics.openRate,
      ctr: campaignAnalytics.ctr
    } : {
      sent: totalSentFunnel,
      delivered: totalDeliveredFunnel,
      opened: totalOpenedFunnel,
      clicked: totalClickedFunnel,
      deliveryRate: overallDeliveryRate,
      openRate: overallOpenRate,
      ctr: overallCtr
    };
  }, [campaignAnalytics, channels]);

  const totalRevenueVal = useMemo(() => dashboard?.totalRevenue || 0, [dashboard]);
  const totalOrdersVal = useMemo(() => dashboard?.totalOrders || 0, [dashboard]);
  const averageSpendVal = useMemo(() => {
    return totalOrdersVal > 0 ? Math.round(totalRevenueVal / totalOrdersVal) : 0;
  }, [totalRevenueVal, totalOrdersVal]);

  // ROI summary items (Memoized)
  const campaignAudienceSize = campaignAnalytics ? campaignAnalytics.audienceSize : 0;
  const campaignSent = campaignAnalytics ? campaignAnalytics.sent : 0;
  const campaignRevenue = campaignAnalytics ? campaignAnalytics.campaignRevenue : 0;
  const campaignClicked = campaignAnalytics ? campaignAnalytics.clicked : 0;
  const campaignDeliveryRate = campaignAnalytics ? campaignAnalytics.deliveryRate : 0;
  const campaignOpenRate = campaignAnalytics ? (campaignAnalytics.readRate || campaignAnalytics.openRate) : 0;
  const campaignCtr = campaignAnalytics ? campaignAnalytics.ctr : 0;
  
  const campaignConversionRate = useMemo(() => {
    return campaignSent > 0 ? (campaignClicked / campaignSent) * 100 : 0;
  }, [campaignSent, campaignClicked]);

  const campaignRevenuePerRecipient = useMemo(() => {
    return campaignAudienceSize > 0 ? (campaignRevenue / campaignAudienceSize) : 0;
  }, [campaignAudienceSize, campaignRevenue]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '12px 24px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
      
      {/* Analytics Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-elevated)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 24px', backdropFilter: 'blur(10px)' }}>
        <div>
          <h2 className="text-subheading font-bold" style={{ margin: 0, fontSize: '20px', letterSpacing: '-0.3px' }}>Analytics</h2>
          <p className="text-muted" style={{ fontSize: '12px', marginTop: '4px', margin: 0, opacity: 0.85 }}>
            Real-time campaign attribution, customer intelligence, revenue insights, and communication performance powered by live customer data.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>Last Synced</span>
            <span>{lastSyncedTime.toLocaleTimeString()}</span>
          </div>
          <button 
            type="button"
            className="btn btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={handleRefreshAll}
            disabled={isRefreshing}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none', transition: 'transform 0.2s' }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* 1. KPI Metric Row — all values from live API */}
      <div className="analytics-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
        <StatCard
          label="Total Revenue"
          value={formatCompactCurrency(totalRevenueVal)}
          sparkline={revenueSparkline}
          className="kpi-accent-green"
          trendText={formatIndianCurrency(totalRevenueVal)}
          trend="Total"
        />
        <StatCard
          label="Total Customers"
          value={formatFullNumber(dashboard?.totalCustomers || 0)}
          sparkline={revenueTrendData.length > 0 ? revenueTrendData.map(t => t.revenue / maxRevenueTrend * (dashboard?.totalCustomers || 1)) : [dashboard?.totalCustomers || 0]}
          className="kpi-accent-blue"
          trendText="Verified customer profiles"
          trend="Active"
        />
        <StatCard
          label="Attributed Orders"
          value={formatFullNumber(totalOrdersVal)}
          sparkline={revenueTrendData.length > 0 ? revenueTrendData.map(t => t.revenue / maxRevenueTrend * totalOrdersVal) : [totalOrdersVal]}
          className="kpi-accent-purple"
          trendText="Successful checkouts"
          trend="Conversions"
        />
        <StatCard
          label="Total Campaigns"
          value={formatFullNumber(dashboard?.totalCampaigns || 0)}
          sparkline={[Math.max(1, (dashboard?.totalCampaigns || 1) - 2), dashboard?.totalCampaigns || 0]}
          className="kpi-accent-orange"
          trendText="Live messaging runs"
          trend="Outbox"
        />
        <StatCard
          label="Top City"
          value={getTopCity(customerData?.cityDistribution || [])}
          sparkline={(customerData?.cityDistribution || []).slice(0, 6).map(c => c.count)}
          className="kpi-accent-cyan"
          trendText="Highest customer count"
          trend="City"
        />
        <StatCard
          label="Average Spend"
          value={formatIndianCurrency(averageSpendVal)}
          sparkline={revenueTrendData.length > 0 ? revenueTrendData.map(t => t.revenue / Math.max(totalOrdersVal, 1)) : [averageSpendVal]}
          className="kpi-accent-indigo"
          trendText={formatCompactCurrency(totalRevenueVal)}
          trend="Basket"
        />
      </div>

      {/* 2. Visual Charts (2x2 Grid Layout) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
        
        {/* Interactive Revenue Trend Line Graph (Recharts) */}
        <PremiumGlassCard className="card animate-chart-fade" style={{ display: 'flex', flexDirection: 'column', minHeight: '260px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h4 className="text-subheading font-semibold" style={{ margin: 0, fontSize: '15px' }}>Revenue Trend Timeline</h4>
              <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px', margin: 0 }}>Cash aggregates over dynamic historical months.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatCompactCurrency(latestMonthRevenue)}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: growthPercentage >= 0 ? '#10B981' : '#EF4444',
                  background: growthPercentage >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  {growthPercentage >= 0 ? '+' : ''}{growthPercentage.toFixed(1)}%
                </span>
                <span className="text-muted" style={{ fontSize: '10px' }}>Last 6 Months</span>
              </div>
            </div>
          </div>
          <div style={{ flexGrow: 1, height: 160, width: '100%' }}>
            {revenueTrendData.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '12px', textAlign: 'center', padding: '40px 0' }}>No revenue trend data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsRevenueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#4F8CFF" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                    formatter={(v: any) => [formatIndianCurrency(v), 'Revenue']}
                    labelStyle={{ color: '#64748B', fontSize: '10px', fontWeight: 600 }}
                    contentStyle={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#F1F5F9', fontSize: '12px', fontWeight: 700 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="url(#analyticsLineColor)" 
                    strokeWidth={3}
                    fill="url(#analyticsRevenueGrad)" 
                    activeDot={{ r: 6, strokeWidth: 1.5, stroke: '#FFF' }}
                  />
                  <defs>
                    <linearGradient id="analyticsLineColor" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#4F8CFF" />
                      <stop offset="100%" stopColor="#7C5CFF" />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </PremiumGlassCard>

        {/* Interactive Active Campaign Conversions Bar Chart (Recharts) */}
        <PremiumGlassCard className="card animate-chart-fade" style={{ display: 'flex', flexDirection: 'column', minHeight: '260px', padding: '24px' }}>
          <div>
            <h4 className="text-subheading font-semibold" style={{ margin: 0, fontSize: '15px' }}>Active Campaign Conversions</h4>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px', margin: 0 }}>Total client reach and dropoff counts of selected campaign.</p>
          </div>
          <div style={{ flexGrow: 1, height: 160, width: '100%', marginTop: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: any) => [v.toLocaleString(), 'Users']}
                  contentStyle={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#F1F5F9', fontSize: '11px' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PremiumGlassCard>

        {/* Interactive Communications Split Pie/Donut Chart (Recharts) */}
        <PremiumGlassCard className="card animate-chart-fade" style={{ display: 'flex', flexDirection: 'column', minHeight: '260px', padding: '24px' }}>
          <div>
            <h4 className="text-subheading font-semibold" style={{ margin: 0, fontSize: '15px' }}>Communications Split</h4>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px', margin: 0 }}>Channel share of total dispatched marketing communications.</p>
          </div>
          <div style={{ flexGrow: 1, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'center', marginTop: '10px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutSlicesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                    onMouseEnter={(_, index) => setHoveredSlice(index)}
                    onMouseLeave={() => setHoveredSlice(null)}
                  >
                    {donutSlicesData.map((entry, index) => {
                      const isHovered = hoveredSlice === index;
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color} 
                          style={{
                            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                            transformOrigin: 'center',
                            transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
                            filter: isHovered ? `drop-shadow(0 0 8px ${entry.color}60)` : 'none',
                            cursor: 'pointer'
                          }}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any, name: any, props: any) => [`${value.toLocaleString()} messages (${props.payload.percentage.toFixed(1)}%)`, name]}
                    contentStyle={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px' }}
                    itemStyle={{ color: '#F1F5F9', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 10
              }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>Total Sent</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px', letterSpacing: '-0.5px' }}>
                  {totalSent.toLocaleString()}
                </span>
              </div>
            </div>
            
            {/* Vertical Legends */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {donutSlicesData.map((slice, i) => {
                const isHovered = hoveredSlice === i;
                return (
                  <div 
                    key={i} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '4px 6px', 
                      borderRadius: '8px', 
                      opacity: hoveredSlice !== null && !isHovered ? 0.45 : 1,
                      transition: 'opacity 200ms ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: slice.color }}></span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)', fontWeight: isHovered ? 700 : 500 }}>{slice.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="font-bold">{slice.percentage.toFixed(0)}%</span>
                        <span className="text-muted" style={{ fontSize: '10.5px' }}>({slice.value.toLocaleString()})</span>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${slice.percentage}%`, height: '100%', background: slice.color, borderRadius: '2px', transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PremiumGlassCard>
        
        {/* Conversion Funnel (Progress Cards) */}
        <PremiumGlassCard className="card animate-chart-fade" style={{ display: 'flex', flexDirection: 'column', minHeight: '260px', padding: '24px' }}>
          <div>
            <h4 className="text-subheading font-semibold" style={{ margin: 0, fontSize: '15px' }}>Standard Conversion Funnel</h4>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px', margin: 0 }}>Dropoff flow rates calculated across campaigns.</p>
          </div>
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', marginTop: '16px' }}>
            
            {/* Stage 1: Dispatched */}
            <div className="funnel-card" style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 200ms ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(79, 124, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F8CFF', fontWeight: 700, fontSize: '13px' }}>1</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9' }}>Dispatched</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Total outbound messages sent</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#F1F5F9' }}>{funnelData.sent.toLocaleString()}</div>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>100% BASE</div>
              </div>
            </div>

            {/* Transition 1 -> 2 */}
            <div style={{ display: 'flex', justifySelf: 'center', alignSelf: 'center', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
              <div style={{ width: '1px', height: '16px', borderLeft: '1px dashed rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 600, background: 'rgba(16,185,129,0.08)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.15)' }}>
                {funnelData.deliveryRate.toFixed(1)}% Delivery
              </span>
              <div style={{ width: '1px', height: '16px', borderLeft: '1px dashed rgba(255,255,255,0.2)' }} />
            </div>

            {/* Stage 2: Delivered */}
            <div className="funnel-card" style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 200ms ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(34, 211, 238, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22D3EE', fontWeight: 700, fontSize: '13px' }}>2</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9' }}>Delivered</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Successfully received by devices</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#F1F5F9' }}>{funnelData.delivered.toLocaleString()}</div>
                <div style={{ fontSize: '10px', color: '#22D3EE', fontWeight: 600 }}>{funnelData.deliveryRate.toFixed(1)}% RATE</div>
              </div>
            </div>

            {/* Transition 2 -> 3 */}
            <div style={{ display: 'flex', justifySelf: 'center', alignSelf: 'center', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
              <div style={{ width: '1px', height: '16px', borderLeft: '1px dashed rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: '10px', color: '#4F8CFF', fontWeight: 600, background: 'rgba(79,140,255,0.08)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(79,140,255,0.15)' }}>
                {funnelData.openRate.toFixed(1)}% Open / Read
              </span>
              <div style={{ width: '1px', height: '16px', borderLeft: '1px dashed rgba(255,255,255,0.2)' }} />
            </div>

            {/* Stage 3: Opened */}
            <div className="funnel-card" style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 200ms ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6', fontWeight: 700, fontSize: '13px' }}>3</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9' }}>Opened / Read</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Viewed or read by recipients</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#F1F5F9' }}>{funnelData.opened.toLocaleString()}</div>
                <div style={{ fontSize: '10px', color: '#8B5CF6', fontWeight: 600 }}>{funnelData.openRate.toFixed(1)}% RATE</div>
              </div>
            </div>

            {/* Transition 3 -> 4 */}
            <div style={{ display: 'flex', justifySelf: 'center', alignSelf: 'center', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
              <div style={{ width: '1px', height: '16px', borderLeft: '1px dashed rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 600, background: 'rgba(245,158,11,0.08)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.15)' }}>
                {funnelData.ctr.toFixed(1)}% Click CTR
              </span>
              <div style={{ width: '1px', height: '16px', borderLeft: '1px dashed rgba(255,255,255,0.2)' }} />
            </div>

            {/* Stage 4: Clicked */}
            <div className="funnel-card" style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 200ms ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B', fontWeight: 700, fontSize: '13px' }}>4</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9' }}>Clicked Actions</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Recipients who clicked a call-to-action</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#F1F5F9' }}>{funnelData.clicked.toLocaleString()}</div>
                <div style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 600 }}>{funnelData.ctr.toFixed(1)}% RATE</div>
              </div>
            </div>

          </div>
        </PremiumGlassCard>

      </div>

      {/* 3. Attributable ROI Calculator for Single Campaign */}
      <div className="card" style={{ padding: '24px' }}>
        <div className="flex-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="text-subheading font-semibold" style={{ margin: 0, fontSize: '15px' }}>Attributable Campaign ROI</h3>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px', margin: 0 }}>
              Select a launched campaign to audit checkout conversions and message performance details.
            </p>
          </div>
          
          {loadingCampaigns ? (
            <span className="text-body text-muted">Loading...</span>
          ) : launchedCampaigns.length === 0 ? (
            <span className="text-body text-danger">No campaigns launched.</span>
          ) : (
            <select
              className="playground-input"
              style={{ width: '260px', marginBottom: 0, borderRadius: '8px' }}
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              {launchedCampaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.channel})</option>
              ))}
            </select>
          )}
        </div>

        {loadingCampMetrics && <p className="text-body text-muted">Loading metrics...</p>}
        {campMetricsError && <p className="text-body text-danger">{campMetricsError}</p>}

        {campaignAnalytics && !loadingCampMetrics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* ROI Top Row: Equal Width Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div className="card surface-level-3" style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                <span className="text-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Revenue Attributed</span>
                <span className="font-semibold" style={{ display: 'block', fontSize: '20px', color: '#10B981', marginTop: '4px', fontWeight: 700 }}>
                  {formatCompactCurrency(campaignAnalytics.campaignRevenue)}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748B', marginTop: 2 }}>
                  {formatIndianCurrency(campaignAnalytics.campaignRevenue)}
                </span>
              </div>
              <div className="card surface-level-3" style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                <span className="text-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Attributed ROI</span>
                <span className="font-semibold" style={{ display: 'block', fontSize: '20px', color: '#3B82F6', marginTop: '4px', fontWeight: 700 }}>
                  {campaignAnalytics.campaignRoi.toFixed(1)} %
                </span>
              </div>
              <div className="card surface-level-3" style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                <span className="text-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Campaign Cost</span>
                <span className="font-semibold" style={{ display: 'block', fontSize: '20px', marginTop: '4px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatCompactCurrency(campaignAnalytics.campaignCost)}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748B', marginTop: 2 }}>
                  {formatIndianCurrency(campaignAnalytics.campaignCost)}
                </span>
              </div>
              <div className="card surface-level-3" style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                <span className="text-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Audience Size</span>
                <span className="font-semibold" style={{ display: 'block', fontSize: '20px', marginTop: '4px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {campaignAnalytics.audienceSize.toLocaleString()}
                </span>
              </div>
            </div>

            {/* ROI Bottom Row: Performance Metrics */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
              <span className="text-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '12px', fontWeight: 600 }}>
                Performance Metrics Summary
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.005)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ display: 'block', fontSize: '8.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Delivery Rate</span>
                  <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#10B981', marginTop: '2px' }}>{campaignDeliveryRate.toFixed(1)}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.005)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ display: 'block', fontSize: '8.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Open/Read Rate</span>
                  <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#3B82F6', marginTop: '2px' }}>{campaignOpenRate.toFixed(1)}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.005)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ display: 'block', fontSize: '8.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>CTR Click Rate</span>
                  <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#06B6D4', marginTop: '2px' }}>{campaignCtr.toFixed(1)}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.005)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ display: 'block', fontSize: '8.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Conversion Rate</span>
                  <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#8B5CF6', marginTop: '2px' }}>{campaignConversionRate.toFixed(1)}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.005)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ display: 'block', fontSize: '8.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Rev Per Recipient</span>
                  <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{formatIndianCurrency(campaignRevenuePerRecipient)}</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* 4. CRM Intelligence Insights Section */}
      <div>
        <h3 className="text-subheading font-semibold" style={{ marginBottom: '12px', fontSize: '15px' }}>Marketing Intelligence Insights</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {/* Insight items (Memoized computation inside render) */}
          {(() => {
            const bestCamp = campaignsSummary && campaignsSummary.length > 0
              ? campaignsSummary.reduce((b, c) => c.revenue > b.revenue ? c : b, campaignsSummary[0])
              : null;
            const bestCampCh = campaignsSummary && campaignsSummary.length > 0
              ? [...(campaignsSummary as any[])].sort((a, b) => (b.clicked / Math.max(b.sent,1)) - (a.clicked / Math.max(a.sent,1)))[0]
              : null;
            const lowestCamp = campaignsSummary && campaignsSummary.length > 0
              ? campaignsSummary.reduce((b, c) => c.revenue < b.revenue ? c : b, campaignsSummary[0])
              : null;
            const chs = channels || [];
            const liveSent = chs.reduce((s,c)=>s+c.sent,0);
            const liveDelivered = chs.reduce((s,c)=>s+c.delivered,0);
            const liveRead = chs.reduce((s,c)=>s+(c.read || c.opened || 0),0);
            
            const liveDeliveryRate = liveSent > 0 ? (liveDelivered / liveSent) * 100 : 0;
            const liveReadRate = liveDelivered > 0 ? (liveRead / liveDelivered) * 100 : 0;
            const bestChFromApi = getBestChannel(chs.map(c => ({ channel: c.channel, ctr: c.ctr })));
            return (
              <>
                <div className="card surface-level-3" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
                  <span className="text-label" style={{ fontSize: '9px', textTransform: 'uppercase', color: '#10B981', fontWeight: 700 }}>Best Campaign</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {bestCamp ? bestCamp.name : '—'}
                  </span>
                  <p className="text-muted" style={{ fontSize: '11.5px', lineHeight: 1.4, margin: 0, opacity: 0.8 }}>
                    {bestCamp ? `${formatCompactCurrency(bestCamp.revenue)} attributed revenue · ${formatFullNumber(bestCamp.audienceSize)} audience` : 'No campaigns with revenue data yet.'}
                  </p>
                </div>
                <div className="card surface-level-3" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
                  <span className="text-label" style={{ fontSize: '9px', textTransform: 'uppercase', color: '#3B82F6', fontWeight: 700 }}>Best Channel</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{bestChFromApi || '—'}</span>
                  <p className="text-muted" style={{ fontSize: '11.5px', lineHeight: 1.4, margin: 0, opacity: 0.8 }}>
                    {liveReadRate > 0 ? `${formatPercent(liveReadRate)} read rate · ${formatPercent(liveDeliveryRate)} delivery` : 'Channel performance calculated from all sent messages.'}
                  </p>
                </div>
                <div className="card surface-level-3" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
                  <span className="text-label" style={{ fontSize: '9px', textTransform: 'uppercase', color: '#06B6D4', fontWeight: 700 }}>Highest CTR</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {bestCampCh ? bestCampCh.name : '—'}
                  </span>
                  <p className="text-muted" style={{ fontSize: '11.5px', lineHeight: 1.4, margin: 0, opacity: 0.8 }}>
                    {bestCampCh && bestCampCh.sent > 0 ? `${formatPercent((bestCampCh.clicked / bestCampCh.sent) * 100)} CTR · ${formatFullNumber(bestCampCh.sent)} sent` : 'Calculated from actual message delivery data.'}
                  </p>
                </div>
                <div className="card surface-level-3" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
                  <span className="text-label" style={{ fontSize: '9px', textTransform: 'uppercase', color: '#EF4444', fontWeight: 700 }}>Lowest Revenue</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {lowestCamp ? lowestCamp.name : '—'}
                  </span>
                  <p className="text-muted" style={{ fontSize: '11.5px', lineHeight: 1.4, margin: 0, opacity: 0.8 }}>
                    {lowestCamp ? `${formatCompactCurrency(lowestCamp.revenue)} revenue · ${formatFullNumber(lowestCamp.audienceSize)} audience` : 'No campaign data available yet.'}
                  </p>
                </div>
              </>
            );
          })()}
        </div>
      </div>

    </div>
  );
};

export default Analytics;
