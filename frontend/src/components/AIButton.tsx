import React from 'react';

interface AIButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  disabled?: boolean;
}

export const AIButton: React.FC<AIButtonProps> = ({ 
  onClick, 
  className = '', 
  disabled = false 
}) => {
  return (
    <div className={`ai-button-wrapper ${className}`} style={{ pointerEvents: disabled ? 'none' : 'auto', opacity: disabled ? 0.6 : 1 }}>
      <button 
        type="button" 
        className="ai-button" 
        onClick={onClick}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.32 11.32l.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
        </svg>
        Xeno Assistant
      </button>
    </div>
  );
};
export default AIButton;
