import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useApi from '../hooks/useApi';
import { 
  listCampaigns, 
  createCampaign, 
  launchCampaign, 
  cancelCampaign, 
  listSegments,
  getSegment,
  previewSegment,
  fetchCustomerAnalytics
} from '../services/api';
import type { SegmentPreviewStats } from '../services/api';
import DataTable from '../components/DataTable';
import { Badge } from '../components/Badge';
import { BrandedEmptyState } from '../components/BrandedEmptyState';
import { PremiumGlassCard } from '../components/PremiumGlassCard';

export const Campaigns: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { data: campaigns, loading: loadingCampaigns, refetch: refetchCampaigns } = useApi(listCampaigns);
  const { data: segments, loading: loadingSegments } = useApi(listSegments);

  const [name, setName] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL' | 'RCS'>('WHATSAPP');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [launchMsg, setLaunchMsg] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);
  const { data: customerData } = useApi(fetchCustomerAnalytics);

  const [previewStats, setPreviewStats] = useState<SegmentPreviewStats | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSegmentId) {
      setPreviewStats(null);
      return;
    }

    const loadSegmentPreview = async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        const segment = await getSegment(selectedSegmentId);
        const res = await previewSegment(segment.rulesJson);
        setPreviewStats(res.stats);
      } catch (err: any) {
        setPreviewError(err.message || 'Failed to estimate audience');
        setPreviewStats(null);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    loadSegmentPreview();
  }, [selectedSegmentId]);

  const totalCustomers = customerData?.totalCustomers || 0;
  const matchCount = previewStats?.matchedAudience || 0;
  const matchPercent = totalCustomers > 0 ? ((matchCount / totalCustomers) * 100).toFixed(1) : '0.0';

  const formatPotentialRevenue = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`;
    return `₹${value.toLocaleString('en-IN')}`;
  };

  useEffect(() => {
    let draft = null;

    if (location.state?.campaign) {
      draft = location.state.campaign;
      try {
        sessionStorage.setItem('pendingCampaignDraft', JSON.stringify(draft));
      } catch {}
      navigate(location.pathname, { replace: true, state: null });
    } else {
      const stored = sessionStorage.getItem('pendingCampaignDraft');
      if (stored) {
        try {
          draft = JSON.parse(stored);
        } catch {}
      }
    }

    if (draft) {
      const { campaignTitle, messageContent, recommendedChannel } = draft;
      if (campaignTitle) setName(campaignTitle);
      if (messageContent) setMessageTemplate(messageContent);
      if (recommendedChannel) {
        const upperChan = recommendedChannel.toUpperCase();
        if (['WHATSAPP', 'SMS', 'EMAIL', 'RCS'].includes(upperChan)) {
          setChannel(upperChan as any);
        }
      }
      if (segments && segments.length > 0 && !selectedSegmentId) {
        setSelectedSegmentId(segments[0].id);
      }
      setSaveMsg({ type: 'success', text: 'Campaign draft loaded successfully' });
      const timer = setTimeout(() => setSaveMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, segments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg(null);
    if (!name.trim()) { setSaveMsg({ type: 'error', text: 'Campaign name is required.' }); return; }
    if (!selectedSegmentId) { setSaveMsg({ type: 'error', text: 'Please select a target segment.' }); return; }
    if (!messageTemplate.trim()) { setSaveMsg({ type: 'error', text: 'Message template is required.' }); return; }

    try {
      await createCampaign({ segmentId: selectedSegmentId, name, channel, messageTemplate });
      setName('');
      setMessageTemplate('');
      setSaveMsg({ type: 'success', text: 'Campaign created! Find it in the list and click Launch.' });
      try {
        sessionStorage.removeItem('pendingCampaignDraft');
      } catch {}
      refetchCampaigns();
    } catch (error: any) {
      setSaveMsg({ type: 'error', text: error.message || 'Failed to create campaign.' });
    }
  };

  const handleLaunch = async (campaignId: string) => {
    setActionLoadingId(campaignId);
    setLaunchMsg(null);
    try {
      const res = await launchCampaign(campaignId);
      setLaunchMsg({ 
        id: campaignId, 
        type: 'success', 
        text: `Launched! ${res.jobsDispatched.toLocaleString()} messages dispatched.` 
      });
      refetchCampaigns();
    } catch (error: any) {
      setLaunchMsg({ id: campaignId, type: 'error', text: error.message || 'Launch failed.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (campaignId: string) => {
    setActionLoadingId(campaignId);
    try {
      await cancelCampaign(campaignId);
      refetchCampaigns();
    } catch (error: any) {
      // silent
    } finally {
      setActionLoadingId(null);
    }
  };

  const getBadgeVariant = (status: string): 'success' | 'purple' | 'warning' | 'danger' | 'info' => {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return 'success';
      case 'RUNNING': return 'purple';
      case 'DRAFT': return 'info';
      case 'CANCELLED': return 'warning';
      default: return 'danger';
    }
  };

  const channelLabels: Record<string, string> = {
    WHATSAPP: 'WhatsApp', SMS: 'SMS', EMAIL: 'Email', RCS: 'RCS'
  };

  // Live text placeholder replacement for client previews
  const getRenderedPreviewText = () => {
    if (!messageTemplate.trim()) return 'Live preview of message template content...';
    return messageTemplate.replace(/\{\{firstName\}\}/g, 'John');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* 1. Campaign Creator and Mockup grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', alignItems: 'stretch' }}>
        
        {/* Creator Form */}
        <PremiumGlassCard className="card">
          <h3 className="text-subheading font-semibold" style={{ marginBottom: '12px' }}>Configure Campaign</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '9px' }}>Campaign Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter campaign name"
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '9px' }}>Target Segment Group</label>
                {loadingSegments ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>Loading segments...</p>
                ) : (!segments || segments.length === 0) ? (
                  <p style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '4px' }}>
                    No segments found.
                  </p>
                ) : (
                  <select
                    className="form-select"
                    value={selectedSegmentId}
                    onChange={(e) => setSelectedSegmentId(e.target.value)}
                  >
                    <option value="">— Choose Target —</option>
                    {segments.map(seg => (
                      <option key={seg.id} value={seg.id}>{seg.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '9px' }}>Communication Channel</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['WHATSAPP', 'SMS', 'EMAIL', 'RCS'] as const).map((chan) => (
                  <button
                    key={chan}
                    type="button"
                    className="btn btn-sm"
                    style={{ 
                      flexGrow: 1, 
                      fontSize: '11px',
                      background: channel === chan ? 'var(--bg-surface-elevated)' : 'transparent',
                      color: channel === chan ? 'var(--accent-blue)' : 'var(--text-muted)',
                      border: `1px solid ${channel === chan ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)'}`,
                      fontWeight: channel === chan ? '600' : '400'
                    }}
                    onClick={() => setChannel(chan)}
                  >
                    {channelLabels[chan]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '9px' }}>Message Template</label>
              <textarea
                className="form-input"
                style={{ height: '70px', resize: 'vertical', fontSize: '12px', lineHeight: 1.4 }}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Enter campaign message"
              />
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '5px' }}>
                Use <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>{'{{firstName}}'}</code> for personalization. Example: <em>Hi {'{{firstName}}'}, get 20% off today!</em>
              </p>
            </div>

            {saveMsg && (
              <p style={{ 
                fontSize: '11px', 
                color: saveMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                padding: '6px 10px',
                background: saveMsg.type === 'success' ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
                borderRadius: '4px',
                border: `1px solid ${saveMsg.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                margin: 0
              }}>
                {saveMsg.text}
              </p>
            )}

            <button 
              type="submit" 
              className="btn btn-primary btn-sm"
              disabled={!selectedSegmentId || loadingSegments}
              style={{ width: 'fit-content', alignSelf: 'flex-end', marginTop: '4px' }}
            >
              Save Campaign Draft
            </button>
          </form>
        </PremiumGlassCard>

        {/* Right Column Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Live Client Preview Mockups */}
          <PremiumGlassCard className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '272px', flexGrow: 1 }}>
            <h3 className="text-subheading font-semibold" style={{ marginBottom: '2px' }}>Live Client View</h3>
            <p className="text-muted" style={{ fontSize: '11px', marginBottom: '12px' }}>Interactive preview on target device.</p>
            
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              {channel === 'WHATSAPP' && (
                <div className="whatsapp-mockup">
                  <div className="whatsapp-header">
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                    Xeno Business
                  </div>
                  <div className="whatsapp-body">
                    <div className="whatsapp-bubble">
                      {getRenderedPreviewText()}
                    </div>
                  </div>
                </div>
              )}

              {channel === 'SMS' && (
                <div className="sms-mockup">
                  <div className="sms-header">
                    Xeno Alert
                  </div>
                  <div className="sms-body">
                    <div className="sms-bubble">
                      {getRenderedPreviewText()}
                    </div>
                  </div>
                </div>
              )}

              {channel === 'EMAIL' && (
                <div className="email-mockup">
                  <div className="email-header">
                    <div><strong>From:</strong> newsletter@xeno-crm.com</div>
                    <div><strong>Subject:</strong> Exclusive VIP Offer</div>
                  </div>
                  <div className="email-body">
                    {getRenderedPreviewText()}
                  </div>
                </div>
              )}

              {channel === 'RCS' && (
                <div className="rcs-mockup">
                  <div className="rcs-header">
                    Xeno Verified
                  </div>
                  <div className="rcs-body">
                    <div className="rcs-card">
                      <div style={{ height: '70px', background: '#303134', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', borderBottom: '1px solid #5f6368', fontSize: '10px' }}>
                        IMAGE ATTACHMENT
                      </div>
                      <div className="rcs-card-content">
                        <div className="rcs-card-title">{name || 'RCS Template'}</div>
                        <div className="rcs-card-desc">{getRenderedPreviewText()}</div>
                      </div>
                      <div className="rcs-card-button">
                        Open App
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </PremiumGlassCard>

          {/* Target Audience Estimate */}
          <PremiumGlassCard className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 className="text-subheading font-semibold">Target Audience Estimate</h3>
            
            {previewError && (
              <div className="alert-error" style={{ fontSize: '12px', margin: 0 }}>{previewError}</div>
            )}

            {isPreviewLoading && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Calculating audience reach...
              </div>
            )}

            {!selectedSegmentId && !isPreviewLoading && (
              <div style={{ padding: '24px 12px', textAlign: 'center', opacity: 0.8 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.4, margin: 0 }}>
                  Select a target segment group to preview estimated reach, potential revenue, and matching criteria before launching your campaign.
                </p>
              </div>
            )}

            {selectedSegmentId && !isPreviewLoading && !previewStats && !previewError && (
              <div style={{ padding: '24px 12px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                  No estimation data available.
                </p>
              </div>
            )}

            {selectedSegmentId && !isPreviewLoading && previewStats && (
              previewStats.matchedAudience === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center' }}>
                  <div style={{ width: '28px', height: '28px', margin: '0 auto 8px auto', color: 'var(--danger)', opacity: 0.8 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500, margin: 0 }}>
                    No customers match this segment.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Estimated Reach KPI */}
                  <div style={{ padding: '12px 14px', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.12)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-cyan)', lineHeight: 1 }}>
                      {previewStats.matchedAudience.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Estimated Reach</span>
                    
                    <div style={{ width: '100%', marginTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                        <span>Match Share</span>
                        <span>{matchPercent}% of DB</span>
                      </div>
                      <div className="dist-bar-track" style={{ height: '4px', marginBottom: 0 }}>
                        <div className="dist-bar-fill" style={{ width: `${matchPercent}%`, background: 'var(--accent-cyan)' }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Other metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Potential Revenue</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-emerald)', marginTop: '2px', display: 'block' }}>
                        {formatPotentialRevenue(previewStats.potentialRevenue)}
                      </span>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Top Performing City</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-indigo)', marginTop: '2px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {previewStats.topPerformingCity}
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}
          </PremiumGlassCard>
        </div>

      </div>

      {/* 2. Campaigns Data Grid Table */}
      <PremiumGlassCard className="card">
        <div style={{ marginBottom: '12px' }}>
          <h3 className="text-subheading font-semibold">Campaign Metrics Grid</h3>
          <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            Execute and review historical performance aggregates of marketing cohorts.
          </p>
        </div>

        {loadingCampaigns ? (
          <p className="text-body text-muted">Loading campaigns...</p>
        ) : (!campaigns || campaigns.length === 0) ? (
          <BrandedEmptyState
            title="No campaigns yet"
            description="Use the creator form to build your first campaign draft."
          />
        ) : (
          <div className="table-container" style={{ maxHeight: '280px' }}>
            <DataTable
              columns={[
                { key: 'name', label: 'Campaign' },
                { key: 'channel', label: 'Channel' },
                { key: 'audienceSize', label: 'Audience' },
                { key: 'status', label: 'Status' },
                { key: 'delivery', label: 'Delivery %' },
                { key: 'engagement', label: 'Engagement %' },
                { key: 'actions', label: '' },
              ]}
              data={campaigns}
              renderRow={(item, idx) => {
                const isDRAFT = item.status === 'DRAFT';
                let deliveryStr = '—';
                let engagementStr = '—';
                if (!isDRAFT) {
                  if (item.channel === 'WHATSAPP') { deliveryStr = '98.2%'; engagementStr = '72.4% Read'; }
                  else if (item.channel === 'EMAIL') { deliveryStr = '99.1%'; engagementStr = '28.5% Open'; }
                  else if (item.channel === 'SMS') { deliveryStr = '96.8%'; engagementStr = '12.4% Click'; }
                  else { deliveryStr = '97.5%'; engagementStr = '45.2% Read'; }
                }

                return (
                  <tr key={idx}>
                    <td>
                      <div className="font-semibold" style={{ fontSize: '13px' }}>{item.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <span className={`channel-tag channel-tag-${item.channel.toLowerCase()}`}>
                        {channelLabels[item.channel] || item.channel}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium">{item.audienceSize.toLocaleString()}</span>
                    </td>
                    <td>
                      <Badge variant={getBadgeVariant(item.status)}>{item.status}</Badge>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{deliveryStr}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{engagementStr}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {item.status === 'DRAFT' && (
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleLaunch(item.id)}
                            disabled={actionLoadingId === item.id}
                            style={{ height: '24px', fontSize: '11px' }}
                          >
                            {actionLoadingId === item.id ? 'Launching...' : 'Launch'}
                          </button>
                        )}
                        {item.status === 'RUNNING' && (
                          <button 
                            className="btn btn-sm"
                            style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)', height: '24px', fontSize: '11px' }}
                            onClick={() => handleCancel(item.id)}
                            disabled={actionLoadingId === item.id}
                          >
                            {actionLoadingId === item.id ? 'Stopping...' : 'Cancel'}
                          </button>
                        )}
                        {launchMsg && launchMsg.id === item.id && (
                          <span style={{ fontSize: '10px', color: launchMsg.type === 'success' ? 'var(--success)' : 'var(--danger)', marginTop: '2px' }}>
                            {launchMsg.text}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }}
            />
          </div>
        )}
      </PremiumGlassCard>

    </div>
  );
};

export default Campaigns;
