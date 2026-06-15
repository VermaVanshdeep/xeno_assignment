import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useApi from '../hooks/useApi';
import { 
  previewSegment, 
  createSegment, 
  listSegments,
  fetchCustomerAnalytics
} from '../services/api';
import type { SegmentRule, ConditionRule, SegmentPreviewResponse } from '../services/api';
import DataTable from '../components/DataTable';
import { BrandedEmptyState } from '../components/BrandedEmptyState';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface BuilderCondition {
  id: string;
  field: 'totalSpend' | 'totalOrders' | 'city' | 'categoryPurchased' | 'daysSinceLastPurchase';
  operator: '>' | '<' | '=' | '!=' | 'contains';
  value: string;
}

/* ────────────────────────────────────────────────────────
   1. EXTRACTED SAVE FORM (Isolates typing state for Segment Name/Desc)
   ──────────────────────────────────────────────────────── */
interface SaveSegmentFormProps {
  onSave: (name: string, description: string) => Promise<void>;
  saveSuccess: boolean;
  saveError: string | null;
}

const SaveSegmentForm: React.FC<SaveSegmentFormProps> = React.memo(({ onSave, saveSuccess, saveError }) => {
  const [segmentName, setSegmentName] = useState('');
  const [segmentDesc, setSegmentDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segmentName.trim()) return;
    setSubmitting(true);
    try {
      await onSave(segmentName, segmentDesc);
      setSegmentName('');
      setSegmentDesc('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
      <h4 className="font-semibold" style={{ marginBottom: '10px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Save Group Definition</h4>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '9px' }}>Group Name</label>
            <input 
              type="text" 
              className="form-input"
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              placeholder="e.g. Mumbai Spenders"
              required
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '9px' }}>Description</label>
            <input 
              type="text" 
              className="form-input"
              value={segmentDesc}
              onChange={(e) => setSegmentDesc(e.target.value)}
              placeholder="Describe segment profile"
            />
          </div>
        </div>
        {saveError && <p style={{ color: 'var(--danger)', fontSize: '12px' }}>{saveError}</p>}
        {saveSuccess && <p style={{ color: 'var(--success)', fontSize: '12px' }}>✓ Segment saved successfully!</p>}
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ width: 'fit-content', alignSelf: 'flex-end' }}>
          {submitting ? 'Saving...' : 'Save Cohort Group'}
        </button>
      </form>
    </div>
  );
});

/* ────────────────────────────────────────────────────────
   2. MAIN SEGMENTS COMPONENT
   ──────────────────────────────────────────────────────── */
