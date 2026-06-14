import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  routeAIIntent, 
  generateAISegment, 
  generateAICampaign, 
  generateAIInsights, 
  generateAIOptimizations,
  listCampaigns
} from '../services/api';

interface DrawerMessage {
  id: number;
  sender: 'user' | 'ai';
  text?: string;
  actionType?: 'segment' | 'campaign';
  actionPayload?: any;
  humanSummary?: string;
}

interface AIDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

let drawerId = 0;

const fieldLabels: Record<string, string> = {
  totalSpend: 'Total Spend',
  totalOrders: 'Total Orders',
  city: 'City',
  categoryPurchased: 'Category',
  daysSinceLastPurchase: 'Days Since Last Purchase',
};

const opLabels: Record<string, string> = {
  '>': 'greater than', '<': 'less than', '=': 'equals', '!=': 'not equals', contains: 'contains',
};

function astToSummary(ast: any): string {
  if (!ast) return '';
  if (ast.type === 'condition') {
    const f = fieldLabels[ast.field] || ast.field;
    const op = opLabels[ast.operator] || ast.operator;
    const v = ['totalSpend', 'totalOrders'].includes(ast.field)
      ? `₹${Number(ast.value).toLocaleString('en-IN')}`
      : String(ast.value);
    return `${f} ${op} ${v}`;
  }
  if (ast.type === 'group' && Array.isArray(ast.children)) {
    return ast.children.map((c: any) => astToSummary(c)).join(` ${ast.logic} `);
  }
  return '';
}

export const AIDrawer: React.FC<AIDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<DrawerMessage[]>([{
    id: ++drawerId,
    sender: 'ai',
    text: "Hi! I'm Xeno Assistant, your CRM AI. Ask me to find customers, create a campaign, or analyze performance."
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt) return;

    setMessages(prev => [...prev, { id: ++drawerId, sender: 'user', text: prompt }]);
    setInput('');
    setLoading(true);

    try {
      const routeRes = await routeAIIntent(prompt);
      const intent = routeRes.intent;

      if (intent === 'GREETING') {
        setMessages(prev => [...prev, { id: ++drawerId, sender: 'ai', text: "Hi! I'm Xeno Assistant, your CRM AI. Ask me to find customers, create a campaign, or analyze performance. What would you like to do?" }]);

      } else if (intent === 'GENERAL_CHAT') {
        setMessages(prev => [...prev, { id: ++drawerId, sender: 'ai', text: "I'm Xeno Assistant, your CRM AI. Try asking me to find customers, create a campaign, or analyze performance." }]);

      } else if (intent === 'SEGMENT_GENERATION') {
        const ast = await generateAISegment(prompt);
        const summary = astToSummary(ast);
        setMessages(prev => [...prev, {
          id: ++drawerId,
          sender: 'ai',
          text: `Here's your segment:`,
          actionType: 'segment',
          actionPayload: ast,
          humanSummary: summary,
        }]);

      } else if (intent === 'CAMPAIGN_GENERATION') {
        const campaign = await generateAICampaign(prompt);
        setMessages(prev => [...prev, {
          id: ++drawerId,
          sender: 'ai',
          text: `Campaign ready:`,
          actionType: 'campaign',
          actionPayload: campaign,
          humanSummary: `"${campaign.campaignTitle}" — ${campaign.recommendedChannel}`,
        }]);

      } else if (intent === 'ANALYTICS_INSIGHT') {
        const campaignsList = await listCampaigns();
        const launched = campaignsList.filter(c => c.status !== 'DRAFT');
        if (launched.length === 0) {
          setMessages(prev => [...prev, { id: ++drawerId, sender: 'ai', text: 'No launched campaigns found. Launch a campaign first.' }]);
        } else {
          let campaignId = launched[0].id;
          for (const c of launched) {
            if (prompt.toLowerCase().includes(c.name.toLowerCase())) { campaignId = c.id; break; }
          }
          const insights = await generateAIInsights(campaignId);
          setMessages(prev => [...prev, { id: ++drawerId, sender: 'ai', text: insights.insights }]);
        }

      } else if (intent === 'OPTIMIZATION_SUGGESTION') {
        let ch = 'WHATSAPP';
        const up = prompt.toUpperCase();
        if (up.includes('SMS')) ch = 'SMS';
        else if (up.includes('EMAIL')) ch = 'EMAIL';
        else if (up.includes('RCS')) ch = 'RCS';
        const opt = await generateAIOptimizations(ch);
        const text = opt.reasoning + '\n\n' + opt.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
        setMessages(prev => [...prev, { id: ++drawerId, sender: 'ai', text }]);

      } else {
        setMessages(prev => [...prev, { id: ++drawerId, sender: 'ai', text: 'I can help with segment building, campaigns, analytics, and optimization. What would you like to do?' }]);
      }
    } catch (err: any) {
      const msg = err.message?.includes('401')
        ? 'AI not connected. Please check GROQ_API_KEY.'
        : (err.message || 'Something went wrong.');
      setMessages(prev => [...prev, { id: ++drawerId, sender: 'ai', text: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySegment = (rules: any) => {
    try { sessionStorage.setItem('pendingSegmentRules', JSON.stringify(rules)); } catch {}
    onClose();
    setTimeout(() => { window.location.href = '/segments'; }, 50);
  };

  const handleApplyCampaign = (campaign: any) => {
    onClose();
    navigate('/campaigns', { state: { campaign } });
  };

  return (
    <aside className={`ai-panel ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="ai-panel-header">
        <div className="flex-align-center">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--primary-accent)">
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707m0-12.728.707.707m11.32 11.32.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
          </svg>
          <span className="font-semibold" style={{ fontSize: '14px' }}>Xeno Assistant</span>
        </div>
        <button className="btn-remove" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>
      </div>

      {/* Body */}
      <div className="ai-panel-body" ref={chatBodyRef}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div 
              className={`ai-chat-bubble ${msg.sender === 'user' ? 'ai-chat-bubble-user' : ''}`}
              style={{ whiteSpace: 'pre-wrap', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}
            >
              {msg.text}
              {msg.humanSummary && (
                <div style={{ 
                  marginTop: '8px', 
                  padding: '8px 10px', 
                  background: 'rgba(124,58,237,0.1)', 
                  borderRadius: '6px', 
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--primary-hover)',
                }}>
                  {msg.humanSummary}
                </div>
              )}
            </div>
            {msg.actionType === 'segment' && (
              <button 
                className="btn btn-primary btn-sm"
                style={{ width: 'fit-content', alignSelf: 'flex-start' }}
                onClick={() => handleApplySegment(msg.actionPayload)}
              >
                Open in Segment Builder →
              </button>
            )}
            {msg.actionType === 'campaign' && (
              <button 
                className="btn btn-primary btn-sm"
                style={{ width: 'fit-content', alignSelf: 'flex-start' }}
                onClick={() => handleApplyCampaign(msg.actionPayload)}
              >
                Open in Campaign Creator →
              </button>
            )}
          </div>
        ))}

        {loading && (
          <div className="ai-chat-bubble" style={{ alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <span className="thinking-dot"></span>
              <span className="thinking-dot"></span>
              <span className="thinking-dot"></span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="ai-panel-footer">
        <input 
          type="text" 
          className="form-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
          placeholder="Ask Xeno Assistant..." 
          style={{ flexGrow: 1, marginBottom: 0 }}
          disabled={loading}
        />
        <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </aside>
  );
};

export default AIDrawer;
