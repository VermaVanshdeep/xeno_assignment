import React, { useState, useEffect, useMemo } from 'react';
import useApi from '../hooks/useApi';
import { 
  listCampaigns, 
  createCampaign, 
  launchCampaign, 
  cancelCampaign, 
  listSegments,
  getSegment,
  previewSegment,
  generateCampaignDraft,
  regenerateCampaignField,
  getCampaignPostLaunchInsights,
  getAudienceRationale,
  fetchCampaignsSummary,
  fetchChannelPerformance,
  pollCampaignAnalytics
} from '../services/api';
import type { 
  SegmentPreviewStats,
  CampaignDraftAI,
  PostLaunchInsightsAI,
  AudienceRationaleAI,
  CampaignAnalytics
} from '../services/api';
import { Badge } from '../components/Badge';
import { BrandedEmptyState } from '../components/BrandedEmptyState';
import { PremiumGlassCard } from '../components/PremiumGlassCard';
import { formatCompactCurrency, formatPercent, formatFullNumber } from '../services/formatters';

const GOAL_PRESETS = [
  'Customer Retention',
  'Win Back Dormant Users',
  'Increase AOV',
  'New Product Launch',
  'Festival Promotion',
  'Inventory Clearance',
  'Custom Goal'
];

/* ── Live Progress Panel ── */
const LiveProgressPanel: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [liveData, setLiveData] = useState<CampaignAnalytics | null>(null);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const data = await pollCampaignAnalytics(campaignId);
        setLiveData(data);
        if (data.sent > 0 && data.sent === data.delivered && data.failed === 0) {
          // It's technically complete, stop aggressive polling
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    };
    fetchLive();
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [campaignId]);

  if (!liveData) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Connecting to messaging gateway...</div>;
  }

  const { audienceSize, sent, delivered, opened, clicked, campaignRevenue, campaignRoi } = liveData;

  const funnel = [
    { label: 'Sent', count: sent, pct: audienceSize > 0 ? (sent / audienceSize) * 100 : 0 },
    { label: 'Delivered', count: delivered, pct: sent > 0 ? (delivered / sent) * 100 : 0 },
    { label: 'Opened', count: opened, pct: delivered > 0 ? (opened / delivered) * 100 : 0 },
    { label: 'Clicked', count: clicked, pct: delivered > 0 ? (clicked / delivered) * 100 : 0 },
  ];

  return (
    <div className="live-progress-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="spinner" style={{ width: 12, height: 12, border: '2px solid rgba(168,85,247,0.3)', borderTopColor: '#A855F7', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
          Live Campaign Progress
        </h4>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target: {formatFullNumber(audienceSize)}</span>
      </div>

      <div className="live-progress-metrics">
        <div className="live-metric-card">
          <span className="live-metric-label">Delivered</span>
          <span className="live-metric-value" style={{ color: '#10B981' }}>{formatFullNumber(delivered)}</span>
          <span className="live-metric-rate">{formatPercent(liveData.deliveryRate)} delivery rate</span>
        </div>
        <div className="live-metric-card">
          <span className="live-metric-label">Opened</span>
          <span className="live-metric-value" style={{ color: '#4F8CFF' }}>{formatFullNumber(opened)}</span>
          <span className="live-metric-rate">{formatPercent(liveData.openRate)} open rate</span>
        </div>
        <div className="live-metric-card">
          <span className="live-metric-label">Revenue</span>
          <span className="live-metric-value" style={{ color: '#22D3EE' }}>{formatCompactCurrency(campaignRevenue)}</span>
          <span className="live-metric-rate">Real-time attribution</span>
        </div>
        <div className="live-metric-card">
          <span className="live-metric-label">ROI</span>
          <span className="live-metric-value" style={{ color: campaignRoi >= 0 ? '#10B981' : '#EF4444' }}>
            {campaignRoi > 0 ? '+' : ''}{campaignRoi.toFixed(0)}%
          </span>
          <span className="live-metric-rate">vs Campaign Cost</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        {funnel.map((step, i) => (
          <div key={i} className="funnel-progress-row">
            <div className="funnel-progress-header">
              <span style={{ color: 'var(--text-secondary)' }}>{step.label}</span>
              <span style={{ fontWeight: 600, color: '#F1F5F9' }}>{formatFullNumber(step.count)} <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>({formatPercent(step.pct)})</span></span>
            </div>
            <div className="funnel-progress-track">
              <div className="funnel-progress-fill" style={{ width: `${step.pct}%`, background: i === 0 ? '#64748B' : i === 1 ? '#10B981' : i === 2 ? '#4F8CFF' : '#A855F7' }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const Campaigns: React.FC = () => {

  const { data: campaigns, loading: loadingCampaigns, refetch: refetchCampaigns } = useApi(listCampaigns);
  const { data: segments } = useApi(listSegments);
  const { data: campaignSummaries, refetch: refetchSummaries } = useApi(fetchCampaignsSummary);
  const { data: channelPerf } = useApi(fetchChannelPerformance);

  // Phase 1: Setup State
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL' | 'RCS'>('WHATSAPP');
  const [goalPreset, setGoalPreset] = useState<string>('');
  const [customGoal, setCustomGoal] = useState<string>('');
  
  // Phase 2: Editable AI Draft State
  const [draft, setDraft] = useState<CampaignDraftAI | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [fieldLoading, setFieldLoading] = useState<Record<string, boolean>>({});
  const [rationale, setRationale] = useState<AudienceRationaleAI | null>(null);

  // Audience Preview State
  const [previewStats, setPreviewStats] = useState<SegmentPreviewStats | null>(null);
  const [_isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Table Action State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Drawer / Insights State
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [insights, setInsights] = useState<Record<string, PostLaunchInsightsAI>>({});
  const [insightsLoading, setInsightsLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedSegmentId) {
      setPreviewStats(null);
      return;
    }
    const loadSegmentPreview = async () => {
      setIsPreviewLoading(true);
      try {
        const segment = await getSegment(selectedSegmentId);
        const res = await previewSegment(segment.rulesJson);
        setPreviewStats(res.stats);
      } catch (err) {
        setPreviewStats(null);
      } finally {
        setIsPreviewLoading(false);
      }
    };
    loadSegmentPreview();
  }, [selectedSegmentId]);

  const activeGoal = goalPreset === 'Custom Goal' ? customGoal : goalPreset;

  const handleGenerateDraft = async () => {
    if (!selectedSegmentId || !channel || !activeGoal) return;
    
    setDraftError(null);
    setDraftLoading(true);
    setDraft(null);
    setRationale(null);

    const segment = segments?.find(s => s.id === selectedSegmentId);
    const segName = segment?.name || 'Unknown Segment';
    const segSize = previewStats?.matchedAudience || 0;

    try {
      const [draftRes, rationaleRes] = await Promise.all([
        generateCampaignDraft(segName, segSize, channel, activeGoal),
        getAudienceRationale(segName, segSize, previewStats || {}, channel, activeGoal).catch(() => null)
      ]);
      setDraft(draftRes);
      if (rationaleRes) setRationale(rationaleRes);
    } catch (err: any) {
      setDraftError(err.message || 'AI Generation Failed. Please retry.');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleRegenerateField = async (field: keyof CampaignDraftAI) => {
    if (!draft || !selectedSegmentId || !channel || !activeGoal) return;
    
    setFieldLoading(prev => ({ ...prev, [field]: true }));
    setDraftError(null);

    const segment = segments?.find(s => s.id === selectedSegmentId);
    const segName = segment?.name || 'Unknown Segment';
    const segSize = previewStats?.matchedAudience || 0;

    try {
      const res = await regenerateCampaignField(field, draft, segName, segSize, channel, activeGoal);
      setDraft(prev => prev ? ({ ...prev, [field]: res.value }) : null);
    } catch (err: any) {
      setDraftError(err.message || `Failed to regenerate ${field}. Please retry.`);
    } finally {
      setFieldLoading(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleSaveDraft = async () => {
    if (!draft || !selectedSegmentId) return;
    try {
      await createCampaign({
        segmentId: selectedSegmentId,
        name: draft.campaignName,
        channel,
        messageTemplate: draft.messageCopy,
        metadataJson: {
          objective: draft.objective,
          ctaText: draft.ctaText,
          recommendedSendTime: draft.recommendedSendTime,
          reasoning: draft.reasoning
        }
      });
      setDraft(null);
      setGoalPreset('');
      setCustomGoal('');
      setSaveMsg({ type: 'success', text: 'Campaign drafted successfully. Launch it from the grid below.' });
      setTimeout(() => setSaveMsg(null), 4000);
      refetchCampaigns();
      refetchSummaries();
    } catch (err: any) {
      setDraftError(err.message || 'Failed to save campaign.');
    }
  };

  const handleLaunch = async (id: string) => {
    setActionLoadingId(id);
    try {
      await launchCampaign(id);
      refetchCampaigns();
      refetchSummaries();
      setExpandedCampaign(id); // Auto-expand to show Live Progress Panel
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setActionLoadingId(id);
    try {
      await cancelCampaign(id);
      refetchCampaigns();
      refetchSummaries();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const loadInsights = async (campaignId: string, forceRefresh = false) => {
    setInsightsLoading(prev => ({ ...prev, [campaignId]: true }));
    try {
      const res = await getCampaignPostLaunchInsights(campaignId, forceRefresh);
      setInsights(prev => ({ ...prev, [campaignId]: res }));
    } catch (err) {
      console.error(err);
    } finally {
      setInsightsLoading(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  const toggleCampaignExpansion = (campaignId: string, status: string) => {
    if (expandedCampaign === campaignId) {
      setExpandedCampaign(null);
    } else {
      setExpandedCampaign(campaignId);
      if (status === 'COMPLETED' && !insights[campaignId]) {
        loadInsights(campaignId);
      }
    }
  };

  const channelLabels: Record<string, string> = {
    WHATSAPP: 'WhatsApp', SMS: 'SMS', EMAIL: 'Email', RCS: 'RCS'
  };

  // Build enriched campaign list combining base campaigns with summary metrics
  const enrichedCampaigns = useMemo(() => {
    if (!campaigns || !campaignSummaries) return campaigns || [];
    return campaigns.map(camp => {
      const summary = campaignSummaries.find((s: any) => s.id === camp.id);
      if (summary) {
        const cost = summary.sent * (channel === 'WHATSAPP' ? 0.8 : channel === 'SMS' ? 0.2 : 0.05);
        const roi = cost > 0 ? ((summary.revenue - cost) / cost) * 100 : 0;
        const ctr = summary.delivered > 0 ? (summary.clicked / summary.delivered) * 100 : 0;
        return { ...camp, ...summary, roi, ctrCalc: ctr };
      }
      return camp;
    });
  }, [campaigns, campaignSummaries, channel]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      
      {/* BUILDER SECTION */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', alignItems: 'stretch' }} className="campaign-builder-grid">
        
        {/* LEFT COL: Phase 1 Context + Advisor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <PremiumGlassCard className="card">
            <h3 className="text-subheading font-semibold mb-4">1. Campaign Context</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '6px' }}>Target Segment</label>
                <select 
                  className="form-select" 
                  style={{ width: '100%', maxWidth: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} 
                  value={selectedSegmentId} 
                  onChange={(e) => setSelectedSegmentId(e.target.value)} 
                  disabled={draftLoading || segments?.length === 0}
                >
                  <option value="">— Choose Audience —</option>
                  {segments && segments.length > 0 ? (
                    segments.map(seg => <option key={seg.id} value={seg.id}>{seg.name}</option>)
                  ) : (
                    <option value="" disabled>No segments found. Please create one.</option>
                  )}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '6px' }}>Channel</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['WHATSAPP', 'SMS', 'EMAIL', 'RCS'] as const).map((chan) => (
                    <button
                      key={chan} type="button" className="btn btn-sm"
                      style={{ 
                        flexGrow: 1, 
                        background: channel === chan ? 'var(--bg-surface-elevated)' : 'transparent',
                        color: channel === chan ? 'var(--accent-blue)' : 'var(--text-muted)',
                        border: `1px solid ${channel === chan ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                      onClick={() => setChannel(chan)} disabled={draftLoading}
                    >
                      {channelLabels[chan]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '6px' }}>Campaign Goal</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  {GOAL_PRESETS.map(goal => (
                    <button
                      key={goal} className="badge"
                      style={{
                        cursor: 'pointer', padding: '4px 10px',
                        background: goalPreset === goal ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.03)',
                        color: goalPreset === goal ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        border: `1px solid ${goalPreset === goal ? 'rgba(34,211,238,0.3)' : 'transparent'}`
                      }}
                      onClick={() => setGoalPreset(goal)} disabled={draftLoading}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
                {goalPreset === 'Custom Goal' && (
                  <input type="text" className="form-input" placeholder="Describe specific goal..." value={customGoal} onChange={e => setCustomGoal(e.target.value)} disabled={draftLoading} />
                )}
              </div>

              <button className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={!selectedSegmentId || !channel || !activeGoal || draftLoading} onClick={handleGenerateDraft}>
                {draftLoading ? 'Generating Campaign...' : draft ? 'Regenerate Campaign' : 'Generate Campaign via AI'}
              </button>

              {draftError && (
                <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--danger)' }}>{draftError}</span>
                  <button onClick={handleGenerateDraft} className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '4px 12px' }}>Retry</button>
                </div>
              )}
            </div>
          </PremiumGlassCard>

          {/* AI Advisor Panel (Phase 2) */}
          {selectedSegmentId && channel && channelPerf && previewStats && (
            <div className="ai-advisor-panel">
              <div className="ai-advisor-header">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                AI Campaign Advisor
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="ai-advisor-metric">
                  <span className="ai-advisor-metric-label">Predicted Reach</span>
                  <span className="ai-advisor-metric-value">{formatFullNumber(previewStats.matchedAudience)}</span>
                </div>
                <div className="ai-advisor-metric">
                  <span className="ai-advisor-metric-label">Predicted CTR ({channel})</span>
                  <span className="ai-advisor-metric-value" style={{ color: 'var(--accent-cyan)' }}>
                    {formatPercent(channelPerf.find((c: any) => c.channel === channel)?.ctr || 0)}
                  </span>
                </div>
                <div className="ai-advisor-metric">
                  <span className="ai-advisor-metric-label">Predicted Revenue</span>
                  <span className="ai-advisor-metric-value" style={{ color: 'var(--success)' }}>
                    {formatCompactCurrency(previewStats.matchedAudience * (previewStats.averageOrderValue || 0) * ((channelPerf.find((c: any) => c.channel === channel)?.ctr || 0) / 100))}
                  </span>
                </div>
                <div className="ai-advisor-metric">
                  <span className="ai-advisor-metric-label">Suggested Send Time</span>
                  <span className="ai-advisor-metric-value" style={{ color: 'var(--accent-purple)', fontSize: '14px', alignSelf: 'flex-start', marginTop: 2 }}>
                    {draft ? draft.recommendedSendTime : 'Pending Draft...'}
                  </span>
                </div>
              </div>
              {rationale && (
                <div className="ai-advisor-explanation">
                  <strong>Audience Fit:</strong> {rationale.reason}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COL: Phase 3 Editable Draft */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PremiumGlassCard className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 className="text-subheading font-semibold mb-4">2. Review & Refine</h3>
            
            {!draft && !draftLoading && (
              <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Fill out the context on the left and click Generate.<br/>Your AI-drafted campaign will appear here.
                </p>
              </div>
            )}

            {draftLoading && (
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: '12px', color: 'var(--accent-cyan)', animation: 'pulse 1.5s infinite' }}>Drafting campaign...</p>
              </div>
            )}

            {draft && !draftLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {['campaignName', 'objective', 'ctaText'].map((f) => (
                    <div key={f} style={{ position: 'relative' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', textTransform: 'capitalize' }}>
                        {f.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" className="form-input" value={(draft as any)[f]} 
                          onChange={e => setDraft({...draft, [f]: e.target.value})} 
                          disabled={fieldLoading[f]} style={{ flexGrow: 1 }}
                        />
                        <button 
                          className="btn btn-sm" onClick={() => handleRegenerateField(f as keyof CampaignDraftAI)}
                          disabled={fieldLoading[f]} title="Regenerate this field" style={{ padding: '0 12px', background: 'rgba(255,255,255,0.05)' }}
                        >
                          {fieldLoading[f] ? '...' : '↻'}
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Message Copy</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <textarea 
                        className="form-input" value={draft.messageCopy} 
                        onChange={e => setDraft({...draft, messageCopy: e.target.value})} 
                        disabled={fieldLoading['messageCopy']} style={{ flexGrow: 1, minHeight: '80px', resize: 'vertical' }}
                      />
                      <button 
                        className="btn btn-sm" onClick={() => handleRegenerateField('messageCopy')}
                        disabled={fieldLoading['messageCopy']} title="Regenerate this field" style={{ padding: '0 12px', height: '38px', background: 'rgba(255,255,255,0.05)' }}
                      >
                        {fieldLoading['messageCopy'] ? '...' : '↻'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>AI Reasoning</div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                    {draft.reasoning}
                  </p>
                </div>

                {saveMsg && (
                  <div style={{ padding: '8px', background: 'rgba(34,197,94,0.1)', color: 'var(--success)', borderRadius: '6px', fontSize: '12px', textAlign: 'center' }}>
                    {saveMsg.text}
                  </div>
                )}

                <button className="btn btn-primary" onClick={handleSaveDraft} style={{ background: 'var(--success)' }}>
                  Save as Draft
                </button>

              </div>
            )}
          </PremiumGlassCard>
        </div>
      </div>

      {/* BOTTOM SECTION: Campaign History */}
      <PremiumGlassCard className="card" style={{ flexGrow: 1 }}>
        <h3 className="text-subheading font-semibold mb-4">3. Campaign History</h3>
        
        {loadingCampaigns ? (
          <p className="text-muted text-center py-8">Loading history...</p>
        ) : !enrichedCampaigns?.length ? (
          <div style={{ padding: '20px' }}>
            <BrandedEmptyState title="No Campaigns Yet" description="Draft and launch your first AI campaign above." />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 1.5fr', padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div>Campaign</div>
              <div>Channel</div>
              <div>Audience</div>
              <div>Performance metrics</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            {enrichedCampaigns.map((camp: any) => (
              <div key={camp.id} style={{ background: expandedCampaign === camp.id ? 'rgba(255,255,255,0.03)' : 'transparent', borderRadius: '8px', border: expandedCampaign === camp.id ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent', overflow: 'hidden', transition: 'all 0.2s' }}>
                
                {/* Enriched Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 1.5fr', padding: '16px 12px', alignItems: 'center' }}>
                  <div>
                    <div className="font-semibold" style={{ fontSize: '13px' }}>{camp.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {new Date(camp.createdAt).toLocaleDateString()}
                      {camp.status !== 'DRAFT' && camp.status !== 'CANCELLED' && (
                        <span style={{ marginLeft: 6, display: 'inline-block', transform: 'scale(0.8)', transformOrigin: 'left' }}>
                          <Badge variant={camp.status === 'COMPLETED' ? 'success' : 'purple'}>{camp.status}</Badge>
                        </span>
                      )}
                    </div>
                  </div>
                  <div><span className={`channel-tag channel-tag-${camp.channel.toLowerCase()}`}>{channelLabels[camp.channel]}</span></div>
                  <div><span className="font-medium" style={{ fontSize: '13px' }}>{formatFullNumber(camp.audienceSize)}</span></div>
                  
                  {/* Phase 4 Enriched Metrics Column */}
                  <div className="camp-enriched-metrics">
                    {camp.status === 'DRAFT' || camp.status === 'CANCELLED' ? (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Not launched</span>
                    ) : (
                      <>
                        <div className={`camp-enriched-chip ${(camp.roi > 0 ? 'positive' : camp.roi < 0 ? 'negative' : 'neutral')}`}>
                          ROI: {camp.roi > 0 ? '+' : ''}{camp.roi?.toFixed(0)}%
                        </div>
                        <div className="camp-enriched-chip neutral">
                          Rev: {formatCompactCurrency(camp.revenue || 0)}
                        </div>
                        <div className="camp-enriched-chip neutral">
                          CTR: {formatPercent(camp.ctrCalc || 0)}
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {camp.status === 'DRAFT' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleLaunch(camp.id)} disabled={actionLoadingId === camp.id}>
                        {actionLoadingId === camp.id ? 'Launching...' : 'Launch'}
                      </button>
                    )}
                    {camp.status === 'RUNNING' && (
                      <button className="btn btn-sm" style={{ border: '1px solid var(--danger)', color: 'var(--danger)' }} onClick={() => handleCancel(camp.id)} disabled={actionLoadingId === camp.id}>
                        Cancel
                      </button>
                    )}
                    {(camp.status === 'COMPLETED' || camp.status === 'RUNNING') && (
                      <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={() => toggleCampaignExpansion(camp.id, camp.status)}>
                        {expandedCampaign === camp.id ? 'Close' : camp.status === 'COMPLETED' ? 'View Insights' : 'Live Progress'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Drawer */}
                {expandedCampaign === camp.id && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                    
                    {camp.status === 'RUNNING' && (
                      <LiveProgressPanel campaignId={camp.id} />
                    )}

                    {camp.status === 'COMPLETED' && (
                      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-cyan)' }}>Post-Launch AI Insights</h4>
                          <button className="btn btn-sm" onClick={() => loadInsights(camp.id, true)} disabled={insightsLoading[camp.id]} style={{ background: 'rgba(255,255,255,0.05)', fontSize: '11px', padding: '4px 10px' }}>
                            {insightsLoading[camp.id] ? 'Refreshing...' : '↻ Refresh Insights'}
                          </button>
                        </div>

                        {insightsLoading[camp.id] && !insights[camp.id] ? (
                          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Analyzing campaign data...</div>
                        ) : insights[camp.id] ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
                            <div>
                              <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Performance Summary</div>
                                <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{insights[camp.id].performanceSummary}</p>
                              </div>
                              <div>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Optimization Recommendations</div>
                                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {insights[camp.id].optimizationRecommendations?.map((rec, i) => (
                                    <li key={i}>{rec}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ background: 'rgba(34,197,94,0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.1)' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '4px', fontWeight: 600 }}>Next Best Campaign</div>
                                <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{insights[camp.id].nextBestCampaign}</p>
                              </div>
                              <div style={{ background: 'rgba(168,85,247,0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.1)' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--accent-purple)', marginBottom: '4px', fontWeight: 600 }}>Audience Expansion</div>
                                <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{insights[camp.id].audienceExpansion}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--danger)', fontSize: '12px' }}>Failed to load insights.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PremiumGlassCard>

    </div>
  );
};

export default Campaigns;
