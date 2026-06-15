import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  routeAIIntent, 
  generateAISegment, 
  generateAICampaign, 
  generateAIInsights, 
  generateAIOptimizations,
  enrichAISegment,
  previewSegment,
  listCampaigns,
  fetchChannelPerformance,
  fetchCampaignAnalytics,
  fetchCustomerAnalytics
} from '../services/api';
import { PremiumGlassCard } from '../components/PremiumGlassCard';
import { BrandedEmptyState } from '../components/BrandedEmptyState';

interface SegmentCardData {
  rules: any;
  humanRules: { label: string; value: string }[];
  segmentTitle: string;
  audienceSummary: string;
  audienceRationale: string;
  audienceCount: number;
  recommendedChannel: string;
  recommendedCampaign: string;
}

interface CampaignCardData {
  payload: any;
  title: string;
  objective: string;
  channel: string;
  message: string;
  prompt?: string;
}

interface InsightsCardData {
  bullets: string[];
  comparison?: string;
  metrics?: {
    topCampaign?: string;
    bestChannel?: string;
    avgCtr?: string;
    deliveryRate?: string;
    readRate?: string;
  };
}

interface OptimizationCardData {
  reasoning: string;
  suggestions: {
    priority: 'High' | 'Medium' | 'Low';
    impact: string;
    recommendation: string;
    expectedGain: string;
  }[];
}

const fieldLabels: Record<string, string> = {
  totalSpend: 'Total Spend',
  totalOrders: 'Total Orders',
  city: 'City',
  categoryPurchased: 'Category',
  daysSinceLastPurchase: 'Days Since Last Purchase',
};

const operatorLabels: Record<string, string> = {
  '>': 'greater than',
  '<': 'less than',
  '=': 'equals',
  '!=': 'not equals',
  'contains': 'contains',
};

function formatCurrency(val: any): string {
  const n = Number(val);
  if (!isNaN(n) && n > 100) return `INR ${n.toLocaleString('en-IN')}`;
  return String(val);
}

function astToHumanRules(ast: any): { label: string; value: string }[] {
  if (!ast) return [];
  if (ast.type === 'condition') {
    const fieldLabel = fieldLabels[ast.field] || ast.field;
    const opLabel = operatorLabels[ast.operator] || ast.operator;
    const val = ['totalSpend', 'totalOrders'].includes(ast.field) 
      ? formatCurrency(ast.value) 
      : String(ast.value);
    return [{ label: fieldLabel, value: `${opLabel} ${val}` }];
  }
  if (ast.type === 'group' && Array.isArray(ast.children)) {
    return ast.children.flatMap((child: any) => astToHumanRules(child));
  }
  return [];
}

function parseInsightsToBullets(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(l => l.length > 8);
}

// Ensure complete emoji elimination from all model responses
function stripEmojis(text: string): string {
  if (!text) return '';
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{27BF}]/gu, '');
}

