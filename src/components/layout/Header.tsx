import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '@/components/common/BrandLogo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/utils/formatters';
import {
  Building2,
  ShoppingCart,
  Car,
  LogIn,
  LogOut,
  PlusCircle,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { user, profile, isAuthenticated, signInWithGoogle, signOut } = useAuth();
  const location = useLocation();

  const navLinks = [
    { label: 'Communities', path: '/communities', icon: Building2 },
    { label: 'Group Carts', path: '/carts', icon: ShoppingCart },
    { label: 'Shared Rides', path: '/rides', icon: Car },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md transition-all">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 group transition-transform active:scale-95">
          <BrandLogo size="md" showTagline={false} />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Action Controls / Auth Status */}
        <div className="flex items-center gap-2.5">
          <Link to="/communities/request">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold"
            >
              <PlusCircle className="w-3.5 h-3.5 text-primary" />
              <span>Request Community</span>
            </Button>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="flex items-center gap-2 group">
                <Avatar className="w-8 h-8">
                  {profile?.avatar_url && (
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  )}
                  <AvatarFallback>
                    {getInitials(profile?.full_name || user?.email || 'Student')}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary leading-tight">
                    {profile?.full_name || 'My Profile'}
                  </span>
                  {profile?.username && (
                    <span className="text-[10px] text-muted-foreground font-mono leading-tight">
                      @{profile.username}
                    </span>
                  )}
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                title="Sign out"
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => signInWithGoogle()}
              size="sm"
              className="gap-1.5 font-semibold shadow-card"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
