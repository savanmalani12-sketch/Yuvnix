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
import { formatCurrency } from '@/utils/formatters';
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
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface JoinedCommunity {
  id: string;
  name: string;
  general_area: string | null;
}

interface HostItemRow {
  id: string;
  name: string;
  qty: number;
  price: string;
  notes: string;
}

interface CreateCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCartCreated: () => void;
  userCommunities: JoinedCommunity[];
  defaultCommunityId?: string;
}

const QUICK_PRESETS = [
  { label: '⚡ Zepto Snacks', title: 'Zepto Midnight Snacks', store: 'Zepto', mins: 25, threshold: '199', defaultItem: 'Chips & Cold Drink', defaultPrice: '80' },
  { label: '🟡 Blinkit Essentials', title: 'Blinkit Quick Delivery', store: 'Blinkit', mins: 30, threshold: '199', defaultItem: 'Milk & Biscuits', defaultPrice: '75' },
  { label: '🟠 Instamart Munchies', title: 'Swiggy Instamart Order', store: 'Instamart', mins: 30, threshold: '199', defaultItem: 'Noodles & Snacks', defaultPrice: '90' },
  { label: '☕ Chai & Snacks', title: 'Chai & Snacks Run', store: 'Local Store', mins: 20, threshold: '100', defaultItem: 'Tea & Toast', defaultPrice: '50' },
];

const DURATION_OPTIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

const THRESHOLD_SUGGESTIONS = ['149', '199', '249', '299', '500'];

