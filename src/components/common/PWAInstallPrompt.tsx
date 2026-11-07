import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Share2, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already running in standalone / installed PWA mode
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(Boolean(standaloneMode));

    // Check if user dismissed recently
    const dismissedTime = localStorage.getItem('yuvnix_pwa_dismissed');
    if (dismissedTime && Date.now() - parseInt(dismissedTime, 10) < 3 * 24 * 60 * 60 * 1000) {
      setIsDismissed(true);
    }

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios/.test(userAgent);
    setIsIOS(isAppleDevice);

    // Listen for Chrome / Android / Edge install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        setShowIOSInstructions(true);
      }
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsStandalone(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('yuvnix_pwa_dismissed', Date.now().toString());
  };

  // If already installed or dismissed, hide banner
  if (isStandalone || isDismissed) {
    return null;
  }

  // Only show if deferredPrompt is ready or on iOS
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="p-4 rounded-2xl bg-card/95 backdrop-blur-md border-2 border-primary/30 shadow-elevated text-foreground space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-brand-violet text-white flex items-center justify-center shrink-0 shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6"
              >
                <circle cx="9" cy="8" r="2.5" />
                <circle cx="17" cy="8" r="2.5" />
                <path d="M4 19a5 5 0 0 1 10 0" />
                <path d="M14 19a5 5 0 0 1 6-4" />
                <path d="M12 11v4" />
                <path d="M9 15h6" />
              </svg>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold">Install Yuvnix App</h4>
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Install directly on your phone for full-screen mode, faster speeds, and ride notifications.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showIOSInstructions ? (
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs space-y-1.5 text-foreground">
            <p className="font-semibold flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-primary shrink-0" />
              <span>To install on iPhone / iPad:</span>
            </p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-0.5 text-[11px]">
              <li>Tap the <strong>Share</strong> button at the bottom of Safari.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> in the top-right corner.</li>
            </ol>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              size="sm"
              onClick={handleInstallClick}
              className="flex-1 font-semibold gap-1.5 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>{isIOS ? 'How to Install on iOS' : 'Install to Home Screen'}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-xs text-muted-foreground"
            >
              Not Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
