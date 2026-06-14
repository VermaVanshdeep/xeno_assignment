import React from 'react';

interface AvatarInitialsProps {
  name: string;
  size?: 'sm' | 'lg';
  className?: string;
}

export const AvatarInitials: React.FC<AvatarInitialsProps> = ({ 
  name, 
  size = 'sm', 
  className = '' 
}) => {
  
  // Deterministic HSL hashing function based on djb2
  const stringToColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    const saturation = 55 + (Math.abs(hash) % 20); // 55% - 75%
    const lightness = 40 + (Math.abs(hash) % 15);   // 40% - 55%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const getInitials = (fullName: string): string => {
    if (!fullName) return '??';
    const cleanName = fullName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = cleanName.split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);
  const backgroundColor = stringToColor(name);

  const sizeClass = size === 'lg' ? 'avatar-initials-lg' : '';

  return (
    <div 
      className={`avatar-initials ${sizeClass} ${className}`}
      style={{ backgroundColor }}
      title={name}
    >
      {initials}
    </div>
  );
};
export default AvatarInitials;
