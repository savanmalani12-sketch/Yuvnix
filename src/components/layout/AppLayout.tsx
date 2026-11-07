import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { ConfigurationBanner } from '@/components/common/ConfigurationBanner';
import { UsernameModal } from '@/components/common/UsernameModal';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      {/* Dev Configuration Banner (if credentials pending) */}
      <ConfigurationBanner />

      {/* Top Header */}
      <Header />

      {/* Username Setup Prompt for New Users */}
      <UsernameModal />

      {/* Main Page Slot (pb-20 on mobile to leave clearance for bottom nav) */}
      <div className="flex-1 pb-20 md:pb-8">
        <Outlet />
      </div>

      {/* Mobile-First Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};
