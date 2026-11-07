import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Loader2 } from 'lucide-react';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error exchanging OAuth session:', error.message);
      }
      if (session) {
        navigate('/', { replace: true });
      } else {
        // Fallback if no immediate session is captured
        const timer = setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
        return () => clearTimeout(timer);
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-spin">
        <Loader2 className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Completing Sign In...</h2>
        <p className="text-xs text-muted-foreground">Connecting your student profile with Yuvnix</p>
      </div>
    </div>
  );
};
