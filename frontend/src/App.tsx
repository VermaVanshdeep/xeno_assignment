import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Segments from './pages/Segments';
import Campaigns from './pages/Campaigns';
import AICopilot from './pages/AICopilot';
import Analytics from './pages/Analytics';
import Login from './pages/Login';

const ProtectedRoute: React.FC = () => {
  const isAuthenticated = !!localStorage.getItem("xeno_auth");
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const card = target.closest('.card, .stat-card, .dashboard-card, .kpi-card');
      if (card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        (card as HTMLElement).style.setProperty('--mouse-x', `${x}px`);
        (card as HTMLElement).style.setProperty('--mouse-y', `${y}px`);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <Router>
      <Routes>
        {/* Login Page outside Layout */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes wrapper */}
        <Route element={<ProtectedRoute />}>
          {/* Layout wrapper */}
          <Route path="/" element={<DashboardLayout />}>
            {/* Sub-routing views */}
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="segments" element={<Segments />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="copilot" element={<AICopilot />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
