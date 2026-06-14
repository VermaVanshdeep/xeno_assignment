import React from 'react';

export type ChannelType = 'whatsapp' | 'sms' | 'email' | 'rcs';

interface ChannelTagProps {
  channel: ChannelType;
  className?: string;
}

export const ChannelTag: React.FC<ChannelTagProps> = ({ channel, className = '' }) => {
  const normalizedChannel = channel.toLowerCase() as ChannelType;

  const config = {
    whatsapp: {
      label: 'WhatsApp',
      className: 'channel-tag-whatsapp',
      svg: (
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.73.44 3.35 1.22 4.78L2 22l5.35-1.37C8.74 21.39 10.32 21.82 12 21.82c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
        </svg>
      )
    },
    sms: {
      label: 'SMS',
      className: 'channel-tag-sms',
      svg: (
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
      )
    },
    email: {
      label: 'Email',
      className: 'channel-tag-email',
      svg: (
        <svg viewBox="0 0 24 24">
          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" />
        </svg>
      )
    },
    rcs: {
      label: 'RCS',
      className: 'channel-tag-rcs',
      svg: (
        <svg viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    }
  };

  const activeConfig = config[normalizedChannel] || config.email;

  return (
    <span className={`channel-tag ${activeConfig.className} ${className}`}>
      {activeConfig.svg}
      {activeConfig.label}
    </span>
  );
};
