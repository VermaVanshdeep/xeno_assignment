import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchDashboardMetrics,
  fetchCustomerAnalytics,
  fetchChannelPerformance,
  fetchRevenueTrend,
  fetchCampaignsSummary,
} from '../services/api';
import {
  formatCompactCurrency,
  formatIndianCurrency,
  formatFullNumber,
  formatCompactNumber,
  formatPercent,
  getTopCity,
  getBestChannel,
} from '../services/formatters';
import PortalTooltip from '../components/PortalTooltip';

/* ─────────────────────── WORKSPACES ─────────────────────── */
const WORKSPACES = [
  { id: 'Xeno Production', label: 'Production', desc: 'Live Environment',    color: '#10B981' },
  { id: 'Xeno Staging',    label: 'Staging',    desc: 'Testing Environment', color: '#F59E0B' },
  { id: 'Xeno Demo',       label: 'Demo',       desc: 'Sandbox Environment', color: '#8B5CF6' },
];

/* ─────────────────────── WORKSPACE DROPDOWN ─────────────────────── */
const WsDropdown: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = WORKSPACES.find(w => w.id === value) || WORKSPACES[0];

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-haspopup="listbox" aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: open ? 'rgba(79,140,255,0.06)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(79,140,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 12, padding: '13px 16px', color: '#F1F5F9', cursor: 'pointer',
          transition: 'all 250ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: sel.color, boxShadow: `0 0 8px ${sel.color}80`, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: '14px', flex: 1, textAlign: 'left' }}>{sel.label}</span>
        <span style={{ fontSize: '12px', color: '#64748B', marginRight: 6 }}>{sel.desc}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 250ms', color: '#64748B', flexShrink: 0 }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 200,
          background: 'rgba(8,14,28,0.98)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 14, padding: 6, backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}>
          {WORKSPACES.map(ws => (
            <div key={ws.id} role="option" aria-selected={value === ws.id}
              onClick={() => { onChange(ws.id); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderRadius: 10, cursor: 'pointer',
                background: value === ws.id ? 'rgba(79,140,255,0.08)' : 'transparent',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => { if (value !== ws.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = value === ws.id ? 'rgba(79,140,255,0.08)' : 'transparent'; }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ws.color, boxShadow: `0 0 8px ${ws.color}60`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>{ws.label}</div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: 1 }}>{ws.desc}</div>
              </div>
              {value === ws.id && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────── SPINNER ─────────────────────── */
const Spinner = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ animation: 'lxSpin 0.75s linear infinite', flexShrink: 0 }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

/* ─────────────────────── LIVE DATA HOOK ─────────────────────── */
interface HeroMetrics {
  totalCustomers: number;
  totalRevenue:   number;
  totalOrders:    number;
  totalCampaigns: number;
  cityDistribution: { city: string; count: number }[];
  channels: { channel: string; ctr: number; readRate: number; openRate: number; deliveryRate: number }[];
  revenueTrend: { month: string; revenue: number }[];
  campaignsSummary: { id: string; name: string; revenue: number; audienceSize: number }[];
}

function useHeroMetrics() {
  const [data, setData]       = useState<HeroMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchDashboardMetrics().catch(() => null),
      fetchCustomerAnalytics().catch(() => null),
      fetchChannelPerformance().catch(() => []),
      fetchRevenueTrend().catch(() => []),
      fetchCampaignsSummary().catch(() => []),
    ]).then(([metrics, customers, channels, trend, summary]) => {
      if (cancelled) return;
      setData({
        totalCustomers:   metrics?.totalCustomers  ?? 0,
        totalRevenue:     metrics?.totalRevenue    ?? 0,
        totalOrders:      metrics?.totalOrders     ?? 0,
        totalCampaigns:   metrics?.totalCampaigns  ?? 0,
        cityDistribution: customers?.cityDistribution ?? [],
        channels:         (channels as any[]) ?? [],
        revenueTrend:     (trend as any[]) ?? [],
        campaignsSummary: (summary as any[]) ?? [],
      });
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}

/* ─────────────────────── KPI CARD ─────────────────────── */
interface KpiCardData {
  label: string;
  primary: string;
  accentColor: string;
  sparkPath: string;
  growth: string;
  details: { label: string; value: string }[];
}

const KpiCard: React.FC<{ data: KpiCardData }> = ({ data }) => {
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const getAmbientGlow = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('revenue')) return 'rgba(16, 185, 129, 0.15)';
    if (l.includes('order')) return 'rgba(79, 124, 255, 0.15)';
    if (l.includes('customer')) return 'rgba(139, 92, 246, 0.15)';
    return 'rgba(245, 158, 11, 0.15)';
  };

  const glowColor = getAmbientGlow(data.label);

  return (
    <div 
      ref={cardRef}
      onMouseEnter={() => setHovered(true)} 
      onMouseLeave={() => setHovered(false)}
      style={{ 
        flex: 1, 
        minWidth: 0, 
        height: 110, 
        boxSizing: 'border-box',
        background: 'rgba(15, 23, 42, 0.55)', 
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)', 
        borderRadius: 18,
        padding: '16px 20px', 
        position: 'relative', 
        overflow: 'hidden',
        cursor: 'default',
        transform: hovered ? 'translateY(-3px) scale(1.01)' : 'translateY(0) scale(1)',
        boxShadow: hovered 
          ? `0 12px 40px rgba(0,0,0,0.45), 0 0 20px ${glowColor}` 
          : '0 12px 40px rgba(0,0,0,0.45)',
        transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease, border-color 200ms ease',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: data.accentColor, borderRadius: '18px 18px 0 0' }} />
      
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '26px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.8px', lineHeight: 1 }}>
          {data.primary}
        </div>
        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
          {data.label}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: data.accentColor }}>
          {data.growth}
        </div>
      </div>

      <div style={{ position: 'absolute', top: 16, right: 20, pointerEvents: 'none' }}>
        <svg width="60" height="20" viewBox="0 0 64 22" fill="none">
          <path d={data.sparkPath} stroke={data.accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.45"/>
        </svg>
      </div>

      <PortalTooltip active={hovered} targetRef={cardRef}>
        <div style={{ pointerEvents: 'none' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: data.accentColor, marginBottom: '6px' }}>{data.label} Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.details.map((d, i) => (
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
};

/* ─────────────────────── PIPELINE STAGE ─────────────────────── */
interface PipelineStageData {
  num: string;
  title: string;
  metric: string;
  color: string;
  desc: string;
  insights: { label: string; value: string }[];
}

const PipelineStage: React.FC<{ data: PipelineStageData }> = ({ data }) => {
  const [hovered, setHovered] = useState(false);

  const getIcon = (num: string, color: string) => {
    switch (num) {
      case '01':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
            <path d="M3 12A9 3 0 0 0 21 12"></path>
          </svg>
        );
      case '02':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
          </svg>
        );
      case '03':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        );
      case '04':
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
          </svg>
        );
    }
  };

  return (
    <div 
      onMouseEnter={() => setHovered(true)} 
      onMouseLeave={() => setHovered(false)}
      style={{ 
        flex: 1, 
        minWidth: 0, 
        height: 180, 
        position: 'relative',
        boxSizing: 'border-box',
        background: 'rgba(15, 23, 42, 0.55)', 
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: hovered ? `1px solid ${data.color}` : '1px solid rgba(255, 255, 255, 0.07)', 
        borderRadius: 16,
        padding: '18px 20px',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered 
          ? `0 12px 40px rgba(0,0,0,0.45), 0 0 16px ${data.color}30` 
          : '0 12px 40px rgba(0,0,0,0.45)',
        transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease, box-shadow 200ms ease',
        overflow: 'hidden',
      }}
    >
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        height: 3, 
        background: `linear-gradient(90deg, ${data.color}, ${data.color}80)`, 
        borderRadius: '16px 16px 0 0' 
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: data.color, letterSpacing: '0.06em' }}>STEP {data.num}</span>
        <div style={{ 
          transform: hovered ? 'scale(1.1) translateY(-1px)' : 'scale(1) translateY(0)',
          transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {getIcon(data.num, data.color)}
        </div>
      </div>

      <div style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', lineHeight: 1.25, marginBottom: 4 }}>
        {data.title}
      </div>

      <div style={{ fontSize: '13px', fontWeight: 600, color: data.color, marginBottom: 8 }}>
        {data.metric}
      </div>

      <div style={{ 
        fontSize: '11.5px', 
        color: '#64748B', 
        lineHeight: 1.45,
        display: '-webkit-box', 
        WebkitLineClamp: 2, 
        WebkitBoxOrient: 'vertical', 
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {data.desc}
      </div>
    </div>
  );
};

/* ─────────────────────── FEATURE CARDS ─────────────────────── */
const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Audience Segmentation',
    tagline: 'Build surgical customer cohorts with multi-condition rules',
    accent: '#3B82F6',
    capabilities: [
      'Filter by spend, city, orders, recency, and category',
      'AND / OR logic for complex segment combinations',
      'Live preview — see matched count before saving',
      'Segments auto-refresh as new orders arrive',
      'Export audience to any campaign instantly',
    ],
    outcome: 'Reach exactly the right customers — not everyone.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.886H3.894l4.984 3.615L6.966 18.39 12 14.773l5.034 3.616-1.912-5.889 4.984-3.615h-6.194L12 3Z"/>
      </svg>
    ),
    title: 'AI Campaign Generator',
    tagline: 'Generate campaigns, copy & rules from natural language',
    accent: '#8B5CF6',
    capabilities: [
      'Describe a goal — AI proposes segment rules automatically',
      'Generate WhatsApp copy, subject lines, and SMS in seconds',
      'Tone variations: festive, urgent, loyalty, win-back',
      'Preview generated content before deploying',
      'One-click apply to Segment Builder and Campaign flow',
    ],
    outcome: 'From idea to live campaign in under 3 minutes.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: 'Campaign Analytics',
    tagline: 'Executive-grade performance insights and revenue attribution',
    accent: '#10B981',
    capabilities: [
      'Full funnel: Dispatched → Delivered → Opened → Clicked → Converted',
      'Revenue attribution linked to campaign audience',
      'Channel breakdown with per-channel ROI',
      'Historical comparison across all past campaigns',
      'Identify highest-performing campaigns instantly',
    ],
    outcome: 'Know exactly which campaigns drive revenue.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    ),
    title: 'Multi-Channel Outreach',
    tagline: 'WhatsApp, Email, SMS, and RCS from one unified workflow',
    accent: '#F59E0B',
    capabilities: [
      'Launch across WhatsApp, Email, SMS, and RCS simultaneously',
      'Per-channel delivery tracking with read receipts',
      'Personalized variables: name, last order, spend tier',
      'AI recommends best channel per segment automatically',
      'Unified campaign history across all channels',
    ],
    outcome: 'Meet every customer on their preferred channel.',
  },
];

