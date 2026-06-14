import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface PortalTooltipProps {
  active: boolean;
  targetRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

export const PortalTooltip: React.FC<PortalTooltipProps> = ({ active, targetRef, children }) => {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (active && targetRef.current) {
      const rect = targetRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY - 8, // Spacing above the card
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }
  }, [active, targetRef]);

  if (!active || !coords) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'absolute',
        top: coords.top,
        left: coords.left,
        transform: 'translate(-50%, -100%)',
        zIndex: 99999,
        pointerEvents: 'none',
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
        color: '#FFFFFF',
        width: 'max-content',
        maxWidth: '260px',
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
