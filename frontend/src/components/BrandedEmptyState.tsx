import React from 'react';

interface BrandedEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const BrandedEmptyState: React.FC<BrandedEmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '60px 24px',
      background: 'rgba(255, 255, 255, 0.01)',
      border: '1px dashed rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      height: '100%'
    }}>
      {icon ? (
        <div style={{ width: '48px', height: '48px', color: '#64748B', marginBottom: '16px', opacity: 0.8 }}>
          {icon}
        </div>
      ) : (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.8 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#F1F5F9', marginBottom: '8px' }}>{title}</h3>
      <p style={{ fontSize: '13px', color: '#94A3B8', maxWidth: '300px', lineHeight: 1.5, marginBottom: actionText ? '24px' : '0' }}>{description}</p>
      
      {actionText && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
};