export const Segments: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { data: savedSegments, loading: loadingSegments, refetch: refetchSegments } = useApi(listSegments);
  const { data: customerData } = useApi(fetchCustomerAnalytics);

  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<BuilderCondition[]>([
    { id: '1', field: 'totalSpend', operator: '>', value: '5000' }
  ]);

  const [previewData, setPreviewData] = useState<SegmentPreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fieldDisplayNames = useMemo(() => ({
    totalSpend: 'Total Spend (₹)',
    totalOrders: 'Total Orders',
    city: 'City',
    categoryPurchased: 'Category Purchased',
    daysSinceLastPurchase: 'Days Since Last Purchase',
  }), []);

  const getCompiledRule = useCallback((): SegmentRule => {
    return {
      type: 'group',
      logic,
      children: conditions.map(c => {
        const isNumeric = ['totalSpend', 'totalOrders', 'daysSinceLastPurchase'].includes(c.field);
        return {
          type: 'condition',
          field: c.field,
          operator: c.operator,
          value: isNumeric ? Number(c.value) : c.value
        } as ConditionRule;
      })
    };
  }, [logic, conditions]);

  const loadAstIntoBuilder = useCallback((rule: SegmentRule) => {
    if (!rule) return;
    
    if (rule.type === 'condition') {
      setLogic('AND');
      setConditions([{
        id: '1',
        field: rule.field as any,
        operator: rule.operator as any,
        value: String(rule.value)
      }]);
    } else if (rule.type === 'group' && rule.children && Array.isArray(rule.children) && rule.children.every(child => child.type === 'condition')) {
      setLogic(rule.logic || 'AND');
      setConditions(
        rule.children.map((child: any, idx) => ({
          id: String(idx + 1),
          field: child.field,
          operator: child.operator,
          value: String(child.value)
        }))
      );
    }
  }, []);

  const handlePreview = useCallback(async (forcedRule?: SegmentRule) => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const rules = forcedRule || getCompiledRule();
      const res = await previewSegment(rules);
      setPreviewData(res);
    } catch (e: any) {
      setPreviewError(e.message || 'Failed to preview segment');
    } finally {
      setIsPreviewLoading(false);
    }
  }, [getCompiledRule]);

  useEffect(() => {
    const storedRules = sessionStorage.getItem('pendingSegmentRules');
    if (storedRules) {
      try {
        const rule = JSON.parse(storedRules) as SegmentRule;
        sessionStorage.removeItem('pendingSegmentRules');
        loadAstIntoBuilder(rule);
        handlePreview(rule);
        return;
      } catch (e) {
        sessionStorage.removeItem('pendingSegmentRules');
      }
    }

    const state = location.state as { rules?: SegmentRule } | null;
    if (state?.rules) {
      const rule = state.rules;
      loadAstIntoBuilder(rule);
      navigate(location.pathname, { replace: true, state: null });
      handlePreview(rule);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddCondition = useCallback(() => {
    setConditions(prev => [
      ...prev,
      { id: String(prev.length + 1 + Date.now()), field: 'city', operator: '=', value: 'Mumbai' }
    ]);
  }, []);

  const handleRemoveCondition = useCallback((id: string) => {
    setConditions(prev => {
      if (prev.length === 1) return prev;
      return prev.filter(c => c.id !== id);
    });
  }, []);

  const handleConditionChange = useCallback((id: string, key: keyof BuilderCondition, val: string) => {
    setConditions(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, [key]: val };
        if (key === 'field') {
          const isNumeric = ['totalSpend', 'totalOrders', 'daysSinceLastPurchase'].includes(val);
          updated.operator = isNumeric ? '>' : '=';
          updated.value = isNumeric ? '1000' : 'Mumbai';
        }
        return updated;
      }
      return c;
    }));
  }, []);

  const handleSaveSegment = useCallback(async (name: string, description: string) => {
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const rules = getCompiledRule();
      await createSegment(name, description, rules);
      setSaveSuccess(true);
      refetchSegments();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e.message || 'Failed to create segment');
    }
  }, [getCompiledRule, refetchSegments]);

  // Helper variables for calculated preview fields (Memoized)
  const totalCustomers = useMemo(() => customerData?.totalCustomers || 1, [customerData]);
  const matchCount = useMemo(() => previewData?.stats.matchedAudience || 0, [previewData]);
  const matchPercent = useMemo(() => {
    return totalCustomers > 0 ? ((matchCount / totalCustomers) * 100).toFixed(1) : '0.0';
  }, [totalCustomers, matchCount]);

  // Compute stats from stats payload
  const sampleProfiles = useMemo(() => previewData?.preview || [], [previewData]);
  const averageSpendValue = useMemo(() => previewData?.stats.averageOrderValue || 0, [previewData]);
  const averageOrdersValue = useMemo(() => {
    return previewData?.stats.averageOrdersCount !== undefined
      ? Number(previewData.stats.averageOrdersCount).toFixed(1)
      : '0.0';
  }, [previewData]);
  const potentialRevenue = useMemo(() => previewData?.stats.potentialRevenue || 0, [previewData]);
  const topCity = useMemo(() => previewData?.stats.topPerformingCity || '—', [previewData]);
  const cityDistribution = useMemo(() => previewData?.stats.cityDistribution || [], [previewData]);

  const formatPotentialRevenue = useCallback((value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`;
    return `₹${value.toLocaleString('en-IN')}`;
  }, []);

  const savedSegmentsColumns = useMemo(() => [
    { key: 'name', label: 'Segment Name' },
    { key: 'description', label: 'Description' },
    { key: 'createdAt', label: 'Created' },
    { key: 'actions', label: '' },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Saved Segments */}
      <div className="card">
        <div style={{ marginBottom: '12px' }}>
          <h3 className="text-subheading font-semibold">Saved Segment Groups</h3>
          <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>Saved CRM segment filters available for campaigns target selection.</p>
        </div>
        {loadingSegments ? (
          <p className="text-body text-muted">Loading segments...</p>
        ) : (!savedSegments || savedSegments.length === 0) ? (
          <div style={{ padding: '20px' }}>
            <BrandedEmptyState
              title="No Segments Found"
              description="Build a segment below and save it to reuse it in campaigns."
            />
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: '200px' }}>
            <DataTable
              columns={savedSegmentsColumns}
              data={savedSegments}
              renderRow={(item, idx) => (
                <tr key={idx}>
                  <td className="font-semibold">{item.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.description || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button 
                      className="btn btn-sm"
                      onClick={() => { loadAstIntoBuilder(item.rulesJson); handlePreview(item.rulesJson); }}
                    >
                      Load
                    </button>
                  </td>
                </tr>
              )}
            />
          </div>
        )}
      </div>

      {/* Builder + Preview side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Builder */}
        <div className="card">
          <h3 className="text-subheading font-semibold" style={{ marginBottom: '12px' }}>Cohort Filter Logic</h3>

          {/* Logic selector */}
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="text-label" style={{ fontSize: '9px' }}>Match logic</span>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '6px' }}>
              {(['AND', 'OR'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  className="btn btn-sm"
                  style={{ 
                    height: '24px', 
                    fontSize: '11px', 
                    borderRadius: '4px', 
                    border: 'none',
                    background: logic === l ? 'var(--bg-surface-elevated)' : 'transparent',
                    color: logic === l ? 'var(--accent-blue)' : 'var(--text-muted)',
                    fontWeight: logic === l ? '600' : '500'
                  }}
                  onClick={() => setLogic(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Conditions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="condition-row" style={{ display: 'flex', gap: '6px', padding: '6px 10px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                {idx > 0 && (
                  <span className="condition-logic-badge" style={{ textTransform: 'uppercase', top: '-11px' }}>{logic}</span>
                )}
                <select
                  className="form-select"
                  style={{ height: '30px', minHeight: '30px', fontSize: '12px', flexGrow: 1 }}
                  value={cond.field}
                  onChange={(e) => handleConditionChange(cond.id, 'field', e.target.value)}
                >
                  {Object.entries(fieldDisplayNames).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>

                <select
                  className="form-select"
                  style={{ width: '100px', flexShrink: 0, height: '30px', minHeight: '30px', fontSize: '12px' }}
                  value={cond.operator}
                  onChange={(e) => handleConditionChange(cond.id, 'operator', e.target.value)}
                >
                  {['totalSpend', 'totalOrders', 'daysSinceLastPurchase'].includes(cond.field) ? (
                    <>
                      <option value=">">&gt; greater</option>
                      <option value="<">&lt; less</option>
                      <option value="=">= equals</option>
                      <option value="!=">!= not</option>
                    </>
                  ) : (
                    <>
                      <option value="=">= equals</option>
                      <option value="!=">!= not</option>
                      <option value="contains">contains</option>
                    </>
                  )}
                </select>

                <input
                  type="text"
                  className="form-input"
                  style={{ height: '30px', minHeight: '30px', fontSize: '12px', width: '130px' }}
                  value={cond.value}
                  onChange={(e) => handleConditionChange(cond.id, 'value', e.target.value)}
                  placeholder="value"
                />

                <button 
                  type="button" 
                  className="btn-remove"
                  onClick={() => handleRemoveCondition(cond.id)}
                  disabled={conditions.length === 1}
                  style={{ height: '30px', padding: '0 8px' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button type="button" className="btn btn-sm" onClick={handleAddCondition}>
              + Add Rule
            </button>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => handlePreview()}
              disabled={isPreviewLoading}
            >
              {isPreviewLoading ? 'Analyzing...' : 'Execute Preview'}
            </button>
          </div>

          {/* Optimized isolated Save form */}
          <SaveSegmentForm 
            onSave={handleSaveSegment} 
            saveSuccess={saveSuccess} 
            saveError={saveError} 
          />
        </div>
        
        {/* Preview */}
        <div className="card">
          <h3 className="text-subheading font-semibold" style={{ marginBottom: '12px' }}>Audience Preview</h3>
          
          {previewError && (
            <div className="alert-error">{previewError}</div>
          )}

          {isPreviewLoading && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Computing target indices...
            </div>
          )}

          {!previewData && !isPreviewLoading && !previewError && (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', margin: '0 auto 12px auto', color: 'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Execute the cohort preview to calculate match counts, demographics proportion, and profiles attribution.
              </p>
            </div>
          )}

          {previewData && matchCount === 0 && !isPreviewLoading && (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', margin: '0 auto 12px auto', color: 'var(--danger)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.8 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>
                No customers match the selected rules.
              </p>
            </div>
          )}

          {previewData && matchCount > 0 && !isPreviewLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Audience count card */}
              <div className="audience-count-card" style={{ padding: '14px 16px', background: 'var(--bg-surface-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '4px' }}>
                <span className="audience-count-number" style={{ fontSize: '28px', color: 'var(--accent-cyan)' }}>
                  {matchCount.toLocaleString()}
                </span>
                <span className="audience-count-label" style={{ fontSize: '8px' }}>Estimated Target Audience</span>
                
                {/* Progress proportion */}
                <div style={{ width: '100%', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                    <span>Index Match Share</span>
                    <span>{matchPercent}% of database</span>
                  </div>
                  <div className="dist-bar-track" style={{ height: '4px', marginBottom: 0 }}>
                    <div className="dist-bar-fill" style={{ width: `${matchPercent}%`, background: 'var(--accent-cyan)' }}></div>
                  </div>
                </div>
              </div>
  
              {/* Aggregated insights metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '10px 12px' }}>
                <div>
                  <span className="text-label" style={{ fontSize: '7px' }}>Avg Spend Sample</span>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    ₹{averageSpendValue.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-label" style={{ fontSize: '7px' }}>Avg Orders Volume</span>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>
                    {averageOrdersValue} checkouts
                  </span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px', marginTop: '2px' }}>
                  <span className="text-label" style={{ fontSize: '7px' }}>Top Represented City</span>
                  <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--accent-indigo)' }}>
                    {topCity}
                  </span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px', marginTop: '2px' }}>
                  <span className="text-label" style={{ fontSize: '7px' }}>Location Diversity</span>
                  <span style={{ display: 'block', fontSize: '11px', fontWeight: 600 }}>
                    {cityDistribution.length} cities
                  </span>
                </div>
              </div>
  
              {sampleProfiles.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                  <h4 className="form-label" style={{ marginBottom: '6px', fontSize: '9px' }}>Sample Client Profiles</h4>
                  <div className="table-container" style={{ maxHeight: '120px' }}>
                    <DataTable
                      columns={[
                        { key: 'name', label: 'Name' },
                        { key: 'city', label: 'City' },
                      ]}
                      data={sampleProfiles.slice(0, 3)}
                      renderRow={(item, idx) => (
                        <tr key={idx} style={{ height: '24px' }}>
                          <td className="font-semibold" style={{ fontSize: '11px', padding: '4px 8px' }}>{item.firstName} {item.lastName}</td>
                          <td style={{ fontSize: '11px', padding: '4px 8px' }}>{item.city}</td>
                        </tr>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Segment Insights ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Left: Segment KPI Cards */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 className="text-subheading font-semibold">Segment Insights</h3>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>Key metrics for the active cohort filter result.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Matched Audience */}
            <div style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.12)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Matched Audience</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-cyan)', lineHeight: 1 }}>{matchCount.toLocaleString()}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{matchPercent}% of total database</div>
            </div>

            {/* Average Order Value */}
            <div style={{ background: 'rgba(79,140,255,0.06)', border: '1px solid rgba(79,140,255,0.12)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Avg Order Value</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-blue)', lineHeight: 1 }}>₹{averageSpendValue.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{averageOrdersValue} orders avg</div>
            </div>

            {/* Potential Revenue */}
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Potential Revenue</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-emerald)', lineHeight: 1 }}>{formatPotentialRevenue(potentialRevenue)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>AOV × audience size</div>
            </div>

            {/* Top Performing City */}
            <div style={{ background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.12)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Top Performing City</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-indigo)', lineHeight: 1 }}>{topCity}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{cityDistribution[0]?.count || 0} matched profiles</div>
            </div>
          </div>
        </div>

        {/* Right: Interactive Recharts Bar Chart Demographics */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 className="text-subheading font-semibold">Demographic Distribution</h3>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>City breakdown of matched segment audience.</p>
          </div>

          {cityDistribution.length > 0 ? (
            <div style={{ width: '100%', height: 200, marginTop: '8px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="city" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: any, _name: any, props: any) => [`${value} profiles (${props.payload.percentage}%)`, 'Count']}
                    contentStyle={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                    itemStyle={{ color: '#F1F5F9', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {cityDistribution.map((_, index) => {
                      const barColors = ['#4F8CFF', '#7C5CFF', '#22D3EE', '#10B981', '#F59E0B'];
                      return <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', opacity: 0.5 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>Run a preview query to populate demographic distribution.</p>
            </div>
          )}

          {/* Mini insight row */}
          {cityDistribution.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Cities</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{cityDistribution.length}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Top Share</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {cityDistribution[0]?.percentage || 0}%
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Dominant Location</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-emerald)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px', margin: '2px auto 0 auto' }}>
                  {topCity}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Segments;
