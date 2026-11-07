import React from 'react';
import { cn } from '@/utils/cn';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showTagline = false,
  className,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      {/* Dynamic Geometric Community Hub Emblem */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-brand-violet text-white shadow-card shadow-primary/20 shrink-0',
          iconSizes[size]
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3/5 h-3/5"
        >
          {/* Interlocking nodes representing community, shared rides & group orders */}
          <circle cx="9" cy="8" r="2.5" />
          <circle cx="17" cy="8" r="2.5" />
          <path d="M4 19a5 5 0 0 1 10 0" />
          <path d="M14 19a5 5 0 0 1 6-4" />
          <path d="M12 11v4" />
          <path d="M9 15h6" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center tracking-tight">
          <span className={cn('font-extrabold font-sans text-foreground', textSizes[size])}>
            Yuv<span className="text-primary font-black">nix</span>
          </span>
          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary" />
        </div>
        {showTagline && (
          <span className="text-[11px] font-medium text-muted-foreground -mt-0.5 tracking-wide">
            Your people. Your community.
          </span>
        )}
      </div>
    </div>
  );
};