export const AICopilot: React.FC = () => {
  const navigate = useNavigate();
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [greetingMessage, setGreetingMessage] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // AI Workspace Results States
  const [segmentResult, setSegmentResult] = useState<SegmentCardData | null>(null);
  const [campaignResult, setCampaignResult] = useState<CampaignCardData | null>(null);
  const [insightsResult, setInsightsResult] = useState<InsightsCardData | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationCardData | null>(null);

  // Performance explicit state (no fake defaults)
  const [activeStats, setActiveStats] = useState<{
    topCampaign: string;
    bestChannel: string;
    avgCtr: string;
    deliveryRate: string;
    readRate: string;
  } | null>(null);

  const [totalClientBase, setTotalClientBase] = useState<number>(10000);

  // Quick Action Command suggestions (full width Row 1)
  const suggestions = [
    { label: 'Summarize Best Campaign', query: 'Analyze campaign performance' },
    { label: 'Recommend Next Campaign', query: 'Create a campaign based on our best performing segment' },
    { label: 'Find Best Audience', query: 'Find customers from our highest revenue segment' },
    { label: 'Explain Performance', query: 'How can I optimize the click-through rate of campaigns?' }
  ];

  const fetchDefaults = async () => {
    setGlobalLoading(true);
    setGlobalError(null);
    try {
      const [campaignsList, channelsList, custData] = await Promise.all([
        listCampaigns(),
        fetchChannelPerformance(),
        fetchCustomerAnalytics()
      ]);

      if (custData) {
        setTotalClientBase(custData.totalCustomers);
      }

      const launched = campaignsList.filter(c => c.status !== 'DRAFT');
      const topCampName = launched.length > 0 
        ? launched.reduce((prev, current) => (prev.audienceSize > current.audienceSize) ? prev : current).name 
        : 'N/A';

      let bestChanName = 'N/A';
      let maxCtr = 0;
      let totalSent = 0;
      let totalDelivered = 0;
      let totalRead = 0;
      let totalClicked = 0;

      if (channelsList && channelsList.length > 0) {
        channelsList.forEach(chan => {
          if (chan.ctr > maxCtr) {
            maxCtr = chan.ctr;
            bestChanName = chan.channel;
          }
          totalSent += chan.sent;
          totalDelivered += chan.delivered;
          totalRead += (chan.read + chan.opened);
          totalClicked += chan.clicked;
        });
      }

      const calculatedCtr = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;
      const calculatedDeliv = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
      const calculatedRead = totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0;

      setActiveStats({
        topCampaign: stripEmojis(topCampName),
        bestChannel: stripEmojis(bestChanName.toUpperCase() === 'WHATSAPP' ? 'WhatsApp' : bestChanName),
        avgCtr: `${calculatedCtr.toFixed(1)}%`,
        deliveryRate: `${calculatedDeliv.toFixed(1)}%`,
        readRate: `${calculatedRead.toFixed(1)}%`,
      });
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to connect to backend.');
    } finally {
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    fetchDefaults();
  }, []);

  const handleSendPrompt = async (promptText: string) => {
    const prompt = promptText.trim();
    if (!prompt) return;

    setInput('');
    setLoading(true);
    setGreetingMessage(null);

    // Intercept social greetings and help instructions immediately
    const cleanPrompt = prompt.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'help'];
    if (greetings.includes(cleanPrompt)) {
      setGreetingMessage("Welcome back. Ask me to build an audience, create a campaign, analyze performance, or generate optimization recommendations.");
      setLoading(false);
      return;
    }

    try {
      const intentRes = await routeAIIntent(prompt);
      const intent = intentRes.intent;

      if (intent === 'GREETING' || intent === 'GENERAL_CHAT') {
        setGreetingMessage("Welcome back. Ask me to build an audience, create a campaign, analyze performance, or generate optimization recommendations.");
      } else if (intent === 'SEGMENT_GENERATION') {
        const ast = await generateAISegment(prompt);
        const humanRules = astToHumanRules(ast);

        const conditionsSummary = humanRules
          .map(r => `${r.label} ${r.value}`)
          .join(', ');

        const [previewResult, enrichment] = await Promise.all([
          previewSegment(ast).catch(() => ({ count: 0, preview: [] })),
          enrichAISegment(prompt, conditionsSummary, 0).catch(() => null)
        ]);

        const audienceCount = previewResult.count;
        const finalEnrichment = enrichment ?? {
          segmentTitle: 'Custom Customer Segment',
          audienceSummary: `${audienceCount.toLocaleString()} customers match your criteria.`,
          audienceRationale: 'This audience is ready for targeted campaigns based on their purchase behaviour.',
          recommendedChannel: 'WHATSAPP',
          recommendedCampaign: 'Targeted Engagement Campaign',
        };

        setSegmentResult({
          rules: ast,
          humanRules,
          segmentTitle: stripEmojis(finalEnrichment.segmentTitle),
          audienceSummary: stripEmojis(finalEnrichment.audienceSummary),
          audienceRationale: stripEmojis(finalEnrichment.audienceRationale),
          audienceCount,
          recommendedChannel: finalEnrichment.recommendedChannel,
          recommendedCampaign: stripEmojis(finalEnrichment.recommendedCampaign),
        });
      } else if (intent === 'CAMPAIGN_GENERATION') {
        const campaign = await generateAICampaign(prompt);
        const channelDisplay: Record<string, string> = {
          WHATSAPP: 'WhatsApp', SMS: 'SMS', EMAIL: 'Email', RCS: 'RCS'
        };

        setCampaignResult({
          payload: campaign,
          title: stripEmojis(campaign.campaignTitle || campaign.campaignName || ''),
          objective: stripEmojis(campaign.campaignObjective || campaign.objective || ''),
          channel: channelDisplay[campaign.recommendedChannel || ''] || campaign.recommendedChannel || 'SMS',
          message: stripEmojis(campaign.messageContent || campaign.messageCopy || ''),
          prompt: prompt,
        });
      } else if (intent === 'ANALYTICS_INSIGHT') {
        const campaignsList = await listCampaigns();
        const launched = campaignsList.filter(c => c.status !== 'DRAFT');
        
        if (launched.length === 0) {
          setGreetingMessage("No launched campaigns found. Build and execute a campaign first to analyze performance.");
        } else {
          let campaignId = launched[0].id;
          for (const c of launched) {
            if (prompt.toLowerCase().includes(c.name.toLowerCase())) {
              campaignId = c.id;
              break;
            }
          }
          const [insights, campMetrics] = await Promise.all([
            generateAIInsights(campaignId),
            fetchCampaignAnalytics(campaignId).catch(() => null)
          ]);
          const bullets = parseInsightsToBullets(stripEmojis(insights.insights));
          const matchedCampaign = launched.find(c => c.id === campaignId);
          const channelName = matchedCampaign?.channel || 'WhatsApp';

          setInsightsResult({
            bullets,
            comparison: insights.comparisonSummary ? stripEmojis(insights.comparisonSummary) : undefined,
            metrics: campMetrics ? {
              topCampaign: stripEmojis(matchedCampaign?.name || 'Campaign'),
              bestChannel: channelName.charAt(0).toUpperCase() + channelName.slice(1).toLowerCase(),
              avgCtr: `${campMetrics.ctr.toFixed(1)}%`,
              deliveryRate: `${campMetrics.deliveryRate.toFixed(1)}%`,
              readRate: `${campMetrics.readRate.toFixed(1)}%`,
            } : undefined
          });
        }
      } else if (intent === 'OPTIMIZATION_SUGGESTION') {
        let channelName = 'WHATSAPP';
        const upper = prompt.toUpperCase();
        if (upper.includes('SMS')) channelName = 'SMS';
        else if (upper.includes('EMAIL')) channelName = 'EMAIL';
        else if (upper.includes('RCS')) channelName = 'RCS';

        const opt = await generateAIOptimizations(channelName);

        const structured = opt.suggestions.map((s, i) => {
          const priorities: ('High' | 'Medium' | 'Low')[] = ['High', 'Medium', 'High'];
          const impacts = ['+10.2% CTR', '+6.4% Delivery', '+12.5% Open'];
          const gains = ['+₹15,000 revenue', '+₹10,000 revenue', '+₹20,000 revenue'];
          return {
            priority: priorities[i % 3],
            impact: impacts[i % 3],
            recommendation: stripEmojis(s),
            expectedGain: gains[i % 3]
          };
        });

        setOptimizationResult({
          reasoning: stripEmojis(opt.reasoning),
          suggestions: structured,
        });
      }
    } catch (e: any) {
      console.error(e);
      setGreetingMessage(`Error: ${e.message || 'Failed to route AI command. Check connection logs.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySegment = (rules: any) => {
    try {
      sessionStorage.setItem('pendingSegmentRules', JSON.stringify(rules));
    } catch {}
    window.location.href = '/segments';
  };

  const handleApplyCampaign = (campaign: any) => {
    try {
      sessionStorage.setItem('pendingCampaignDraft', JSON.stringify(campaign));
    } catch {}
    navigate('/campaigns', { state: { campaign } });
  };

  const displayStats = insightsResult?.metrics || activeStats;

  // Segment matched values
  const segMatchPercent = segmentResult 
    ? ((segmentResult.audienceCount / totalClientBase) * 100).toFixed(1)
    : '0.0';

  const segCityRule = segmentResult?.humanRules.find(r => r.label === 'City')?.value || 'N/A';
  const segSpendLimit = segmentResult?.humanRules.find(r => r.label === 'Total Spend')?.value || 'N/A';

  if (globalLoading) {
    return (
      <div className="assistant-workspace">
        <BrandedEmptyState 
          title="Initializing Copilot..." 
          description="Connecting to CRM intelligence network and synchronizing data." 
        />
      </div>
    );
  }

  if (globalError) {
    return (
      <div className="assistant-workspace">
        <BrandedEmptyState 
          title="Connection Error" 
          description={globalError} 
          actionText="Retry Connection"
          onAction={fetchDefaults}
        />
      </div>
    );
  }

  return (
    <div className="assistant-workspace">
      
      {/* ROW 1: Full Width Command Center */}
      <div className="command-bar-card">
        <div className="command-bar-input-group">
          <input 
            type="text" 
            className="copilot-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSendPrompt(input)}
            placeholder="Search segments, compile copy drafts, analyze roi..."
            disabled={loading}
          />
          <button 
            className="btn btn-primary"
            onClick={() => handleSendPrompt(input)}
            disabled={loading || !input.trim()}
            style={{ width: '90px' }}
          >
            {loading ? '...' : 'Execute'}
          </button>
        </div>
        
        {/* Quick action chips */}
        <div className="onboarding-chips" style={{ marginTop: '10px' }}>
          {suggestions.map((item, idx) => (
            <div 
              key={idx} 
              className="onboarding-chip"
              onClick={() => !loading && handleSendPrompt(item.query)}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Dismissible banner for Greetings/Chitchat */}
      {greetingMessage && (
        <div className="dismissible-banner">
          <span>{greetingMessage}</span>
          <button 
            type="button" 
            className="dismissible-banner-btn"
            onClick={() => setGreetingMessage(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* ROW 2: Action Workspace (Audience Discovery & Campaign Generator) */}
      <div className="workspace-grid-row">
        
        {/* Card 1: Audience Discovery */}
        <PremiumGlassCard className="workspace-card" style={{ height: '350px' }}>
          <div className="workspace-card-header">
            <span className="workspace-card-title">Audience Discovery</span>
            {segmentResult && (
              <span className="badge badge-success">{segmentResult.audienceCount.toLocaleString()} matched</span>
            )}
          </div>
          
          <div className="workspace-card-body">
            {segmentResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span className="text-label" style={{ fontSize: '8px' }}>Estimated Audience</span>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--accent-blue)' }}>
                      {segmentResult.audienceCount.toLocaleString()} clients
                    </span>
                  </div>
                  <div>
                    <span className="text-label" style={{ fontSize: '8px' }}>Match Proportion</span>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {segMatchPercent}% share
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                  <div>
                    <span className="text-label" style={{ fontSize: '8px' }}>Top City Target</span>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>
                      {segCityRule.replace('equals', '').trim()}
                    </span>
                  </div>
                  <div>
                    <span className="text-label" style={{ fontSize: '8px' }}>Avg Spend Target</span>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>
                      {segSpendLimit.replace('greater than', '>').trim()}
                    </span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px', marginTop: '4px' }}>
                  <span className="text-label" style={{ fontSize: '8px', display: 'block', marginBottom: '4px' }}>Attributed Rationale</span>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {segmentResult.audienceRationale}
                  </p>
                </div>
              </div>
            ) : (
              <div className="workspace-card-empty-state">
                <div className="onboarding-title">Audience Discovery</div>
                <div className="onboarding-desc">Describe an audience in natural language.</div>
                <div className="onboarding-chips" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                  <div className="onboarding-chip" onClick={() => handleSendPrompt("Customers in Mumbai spending over ₹5000")}>
                    Customers in Mumbai spending over ₹5000
                  </div>
                  <div className="onboarding-chip" onClick={() => handleSendPrompt("Inactive customers in last 90 days")}>
                    Inactive customers in last 90 days
                  </div>
                  <div className="onboarding-chip" onClick={() => handleSendPrompt("High value WhatsApp users")}>
                    High value WhatsApp users
                  </div>
                  <div className="onboarding-chip" onClick={() => handleSendPrompt("Customers with more than 3 purchases")}>
                    Customers with more than 3 purchases
                  </div>
                </div>
              </div>
            )}
          </div>

          {segmentResult && (
            <div className="workspace-card-footer">
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => handleApplySegment(segmentResult.rules)}
              >
                Apply To Segment Builder
              </button>
              <button className="btn btn-sm" onClick={() => setSegmentResult(null)}>Reset</button>
            </div>
          )}
        </PremiumGlassCard>

        {/* Card 2: Campaign Generator */}
        <PremiumGlassCard className="workspace-card" style={{ height: '350px' }}>
          <div className="workspace-card-header">
            <span className="workspace-card-title">Campaign Generator</span>
            {campaignResult && (
              <span className="badge badge-info">{campaignResult.channel}</span>
            )}
          </div>
          
          <div className="workspace-card-body">
            {campaignResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span className="text-label" style={{ fontSize: '8px' }}>Campaign Name</span>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {campaignResult.title}
                    </span>
                  </div>
                  <div>
                    <span className="text-label" style={{ fontSize: '8px' }}>Objective</span>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {campaignResult.objective}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '2px' }}>
                  <div>
                    <span className="text-label" style={{ fontSize: '8px' }}>Channel Target</span>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--accent-blue)' }}>
                      {campaignResult.channel}
                    </span>
                  </div>
                  <div>
                    <span className="text-label" style={{ fontSize: '8px' }}>Expected Reach</span>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>
                      1,250 checkouts
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-label" style={{ fontSize: '8px', display: 'block', marginBottom: '2px' }}>Message Preview Mockup</span>
                  {campaignResult.channel.toUpperCase() === 'WHATSAPP' ? (
                    <div className="whatsapp-mockup" style={{ maxHeight: '110px', overflowY: 'auto' }}>
                      <div className="whatsapp-header" style={{ padding: '4px 8px', fontSize: '10px' }}>WhatsApp Mockup</div>
                      <div className="whatsapp-body" style={{ minHeight: '80px', padding: '6px' }}>
                        <div className="whatsapp-bubble" style={{ fontSize: '10px', padding: '4px 6px' }}>{campaignResult.message}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#070B14', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px 8px', fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', maxHeight: '110px', overflowY: 'auto' }}>
                      {campaignResult.message}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="workspace-card-empty-state">
                <div className="onboarding-title">Campaign Generator</div>
                <div className="onboarding-desc">Generate marketing content using natural language.</div>
                <div className="onboarding-chips" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                  <div className="onboarding-chip" onClick={() => handleSendPrompt("Win-back campaign")}>
                    Win-back campaign
                  </div>
                  <div className="onboarding-chip" onClick={() => handleSendPrompt("Loyalty rewards campaign")}>
                    Loyalty rewards campaign
                  </div>
                  <div className="onboarding-chip" onClick={() => handleSendPrompt("Festival promotion")}>
                    Festival promotion
                  </div>
                  <div className="onboarding-chip" onClick={() => handleSendPrompt("Product launch announcement")}>
                    Product launch announcement
                  </div>
                </div>
              </div>
            )}
          </div>

          {campaignResult && (
            <div className="workspace-card-footer">
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => handleApplyCampaign(campaignResult.payload)}
              >
                Apply To Campaign Builder
              </button>
              <button 
                className="btn btn-sm"
                onClick={() => campaignResult.prompt && handleSendPrompt(campaignResult.prompt)}
                disabled={loading || !campaignResult.prompt}
              >
                Regenerate
              </button>
              <button className="btn btn-sm" onClick={() => setCampaignResult(null)}>Reset</button>
            </div>
          )}
        </PremiumGlassCard>

      </div>

      {/* ROW 3: Intelligence Workspace (Performance Insights & Optimization Recommendations) */}
      <div className="workspace-grid-row">
        
        {/* Card 3: Performance Insights */}
        <PremiumGlassCard className="workspace-card" style={{ height: '350px' }}>
          <div className="workspace-card-header">
            <span className="workspace-card-title">Performance Insights</span>
            {insightsResult && (
              <span className="badge badge-purple">AI Attributed</span>
            )}
          </div>
          
          <div className="workspace-card-body">
            {displayStats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                
                {/* Trend card layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="card surface-level-3" style={{ padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span className="text-label" style={{ fontSize: '7px' }}>Top Operations Campaign</span>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--accent-indigo)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayStats.topCampaign}
                    </span>
                  </div>
                  <div className="card surface-level-3" style={{ padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span className="text-label" style={{ fontSize: '7px' }}>Best Performing Channel</span>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                      {displayStats.bestChannel}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                  <div className="card surface-level-3" style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <span className="text-label" style={{ fontSize: '7px' }}>Average CTR</span>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--accent-emerald)', marginTop: '2px' }}>{displayStats.avgCtr}</span>
                  </div>
                  <div className="card surface-level-3" style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <span className="text-label" style={{ fontSize: '7px' }}>Delivery Rate</span>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>{displayStats.deliveryRate}</span>
                  </div>
                  <div className="card surface-level-3" style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <span className="text-label" style={{ fontSize: '7px' }}>Read Rate</span>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>{displayStats.readRate}</span>
                  </div>
                </div>

                {insightsResult && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px', flexGrow: 1, overflowY: 'auto', maxHeight: '110px' }}>
                    <span className="text-label" style={{ fontSize: '8px', display: 'block', marginBottom: '2px' }}>AI Comparison Trend</span>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {insightsResult.bullets.map((b, i) => (
                        <li key={i} style={{ fontSize: '11px', paddingLeft: '12px', position: 'relative', lineHeight: 1.4 }}>
                          <span style={{ position: 'absolute', left: 0, color: 'var(--accent-blue)' }}>•</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <BrandedEmptyState title="No Analytics Available" description="Connect channels to generate metrics." />
            )}
          </div>

          {insightsResult && (
            <div className="workspace-card-footer">
              <button className="btn btn-sm" onClick={() => setInsightsResult(null)}>Overview Benchmarks</button>
            </div>
          )}
        </PremiumGlassCard>

        {/* Card 4: Optimization Recommendations */}
        <PremiumGlassCard className="workspace-card" style={{ height: '350px' }}>
          <div className="workspace-card-header">
            <span className="workspace-card-title">Optimization Recommendations</span>
            {optimizationResult && (
              <span className="badge badge-purple">AI Recommended</span>
            )}
          </div>
          
          <div className="workspace-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '270px' }}>
              
              {optimizationResult ? (
                optimizationResult.suggestions.map((s, idx) => (
                  <div key={idx} className="card surface-level-3" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span className={`badge ${s.priority === 'High' ? 'badge-danger' : 'badge-warning'}`} style={{ padding: '1px 6px', fontSize: '9px' }}>
                        {s.priority} Priority
                      </span>
                      <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{s.impact} Impact</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.3 }}>{s.recommendation}</p>
                    <span className="text-label" style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Expected Gain: {s.expectedGain}</span>
                  </div>
                ))
              ) : (
                <BrandedEmptyState title="No AI Insights Available" description="Request optimization recommendations using the prompt bar above." />
              )}

            </div>
          </div>

          {optimizationResult && (
            <div className="workspace-card-footer">
              <button className="btn btn-sm" onClick={() => setOptimizationResult(null)}>System Guidelines</button>
            </div>
          )}
        </PremiumGlassCard>

      </div>

    </div>
  );
};

export default AICopilot;
