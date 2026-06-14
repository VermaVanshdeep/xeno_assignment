import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onClick,
  icon,
  className = ''
}) => {
  const defaultIcon = (
    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );

  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state-icon">
        {icon || defaultIcon}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {actionLabel && onClick && (
        <button 
          type="button" 
          className="btn btn-primary btn-sm"
          onClick={onClick}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
export default EmptyState;
