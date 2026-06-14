import React, { useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';

interface PremiumGlassCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  glowColor?: string;
  gradientTopBorder?: boolean;
}

export const PremiumGlassCard: React.FC<PremiumGlassCardProps> = ({ 
  children, 
  className = '', 
  style,
  glowColor = 'rgba(99, 102, 241, 0.1)',
  gradientTopBorder = false 
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`premium-glass-card ${className}`}
      style={{
        ...style,
        '--spotlight-color': glowColor,
      } as React.CSSProperties}
    >
      {gradientTopBorder && <div className="premium-glass-top-border" />}
      {children}
    </div>
  );
};
