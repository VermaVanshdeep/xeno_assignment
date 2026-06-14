import React from 'react';

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  format?: 'currency' | 'number';
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, format = 'number' }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(6, 10, 22, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
        color: '#F1F5F9',
        minWidth: '150px'
      }}>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '8px', fontWeight: 600 }}>{label}</div>
        {payload.map((entry, index) => {
          let formattedValue = entry.value;
          if (format === 'currency') {
             formattedValue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(entry.value);
          } else {
             formattedValue = entry.value.toLocaleString();
          }

          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}` }} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#CBD5E1' }}>{entry.name}</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 700, marginLeft: '12px' }}>{formattedValue}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};
