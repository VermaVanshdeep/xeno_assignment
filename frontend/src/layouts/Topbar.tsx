import React from 'react';

interface TopbarProps {
  title: string;
  actions?: React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({ title, actions }) => {
  return (
    <header className="top-bar">
      <h1 className="top-bar-title">{title}</h1>
      <div className="top-bar-actions">
        {actions}
      </div>
    </header>
  );
};
export default Topbar;