/* ─────────────────────── FEATURE CARD COMPONENT ─────────────────────── */
const FeatureCard: React.FC<{ data: typeof FEATURES[0] }> = ({ data }) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)} style={{
        background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
        padding: '20px 22px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 16,
        transition: 'border-color 250ms, background 250ms',
        borderColor: open ? `${data.accent}30` : 'rgba(255,255,255,0.08)',
      }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)'; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
      >
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          background: `${data.accent}12`, border: `1px solid ${data.accent}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: data.accent,
        }}>{data.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9' }}>{data.title}</div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: 2 }}>{data.tagline}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 280ms cubic-bezier(0.16,1,0.3,1)' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40,
        background: 'rgba(6,10,22,0.97)', backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: `1px solid ${data.accent}30`, borderRadius: 16,
        boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px ${data.accent}10`,
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(-2px)' : 'translateY(0)',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div onClick={() => setOpen(false)} style={{
          padding: '20px 22px', display: 'flex', alignItems: 'center',
          gap: 16, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14, flexShrink: 0,
            background: `${data.accent}18`, border: `1px solid ${data.accent}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: data.accent,
          }}>{data.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9' }}>{data.title}</div>
            <div style={{ fontSize: '13px', color: '#64748B', marginTop: 2 }}>{data.tagline}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5"
            style={{ flexShrink: 0, transform: 'rotate(180deg)' }}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
        <div style={{ padding: '16px 22px 22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
            {data.capabilities.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  background: `${data.accent}15`, border: `1px solid ${data.accent}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: data.accent, fontSize: '10px', fontWeight: 800,
                }}>✓</span>
                <span style={{ fontSize: '13.5px', color: 'rgba(241,245,249,0.82)', lineHeight: 1.5 }}>{c}</span>
              </div>
            ))}
          </div>
          <div style={{
            background: `${data.accent}08`, border: `1px solid ${data.accent}20`,
            borderRadius: 10, padding: '10px 14px',
            fontSize: '13px', color: data.accent, fontWeight: 600,
          }}>
            💡 {data.outcome}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── RIBBON PILLS ─────────────────────── */
