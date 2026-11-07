import React, { useState, useEffect } from 'react';
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
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  ShoppingCart,
  Clock,
  Store,
  MapPin,
  Loader2,
  Sparkles,
  AlertCircle,
  Building2,
  CheckCircle2,
  IndianRupee,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface JoinedCommunity {
  id: string;
  name: string;
  general_area: string | null;
}

interface CreateCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCartCreated: () => void;
  userCommunities: JoinedCommunity[];
}

const QUICK_PRESETS = [
  { label: '⚡ Zepto Snacks', title: 'Zepto Midnight Snacks', store: 'Zepto', mins: 25, host: 120, threshold: 199 },
  { label: '🟡 Blinkit Essentials', title: 'Blinkit Quick Delivery', store: 'Blinkit', mins: 30, host: 100, threshold: 199 },
  { label: '🟠 Instamart Munchies', title: 'Swiggy Instamart Order', store: 'Instamart', mins: 30, host: 130, threshold: 199 },
  { label: '☕ Chai & Biscuits', title: 'Chai & Snacks Run', store: 'Local Store', mins: 20, host: 50, threshold: 100 },
];

const DURATION_OPTIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

export const CreateCartModal: React.FC<CreateCartModalProps> = ({
  isOpen,
  onClose,
  onCartCreated,
  userCommunities,
}) => {
  const { user } = useAuth();
  const [communityId, setCommunityId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [storeName, setStoreName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [hostAmount, setHostAmount] = useState<string>('120');
  const [freeDeliveryGoal, setFreeDeliveryGoal] = useState<string>('199');
  const [pickupNotes, setPickupNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default community when modal opens or userCommunities load
  useEffect(() => {
    if (userCommunities.length > 0 && !communityId) {
      setCommunityId(userCommunities[0].id);
    }
  }, [userCommunities, communityId]);

  const calculateLockTime = (mins: number) => {
    const d = new Date(Date.now() + mins * 60 * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handlePresetSelect = (preset: typeof QUICK_PRESETS[0]) => {
    setTitle(preset.title);
    setStoreName(preset.store);
    setDurationMinutes(preset.mins);
    setHostAmount(preset.host.toString());
    setFreeDeliveryGoal(preset.threshold.toString());
  };

  const hostNum = parseFloat(hostAmount) || 0;
  const targetNum = parseFloat(freeDeliveryGoal) || 0;
  const remainingForFree = Math.max(0, targetNum - hostNum);
  const progressPercent = targetNum > 0 ? Math.min(100, Math.round((hostNum / targetNum) * 100)) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('You must be signed in to create a cart.');
      return;
    }

    if (!communityId) {
      setError('Please select a residence community.');
      return;
    }

    if (!title.trim() || title.trim().length < 3) {
      setError('Order title must be at least 3 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const lockAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

      const { error: insertError } = await supabase
        .from('group_carts')
        .insert({
          community_id: communityId,
          created_by_user_id: user.id,
          title: title.trim(),
          store_name: storeName.trim() || null,
          lock_at: lockAt,
          pickup_instructions: pickupNotes.trim() || 'Meet at residence entrance/gate',
          status: 'open',
          host_initial_amount: hostNum,
          target_amount: targetNum > 0 ? targetNum : null,
          total_estimated_amount: hostNum,
        });

      if (insertError) {
        throw insertError;
      }

      // Reset form and notify parent
      setTitle('');
      setStoreName('');
      setPickupNotes('');
      setDurationMinutes(30);
      setHostAmount('120');
      setFreeDeliveryGoal('199');
      onCartCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create group cart';
      console.error('[CreateCart] Error creating cart:', err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Start a Group Cart</DialogTitle>
              <DialogDescription className="text-xs">
                Pool orders with neighbors to hit the store minimum and unlock ₹0 free delivery.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {userCommunities.length === 0 ? (
          <div className="py-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold">No Residence Joined Yet</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Group grocery carts are scoped to physical living spaces. You must join a residence before starting an order.
              </p>
            </div>
            <Link to="/communities" onClick={onClose}>
              <Button size="sm" className="font-semibold gap-1.5 mt-2">
                <Building2 className="w-4 h-4" />
                <span>Browse &amp; Join Residences</span>
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Quick Presets
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground transition-all"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Community Residence Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="cart_community" className="text-xs font-semibold">
                Residence Community <span className="text-destructive">*</span>
              </Label>
              <select
                id="cart_community"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                {userCommunities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.general_area ? `(${c.general_area})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Title */}
            <div className="space-y-1.5">
              <Label htmlFor="cart_title" className="text-xs font-semibold">
                Order Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cart_title"
                placeholder="e.g. Zepto Midnight Snacks, Blinkit Groceries"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 text-xs"
                required
              />
            </div>

            {/* Store Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cart_store" className="text-xs font-semibold flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-primary" />
                  <span>Store / App Name</span>
                </Label>
                <span className="text-[10px] text-muted-foreground">Optional</span>
              </div>
              <Input
                id="cart_store"
                placeholder="e.g. Zepto, Blinkit, Instamart, DMart"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            {/* Free Delivery Goals: Host Initial Amount + Target Threshold */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Free Delivery Target</span>
                </span>
                {remainingForFree === 0 ? (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Free Delivery Met!
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    ₹{remainingForFree} remaining
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="host_amount" className="text-[11px] font-semibold text-muted-foreground">
                    Your Order (₹) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="host_amount"
                    type="number"
                    min="0"
                    placeholder="120"
                    value={hostAmount}
                    onChange={(e) => setHostAmount(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="delivery_goal" className="text-[11px] font-semibold text-muted-foreground">
                    Free Delivery Threshold (₹)
                  </Label>
                  <Input
                    id="delivery_goal"
                    type="number"
                    min="0"
                    placeholder="199"
                    value={freeDeliveryGoal}
                    onChange={(e) => setFreeDeliveryGoal(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Progress bar preview */}
              {targetNum > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        remainingForFree === 0 ? 'bg-emerald-500' : 'bg-primary'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                    <span>You: ₹{hostNum}</span>
                    <span>
                      {remainingForFree > 0
                        ? `₹${remainingForFree} more needed from neighbors`
                        : 'Goal unlocked! 🎉'}
                    </span>
                    <span>Goal: ₹{targetNum}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Lock Duration Timer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cart Closes In</span>
                </Label>
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Locks at {calculateLockTime(durationMinutes)}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d.minutes}
                    type="button"
                    onClick={() => setDurationMinutes(d.minutes)}
                    className={`py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                      durationMinutes === d.minutes
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Once locked, no new items can be added so you can place the final store order.
              </p>
            </div>

            {/* Pickup Instructions */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pickup_notes" className="text-xs font-semibold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Pickup Spot Instructions</span>
                </Label>
                <span className="text-[10px] text-muted-foreground">Optional</span>
              </div>
              <Input
                id="pickup_notes"
                placeholder="e.g. Meet at Main Entrance / Gate 1 security desk"
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs font-semibold gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Cart...</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Start Group Cart</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
