import React from 'react';

export type ProgressVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  sublabel?: string;
  variant?: ProgressVariant;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  value, 
  label, 
  sublabel, 
  variant = 'primary', 
  className = '' 
}) => {
  const percent = Math.min(Math.max(value, 0), 100);

  const fillClasses = {
    primary: 'fill-primary',
    success: 'fill-success',
    warning: 'fill-warning',
    danger: 'fill-danger',
    info: 'fill-info'
  };

  return (
    <div className={`progress-container ${className}`}>
      {(label || sublabel) && (
        <div className="progress-header">
          {label && <span className="text-label" style={{ color: 'var(--text-muted)' }}>{label}</span>}
          {sublabel && <span className="text-label" style={{ color: 'var(--text-primary)' }}>{sublabel}</span>}
        </div>
      )}
      <div className="progress-bar-track">
        <div 
          className={`progress-bar-fill ${fillClasses[variant]}`} 
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
};
export default ProgressBar;
