import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface PortalTooltipProps {
  active: boolean;
  targetRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

export const PortalTooltip: React.FC<PortalTooltipProps> = ({ active, targetRef, children }) => {
  const [coords, setCoords] = useState<{ top: number; left: number; below: boolean } | null>(null);

  useEffect(() => {
    if (active && targetRef.current) {
      const rect = targetRef.current.getBoundingClientRect();
      const TOOLTIP_WIDTH = 260;
      const MARGIN = 10;

      // Use viewport (fixed) coords
      const below = rect.top < 140;
      const topPos = below ? rect.bottom + MARGIN : rect.top - MARGIN;

      // Horizontal: centre on card, clamp to viewport
      let leftPos = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      leftPos = Math.max(MARGIN, Math.min(leftPos, window.innerWidth - TOOLTIP_WIDTH - MARGIN));

      setCoords({ top: topPos, left: leftPos, below });
    }
  }, [active, targetRef]);

  if (!active || !coords) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        transform: coords.below ? 'translateY(0)' : 'translateY(-100%)',
        zIndex: 99999,
        pointerEvents: 'none',
        background: 'rgba(11, 17, 35, 0.97)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius: '14px',
        padding: '14px 18px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(79,140,255,0.08)',
        color: '#FFFFFF',
        width: '260px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        opacity: active ? 1 : 0,
        transition: 'opacity 150ms ease-in-out',
        animation: 'portalTooltipFadeIn 150ms ease-out forwards',
      }}
    >
      <style>{`
        @keyframes portalTooltipFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      {children}
    </div>,
    document.body
  );
};

export default PortalTooltip;