const RIBBON_PILLS = [
  '🎯 Audience Segmentation', '🤖 AI Campaign Generator', '📊 Campaign Analytics',
  '💬 WhatsApp Marketing', '📧 Email Campaigns', '📱 SMS & RCS Outreach',
  '💡 Customer Intelligence', '📈 Revenue Attribution', '🔮 Predictive Audiences',
  '❤️ Customer Retention', '🕸️ Omnichannel Workflows', '✨ Generative AI Copywriting',
];

/* ════════════════════════════════════════════════════════════
   MAIN LOGIN COMPONENT
   ════════════════════════════════════════════════════════════ */
export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [workspace, setWorkspace]   = useState('Xeno Production');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [toast, setToast]           = useState<string | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [pwFocus, setPwFocus]       = useState(false);

  // Live hero metrics from backend
  const { data: heroData, loading: heroLoading } = useHeroMetrics();

  useEffect(() => { if (localStorage.getItem('xeno_auth')) navigate('/'); }, [navigate]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleSignIn = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email))  { setErrorMsg('Please enter a valid email address.'); return; }
    if (password.length < 6)   { setErrorMsg('Password must be at least 6 characters.'); return; }
    setIsLoading(true);
    setTimeout(() => {
      const name = email.split('@')[0].split(/[._-]/).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      localStorage.setItem('xeno_auth', 'true');
      localStorage.setItem('xeno_workspace', workspace);
      localStorage.setItem('xeno_user', JSON.stringify({ name: name || 'User', email, workspace, role: 'Workspace Admin' }));
      navigate('/');
    }, 1400);
  }, [email, password, workspace, navigate]);

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${focused ? 'rgba(79,140,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 12, padding: '13px 16px', fontSize: '14px', color: '#F1F5F9',
    outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
    boxShadow: focused ? '0 0 0 3px rgba(79,140,255,0.12)' : 'none',
    transition: 'border-color 250ms, box-shadow 250ms',
  });

  /* ── Derive all KPI card data from live heroData ── */
  const m = heroData;
  const totalRevenue   = m?.totalRevenue   ?? 0;
  const totalOrders    = m?.totalOrders    ?? 0;
  const totalCustomers = m?.totalCustomers ?? 0;
  const totalCampaigns = m?.totalCampaigns ?? 0;
  const cityDist       = m?.cityDistribution ?? [];
  const channels       = m?.channels ?? [];
  const revTrend       = m?.revenueTrend ?? [];
  const campaigns      = m?.campaignsSummary ?? [];

  const aov            = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const topCity        = getTopCity(cityDist);
  const bestChannel    = getBestChannel(channels);

  // Best channel read rate (highest readRate or openRate)
  const bestCh = channels.length > 0
    ? [...channels].sort((a, b) => (b.readRate || b.openRate || 0) - (a.readRate || a.openRate || 0))[0]
    : null;
  const bestChReadRate = bestCh ? formatPercent(bestCh.readRate || bestCh.openRate || 0) : '—';

  // Aggregate channel rates (weighted average across all channels)
  const totalSent = channels.reduce((s, c: any) => s + (c.sent ?? 0), 0);
  const totalDelivered = channels.reduce((s, c: any) => s + (c.delivered ?? 0), 0);
  const totalOpened    = channels.reduce((s, c: any) => s + (c.read ?? c.opened ?? 0), 0);
  const totalClicked   = channels.reduce((s, c: any) => s + (c.clicked ?? 0), 0);
  const overallDeliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  const overallOpenRate     = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
  const overallCtr          = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;

  // Revenue MoM growth from trend data
  const momGrowth = revTrend.length >= 2
    ? ((revTrend[revTrend.length - 1].revenue - revTrend[revTrend.length - 2].revenue) /
       Math.max(revTrend[revTrend.length - 2].revenue, 1)) * 100
    : null;
  const momLabel = momGrowth !== null
    ? `${momGrowth >= 0 ? '+' : ''}${momGrowth.toFixed(1)}% MoM`
    : 'Live';

  // Campaign ROI: (total campaign revenue - total campaign cost) / total campaign cost
  // Guard: if totalCampRevenue is 0 (no attribution data yet), show 0.0x not -1.0x
  const totalCampRevenue = campaigns.reduce((s, c) => s + (c.revenue ?? 0), 0);
  const totalCampCost    = campaigns.reduce((s, c) => s + ((c.audienceSize ?? 0) * 0.15), 0);
  const campaignRoi      = (totalCampCost > 0 && totalCampRevenue > 0)
    ? (totalCampRevenue - totalCampCost) / totalCampCost
    : 0;

  /* ── Build KPI_CARDS entirely from live data ── */
  const KPI_CARDS: KpiCardData[] = [
    {
      label: 'Customer Profiles', primary: formatFullNumber(totalCustomers),
      accentColor: '#3B82F6', sparkPath: 'M4 17 Q18 9, 32 13 T60 4',
      growth: 'Live',
      details: [
        { label: 'Full Count',       value: formatFullNumber(totalCustomers) },
        { label: 'Cities Covered',   value: formatFullNumber(cityDist.length) },
        { label: 'Top City',         value: topCity },
        { label: 'Avg. Orders/User', value: totalCustomers > 0 ? (totalOrders / totalCustomers).toFixed(1) : '—' },
      ],
    },
    {
      label: 'Revenue Influenced', primary: formatCompactCurrency(totalRevenue),
      accentColor: '#10B981', sparkPath: 'M4 19 Q18 13, 32 16 T60 5',
      growth: momLabel,
      details: [
        { label: 'Full Amount',      value: formatIndianCurrency(totalRevenue) },
        { label: 'Attributed Orders',value: formatFullNumber(totalOrders) },
        { label: 'Avg. Order Value', value: formatIndianCurrency(aov) },
        { label: 'Top City',         value: topCity },
      ],
    },
    {
      label: 'Open Rate', primary: totalSent > 0 ? formatPercent(overallOpenRate) : '—',
      accentColor: '#8B5CF6', sparkPath: 'M4 13 Q18 9, 32 11 T60 5',
      growth: totalSent > 0 ? 'Live' : 'Awaiting Data',
      details: [
        { label: 'Delivery Rate',   value: formatPercent(overallDeliveryRate) },
        { label: 'Click Rate',      value: formatPercent(overallCtr) },
        { label: 'Best Channel',    value: bestChannel },
        { label: 'Total Sent',      value: formatFullNumber(totalSent) },
      ],
    },
    {
      label: 'Campaign ROI', primary: `${campaignRoi.toFixed(1)}×`,
      accentColor: '#F59E0B', sparkPath: 'M4 16 Q16 6, 32 12 T60 3',
      growth: 'Live',
      details: [
        { label: 'Campaign Revenue', value: formatCompactCurrency(totalCampRevenue) },
        { label: 'Full Revenue',     value: formatIndianCurrency(totalCampRevenue) },
        { label: 'Best Channel',     value: bestChannel },
        { label: 'Read Rate',        value: bestChReadRate },
      ],
    },
  ];

  /* ── Build PIPELINE_STAGES from live data ── */
  const PIPELINE_STAGES: PipelineStageData[] = [
    {
      num: '01', title: 'Customer Data',
      metric: `${formatCompactNumber(totalCustomers)} Profiles`,
      color: '#3B82F6',
      desc: 'Unified customer records with full order history, spend behaviour, and city distribution.',
      insights: [
        { label: 'Cities',       value: formatFullNumber(cityDist.length) },
        { label: 'Total Orders', value: formatFullNumber(totalOrders) },
        { label: 'Revenue',      value: formatCompactCurrency(totalRevenue) },
        { label: 'Freshness',    value: 'Live' },
      ],
    },
    {
      num: '02', title: 'AI Segmentation',
      metric: 'Rule-Based Cohorts',
      color: '#10B981',
      desc: 'Build high-intent audiences using spend, city, orders, recency, and category filters with AND/OR logic.',
      insights: [
        { label: 'Avg. AOV',   value: formatIndianCurrency(aov) },
        { label: 'Rule Types', value: 'AND / OR' },
        { label: 'Top City',   value: topCity },
        { label: 'Refresh',    value: 'Real-time' },
      ],
    },
    {
      num: '03', title: 'Channel Selection',
      metric: `${bestChannel || 'AI'} Optimal`,
      color: '#8B5CF6',
      desc: 'AI recommends the best-performing channel per user segment based on historical engagement rates.',
      insights: [
        { label: 'Open Rate',     value: formatPercent(overallOpenRate) },
        { label: 'Click Rate',    value: formatPercent(overallCtr) },
        { label: 'Delivery Rate', value: formatPercent(overallDeliveryRate) },
        { label: 'Channels',      value: '4' },
      ],
    },
    {
      num: '04', title: 'Campaign Launch',
      metric: `${formatFullNumber(totalCampaigns)} Campaigns`,
      color: '#F59E0B',
      desc: 'One-click deployment with real-time delivery tracking and direct revenue attribution per campaign.',
      insights: [
        { label: 'ROI',           value: `${campaignRoi.toFixed(1)}×` },
        { label: 'Total Revenue', value: formatCompactCurrency(totalRevenue) },
        { label: 'Launch Time',   value: '< 2 min' },
        { label: 'Channels',      value: '4' },
      ],
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#050912', color: '#F1F5F9', overflowX: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>

      <style>{`
        @keyframes lxSpin   { to { transform: rotate(360deg); } }
        @keyframes lxPulse  { 0%,100% { opacity:0.5; transform:scale(0.9); } 50% { opacity:1; transform:scale(1); } }
        @keyframes lxMarq   { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }
        @keyframes lxFadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes gradShift { 0%,100%{ background-position:0% 50%; } 50%{ background-position:100% 50%; } }
        .lx-ribbon-track { animation: lxMarq 38s linear infinite; }
        .lx-ribbon-track:hover { animation-play-state: paused; }
        .lx-pill:hover {
          background: linear-gradient(135deg, rgba(79, 124, 255, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%) !important;
          border-color: rgba(79, 124, 255, 0.3) !important;
          color: #FFFFFF !important;
          box-shadow: 0 4px 16px rgba(79, 124, 255, 0.25), 0 0 10px rgba(79, 124, 255, 0.15) !important;
          transform: translateY(-1px);
        }
        @keyframes meshGradient { 0% { transform: scale(1) rotate(0deg); } 100% { transform: scale(1.1) rotate(5deg); } }
        @keyframes floatOrb1 { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(50px, 50px) scale(1.1); } 100% { transform: translate(-30px, 80px) scale(0.9); } }
        @keyframes floatOrb2 { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-60px, -40px) scale(1.15); } 100% { transform: translate(40px, -90px) scale(0.85); } }
        @keyframes floatOrb3 { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(70px, -60px) scale(1.2); } 100% { transform: translate(-50px, 40px) scale(0.95); } }
        @keyframes staggerFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .stagger-1 { animation: staggerFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.1s; opacity: 0; }
        .stagger-2 { animation: staggerFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.2s; opacity: 0; }
        .stagger-3 { animation: staggerFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.3s; opacity: 0; }
        .stagger-4 { animation: staggerFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.4s; opacity: 0; }
      `}</style>

      {/* Ambient glows / Animated Mesh Gradient */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%', background: 'radial-gradient(circle at 15% 50%, rgba(79,140,255,0.08), transparent 25%), radial-gradient(circle at 85% 30%, rgba(139,92,246,0.08), transparent 25%), radial-gradient(circle at 50% 80%, rgba(16,185,129,0.06), transparent 30%)', animation: 'meshGradient 15s ease-in-out infinite alternate', filter: 'blur(60px)' }}/>
        <div style={{ position: 'absolute', top: '15%', left: '10%', width: 450, height: 450, borderRadius: '50%', background: 'rgba(79,140,255,0.06)', animation: 'floatOrb1 24s ease-in-out infinite alternate', filter: 'blur(100px)' }}/>
        <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 550, height: 550, borderRadius: '50%', background: 'rgba(139,92,246,0.06)', animation: 'floatOrb2 28s ease-in-out infinite alternate', filter: 'blur(100px)' }}/>
        <div style={{ position: 'absolute', top: '35%', left: '55%', width: 350, height: 350, borderRadius: '50%', background: 'rgba(16,185,129,0.05)', animation: 'floatOrb3 26s ease-in-out infinite alternate', filter: 'blur(80px)' }}/>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 22, right: 22, zIndex: 9999,
          background: 'rgba(12,18,35,0.97)', border: '1px solid rgba(79,140,255,0.3)',
          borderRadius: 12, padding: '12px 18px', fontSize: '13px',
          display: 'flex', alignItems: 'center', gap: 10,
          backdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          animation: 'lxFadeUp 200ms ease',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#4F8CFF', flexShrink: 0 }}/>
          {toast}
        </div>
      )}

      {/* ═══════ MAIN WRAPPER (60 / 40) ═══════ */}
      <div style={{
        display: 'flex', minHeight: '100vh',
        maxWidth: 1800, margin: '0 auto',
        position: 'relative', zIndex: 1,
      }}>

        {/* ══════ LEFT — BRAND SIDE (60%) ══════ */}
        <div style={{
          width: '60%', flexShrink: 0,
          padding: '60px 60px 120px 60px',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-start', gap: 48,
          overflowY: 'auto', height: '100vh',
          borderRight: '1px solid rgba(255,255,255,0.04)',
        }}>

          {/* ── HERO HEADLINE ── */}
          <div className="stagger-1" style={{ maxWidth: '700px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#4F8CFF', boxShadow: '0 0 12px rgba(79,140,255,0.8)' }}/>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#4F8CFF', textTransform: 'uppercase' }}>
                Xeno CRM  ·  Customer Intelligence for Retail
              </span>
            </div>

            <h1 style={{ fontSize: 'clamp(44px, 4.5vw, 76px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-2px', margin: 0, color: '#FFFFFF' }}>
              Turn Customer Data
              <br/>
              <span style={{ background: 'linear-gradient(135deg, #4F8CFF 0%, #A855F7 45%, #10B981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200% 200%', animation: 'gradShift 6s ease infinite' }}>
                Into Automated Revenue
              </span>
            </h1>

            <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.44)', lineHeight: 1.65, maxWidth: 580, margin: '18px 0 0', fontWeight: 400 }}>
              Segment retail audiences, launch targeted campaigns across every channel, and attribute direct store revenue — all in one platform.
            </p>
          </div>

          {/* ── KPI CARDS ── */}
          <div className="stagger-2">
            {heroLoading ? (
              <div style={{ display: 'flex', gap: 16 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 110, borderRadius: 18,
                    background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(79,140,255,0.2)', borderTopColor: '#4F8CFF', animation: 'lxSpin 0.8s linear infinite' }}/>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 16 }}>
                {KPI_CARDS.map((k, i) => <KpiCard key={i} data={k}/>)}
              </div>
            )}
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.18)', marginTop: 8, fontStyle: 'italic' }}>
              Hover any metric to see full breakdown
            </p>
          </div>

          {/* ── AI PIPELINE CENTERPIECE ── */}
          <div className="stagger-3" style={{
            background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22,
            padding: '32px 36px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#4F8CFF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
                  Automation Engine
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                  Real-Time AI Marketing Pipeline
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 20, padding: '7px 14px',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#10B981', animation: 'lxPulse 2s infinite', display: 'block' }}/>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>Live</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
              {PIPELINE_STAGES.map((stage, idx) => (
                <React.Fragment key={idx}>
                  <PipelineStage data={stage}/>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.2)', marginTop: 20, fontStyle: 'italic' }}>
              Hover each stage to see live metrics and business insights
            </p>
          </div>

          {/* ── FEATURE CARDS ── */}
          <div className="stagger-4">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#4F8CFF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                Core Capabilities
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                Everything you need to grow retail revenue
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {FEATURES.map((f, i) => <FeatureCard key={i} data={f}/>)}
            </div>
          </div>

        </div>{/* end left */}

        {/* ══════ RIGHT — AUTH SIDE (40%) ══════ */}
        <div style={{
          width: '40%', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '60px 40px 120px 40px',
          position: 'sticky', top: 0, height: '100vh',
          overflowY: 'auto',
        }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,140,255,0.05) 0%, transparent 70%)', pointerEvents: 'none' }}/>

          <div style={{ width: '100%', maxWidth: 400, marginBottom: 18, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#4F8CFF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Trusted by Retail Growth Teams
            </div>
            <div style={{ fontSize: '13px', color: '#475569', fontWeight: 400 }}>
              Sign in to access your CRM workspace
            </div>
          </div>

          {/* ── GLASS LOGIN CARD ── */}
          <div className="stagger-2" style={{
            width: '100%', maxWidth: 400, position: 'relative', zIndex: 1,
            background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22,
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            padding: '32px 32px 28px',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #4F8CFF 0%, #8B5CF6 50%, #10B981 100%)', borderRadius: '22px 22px 0 0' }}/>

            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF', margin: 0, letterSpacing: '-0.4px' }}>
                Sign in to Xeno CRM
              </h2>
              <p style={{ fontSize: '13px', color: '#475569', margin: '7px 0 0' }}>
                Customer intelligence platform for modern retail
              </p>
            </div>

            {errorMsg && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
                borderRadius: 10, padding: '10px 14px', fontSize: '13px', color: '#F87171',
                marginBottom: 18,
              }}>{errorMsg}</div>
            )}

            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Workspace
                </label>
                <WsDropdown value={workspace} onChange={setWorkspace}/>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label htmlFor="lx-email" style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Email Address
                </label>
                <input
                  id="lx-email" type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" autoComplete="email" disabled={isLoading}
                  onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
                  style={inputStyle(emailFocus)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label htmlFor="lx-password" style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Password
                </label>
                <input
                  id="lx-password" type="password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" disabled={isLoading}
                  onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)}
                  style={inputStyle(pwFocus)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#475569', fontSize: '13px' }}>
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#4F8CFF', width: 14, height: 14 }}/>
                  Remember me
                </label>
                <a href="#forgot" onClick={e => e.preventDefault()}
                  style={{ color: '#4F8CFF', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
                  Forgot password?
                </a>
              </div>

              <button type="submit" disabled={isLoading} style={{
                width: '100%', padding: '14px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: isLoading ? 'rgba(79,140,255,0.5)' : 'linear-gradient(135deg, #4F8CFF 0%, #6366F1 100%)',
                color: '#FFFFFF', fontSize: '15px', fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif',
                boxShadow: isLoading ? 'none' : '0 6px 24px rgba(79,140,255,0.35)',
                transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
                onMouseEnter={e => { if (!isLoading) { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02) translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 32px rgba(79,140,255,0.45)'; }}}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = isLoading ? 'none' : '0 6px 24px rgba(79,140,255,0.35)'; }}
              >
                {isLoading ? <><Spinner/> Signing in…</> : 'Sign In'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 18px' }}>
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }}/>
              <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>or continue with</span>
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }}/>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {[
                {
                  label: 'Google',
                  svg: <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.24-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>,
                },
                {
                  label: 'Microsoft',
                  svg: <svg width="15" height="15" viewBox="0 0 23 23"><rect fill="#f25022" x="0" y="0" width="11" height="11"/><rect fill="#7fba00" x="12" y="0" width="11" height="11"/><rect fill="#01a4ef" x="0" y="12" width="11" height="11"/><rect fill="#ffb900" x="12" y="12" width="11" height="11"/></svg>,
                },
              ].map(({ label, svg }) => (
                <button key={label} type="button" onClick={() => showToast(`${label} OAuth coming soon`)} disabled={isLoading}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: '11px', fontSize: '13px', fontWeight: 500, color: '#F1F5F9',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    transition: 'all 250ms',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  {svg}{label}
                </button>
              ))}
            </div>
          </div>

          <p style={{ marginTop: 18, fontSize: '11.5px', color: '#2D3748', textAlign: 'center', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>
            By signing in you agree to Xeno CRM's{' '}
            <a href="#" onClick={e => e.preventDefault()} style={{ color: '#475569', textDecoration: 'underline' }}>Terms</a>
            {' '}&amp;{' '}
            <a href="#" onClick={e => e.preventDefault()} style={{ color: '#475569', textDecoration: 'underline' }}>Privacy</a>
          </p>

        </div>{/* end right */}
      </div>{/* end main wrapper */}

      {/* ══════ FLOATING GLASS RIBBON (fixed bottom) ══════ */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        height: 56, display: 'flex', alignItems: 'center', overflow: 'hidden',
        background: 'rgba(5,9,18,0.85)', backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div className="lx-ribbon-track" style={{ display: 'flex', whiteSpace: 'nowrap', width: 'max-content' }}>
          {[...RIBBON_PILLS, ...RIBBON_PILLS].map((pill, idx) => (
            <div key={idx} className="lx-pill" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 9999,
              padding: '8px 18px',
              margin: '0 8px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.7)',
              cursor: 'default',
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            }}>
              {pill}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Login;
