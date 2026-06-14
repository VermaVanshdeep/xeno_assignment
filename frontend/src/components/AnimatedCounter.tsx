import React, { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  format?: 'currency' | 'number' | 'percent';
  formatter?: (v: number) => string;
  duration?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, format = 'number', formatter, duration = 1.5 }) => {
  const [displayValue, setDisplayValue] = useState<string>('0');

  useEffect(() => {
    const controls = animate(0, value, {
      duration: duration,
      ease: "easeOut",
      onUpdate(v) {
        let formatted = '';
        if (formatter) {
          formatted = formatter(v);
        } else if (format === 'currency') {
          if (v >= 10000000) formatted = `₹${(v / 10000000).toFixed(1)} Cr`;
          else if (v >= 100000) formatted = `₹${(v / 100000).toFixed(1)} L`;
          else formatted = `₹${Math.floor(v).toLocaleString('en-IN')}`;
        } else if (format === 'percent') {
          formatted = `${v.toFixed(1)}%`;
        } else {
          formatted = Math.floor(v).toLocaleString();
        }
        setDisplayValue(formatted);
      }
    });

    return () => controls.stop();
  }, [value, format, duration]);

  return <span>{displayValue}</span>;
};
