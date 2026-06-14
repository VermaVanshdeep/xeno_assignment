import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonLoaderProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = '6px',
  className = '',
  style
}) => {
  return (
    <div 
      className={`skeleton-loader ${className}`}
      style={{
        width,
        height,
        borderRadius,
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.03)',
        ...style
      }}
    >
      <motion.div
        animate={{ x: ['-100%', '200%'] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent)',
        }}
      />
    </div>
  );
};
