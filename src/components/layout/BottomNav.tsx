import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Building2, ShoppingCart, Car, User } from 'lucide-react';
import { cn } from '@/utils/cn';

export const BottomNav: React.FC = () => {
  const tabs = [
    { label: 'Home', path: '/', icon: Home, end: true },
    { label: 'Hostels & PGs', path: '/communities', icon: Building2 },
    { label: 'Carts', path: '/carts', icon: ShoppingCart },
    { label: 'Rides', path: '/rides', icon: Car },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-lg border-t border-border/80 safe-area-bottom">
      <div className="grid grid-cols-5 h-16 items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center py-1 transition-all duration-150 active:scale-90',
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground font-medium'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={cn(
                      'p-1 rounded-xl transition-all',
                      isActive && 'bg-primary/10'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
