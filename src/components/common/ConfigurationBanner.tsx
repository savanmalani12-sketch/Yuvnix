import React from 'react';
import { isSupabaseConfigured } from '@/utils/env';
import { AlertCircle, ExternalLink } from 'lucide-react';

export const ConfigurationBanner: React.FC = () => {
  if (isSupabaseConfigured()) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Local Dev Setup:</strong> Supabase credentials not detected. Copy{' '}
            <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded font-mono text-[11px]">
              .env.example
            </code>{' '}
            to{' '}
            <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded font-mono text-[11px]">
              .env
            </code>{' '}
            to connect your real backend.
          </span>
        </div>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 hover:underline shrink-0"
        >
          Supabase Dashboard <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
