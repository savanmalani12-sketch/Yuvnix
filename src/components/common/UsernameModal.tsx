import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AtSign, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export const UsernameModal: React.FC = () => {
  const { user, profile, isAuthenticated, refreshProfile } = useAuth();
  const [usernameInput, setUsernameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Show modal only when authenticated and username is not yet set
  const isOpen = Boolean(isAuthenticated && user && profile && !profile.username);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmed = usernameInput.trim().toLowerCase();

    // Client-side regex format validation: 3-20 chars alphanumeric + underscore
    if (!/^[a-z0-9_]{3,20}$/.test(trimmed)) {
      setErrorMessage('Username must be 3–20 characters long and contain only letters, numbers, and underscores.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: trimmed })
        .eq('id', user.id);

      if (error) {
        // Postgres unique violation code
        if (error.code === '23505' || error.message.toLowerCase().includes('duplicate') || error.message.toLowerCase().includes('unique')) {
          setErrorMessage(`@${trimmed} is already taken by another student. Please choose a different handle.`);
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      // Successfully saved! Refresh profile context
      await refreshProfile();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set username';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold">Choose Your Student Username</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Welcome to Yuvnix! Every student residence member has a unique @handle used in campus group carts and shared taxi rides.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs font-semibold">
              Unique Student Handle
            </Label>
            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  setErrorMessage(null);
                }}
                placeholder="e.g. savan_m, dev_pdeu"
                className="pl-9 font-mono text-sm"
                maxLength={20}
                autoFocus
                required
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              3 to 20 characters (letters, numbers, underscores). Unique across campus.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              className="w-full font-semibold gap-2"
              disabled={isSubmitting || usernameInput.trim().length < 3}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking & Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Claim Handle & Continue</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