export const CreateCartModal: React.FC<CreateCartModalProps> = ({
  isOpen,
  onClose,
  onCartCreated,
  userCommunities,
  defaultCommunityId,
}) => {
  const { user } = useAuth();
  const [communityId, setCommunityId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [storeName, setStoreName] = useState('Zepto');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [freeDeliveryGoal, setFreeDeliveryGoal] = useState<string>('199');
  const [pickupNotes, setPickupNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Host's initial items (Host must add their items first!)
  const [hostItems, setHostItems] = useState<HostItemRow[]>([
    { id: '1', name: '', qty: 1, price: '', notes: '' },
  ]);

  // Set default community when modal opens
  useEffect(() => {
    if (defaultCommunityId) {
      setCommunityId(defaultCommunityId);
    } else if (userCommunities.length > 0 && !communityId) {
      setCommunityId(userCommunities[0].id);
    }
  }, [defaultCommunityId, userCommunities, communityId]);

  const calculateLockTime = (mins: number) => {
    const d = new Date(Date.now() + mins * 60 * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handlePresetSelect = (preset: typeof QUICK_PRESETS[0]) => {
    setTitle(preset.title);
    setStoreName(preset.store);
    setDurationMinutes(preset.mins);
    setFreeDeliveryGoal(preset.threshold);
    if (!hostItems[0].name.trim()) {
      setHostItems([
        { id: '1', name: preset.defaultItem, qty: 1, price: preset.defaultPrice, notes: '' },
      ]);
    }
  };

  const addHostItemRow = () => {
    setHostItems((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', qty: 1, price: '', notes: '' },
    ]);
  };

  const removeHostItemRow = (id: string) => {
    if (hostItems.length <= 1) return;
    setHostItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateHostItemRow = (id: string, field: keyof HostItemRow, value: string | number) => {
    setHostItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Calculations
  const hostItemsTotal = hostItems.reduce((sum, item) => {
    const p = parseFloat(item.price) || 0;
    return sum + p * (item.qty || 1);
  }, 0);

  const targetNum = parseFloat(freeDeliveryGoal) || 0;
  const remainingForFree = Math.max(0, targetNum - hostItemsTotal);
  const progressPercent = targetNum > 0 ? Math.min(100, Math.round((hostItemsTotal / targetNum) * 100)) : 0;

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
      setError('Please provide an order title (e.g. Zepto Midnight Snacks).');
      return;
    }

    // Require host to add their items first!
    const validItems = hostItems.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      setError('Please add at least one item you are ordering to start the group cart pool.');
      return;
    }

    setIsSubmitting(true);

    try {
      const lockAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

      // 1. Create the Group Cart with initial host amount and free delivery target
      const { data: newCart, error: insertCartError } = await supabase
        .from('group_carts')
        .insert({
          community_id: communityId,
          created_by_user_id: user.id,
          title: title.trim(),
          store_name: storeName.trim() || 'Store',
          lock_at: lockAt,
          pickup_instructions: pickupNotes.trim() || 'Meet at residence entrance/gate',
          status: 'open',
          host_initial_amount: hostItemsTotal,
          target_amount: targetNum > 0 ? targetNum : null,
          total_estimated_amount: hostItemsTotal,
        })
        .select('id')
        .single();

      if (insertCartError) {
        throw insertCartError;
      }

      // 2. Ensure creator is registered as participant
      await supabase
        .from('cart_participants')
        .upsert(
          { cart_id: newCart.id, user_id: user.id },
          { onConflict: 'cart_id,user_id', ignoreDuplicates: true }
        );

      // 3. Immediately insert host's initial items into cart_items
      const itemsPayload = validItems.map((it) => ({
        cart_id: newCart.id,
        added_by_user_id: user.id,
        item_name: it.name.trim(),
        quantity: Math.max(1, it.qty),
        unit_price_estimate: it.price ? parseFloat(it.price) : null,
        notes: it.notes.trim() || null,
      }));

      const { error: itemsError } = await supabase.from('cart_items').insert(itemsPayload);
      if (itemsError) {
        console.warn('Could not insert host initial items:', itemsError.message);
      }

      // Reset form and notify parent
      setTitle('');
      setStoreName('Zepto');
      setPickupNotes('');
      setDurationMinutes(30);
      setFreeDeliveryGoal('199');
      setHostItems([{ id: '1', name: '', qty: 1, price: '', notes: '' }]);
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
      <DialogContent className="max-w-lg p-6 sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Start a Group Cart</DialogTitle>
              <DialogDescription className="text-xs">
                Add your items first and set the store minimum so neighbors can pool together for ₹0 free delivery.
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
                Group grocery carts belong to physical living spaces. Please join your hostel or PG first!
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
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Presets */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Quick Presets
              </span>
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

            {/* Residence Community */}
            <div className="space-y-1">
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

            {/* Title & Store */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="cart_title" className="text-xs font-semibold">
                  Order Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cart_title"
                  placeholder="e.g. Zepto Snacks"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cart_store" className="text-xs font-semibold flex items-center gap-1">
                  <Store className="w-3 h-3 text-primary" />
                  <span>Store / App</span>
                </Label>
                <Input
                  id="cart_store"
                  placeholder="e.g. Zepto, Blinkit"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
            </div>

            {/* Step 1: Free Delivery Goal */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="free_delivery_goal" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Free Delivery Minimum (₹) <span className="text-destructive">*</span></span>
                </Label>
                <span className="text-[10px] text-muted-foreground">Store threshold</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                At what total cart amount does {storeName || 'the store'} give free delivery?
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="free_delivery_goal"
                  type="number"
                  min="1"
                  placeholder="199"
                  value={freeDeliveryGoal}
                  onChange={(e) => setFreeDeliveryGoal(e.target.value)}
                  className="h-9 text-xs w-28 font-bold"
                  required
                />
                <div className="flex flex-wrap gap-1">
                  {THRESHOLD_SUGGESTIONS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFreeDeliveryGoal(val)}
                      className={`text-xs px-2 py-1 rounded-lg border font-semibold transition-all ${
                        freeDeliveryGoal === val
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      ₹{val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Add Your Items First (Host Initial Items) */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Add Your Items First <span className="text-destructive">*</span>
                  </span>
                </div>
                <span className="text-xs font-bold text-primary">
                  Subtotal: {formatCurrency(hostItemsTotal)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Add what you are ordering to start the pool. Neighbors will pool remaining items!
              </p>

              {/* Items List */}
              <div className="space-y-2">
                {hostItems.map((item, index) => (
                  <div key={item.id} className="p-2 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-6">
                        <Input
                          placeholder={`Item ${index + 1} (e.g. Lays, Milk)`}
                          value={item.name}
                          onChange={(e) => updateHostItemRow(item.id, 'name', e.target.value)}
                          className="h-8 text-xs"
                          required={index === 0}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="1"
                          max="99"
                          placeholder="Qty"
                          value={item.qty}
                          onChange={(e) =>
                            updateHostItemRow(item.id, 'qty', parseInt(e.target.value) || 1)
                          }
                          className="h-8 text-xs text-center px-1"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="₹ Est."
                          value={item.price}
                          onChange={(e) => updateHostItemRow(item.id, 'price', e.target.value)}
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {hostItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeHostItemRow(item.id)}
                            className="text-muted-foreground hover:text-destructive p-1"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHostItemRow}
                className="w-full h-8 text-xs font-semibold gap-1.5 border-dashed"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Item</span>
              </Button>

              {/* Live Remaining for Free Delivery Preview */}
              {targetNum > 0 && (
                <div className="pt-2 border-t border-border/60 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Free Delivery Status:</span>
                    {remainingForFree === 0 ? (
                      <span className="font-bold text-emerald-600 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Free Delivery Unlocked!
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                        ₹{remainingForFree} remaining for FREE delivery
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        remainingForFree === 0 ? 'bg-emerald-500' : 'bg-primary'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Lock Duration Timer */}
            <div className="space-y-1.5">
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
            </div>

            {/* Pickup Instructions */}
            <div className="space-y-1">
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
                className="h-9 text-xs"
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
                    <span>Creating &amp; Adding Items...</span>
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
