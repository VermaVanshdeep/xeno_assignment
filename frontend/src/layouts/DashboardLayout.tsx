import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AIDrawer from '../components/AIDrawer';
import AIButton from '../components/AIButton';

export const DashboardLayout: React.FC = () => {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const location = useLocation();

  // Map pathnames to human readable page titles
  const getPageTitle = (path: string): string => {
    switch (path) {
      case '/':
        return 'Dashboard';
      case '/customers':
        return 'Customers';
      case '/segments':
        return 'Segments';
      case '/campaigns':
        return 'Campaigns';
      case '/copilot':
        return 'Xeno Assistant';
      case '/analytics':
        return 'Analytics';
      default:
        return 'Xeno CRM';
    }
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main content wrapper */}
      <div className="main-wrapper">
        {/* Top bar with dynamic title and AI Trigger button */}
        <Topbar 
          title={pageTitle}
          actions={
            <div className="flex align-center gap-3">
              <button 
                type="button" 
                className="btn btn-sm"
                onClick={() => window.location.reload()}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: '4px' }}>
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Sync
              </button>

              <AIButton onClick={() => setIsAiOpen(true)} />
            </div>
          }
        />

        {/* Scrollable page body */}
        <section className="main-content">
          <div className="content-container">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </div>

      {/* Slide-out AI Panel */}
      <AIDrawer isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </div>
  );
};
export default DashboardLayout;
