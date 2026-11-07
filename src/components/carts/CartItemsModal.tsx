import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import {
  Plus,
  Trash2,
  Clock,
  Store,
  Lock,
  CheckCircle2,
  Loader2,
  Package,
} from 'lucide-react';

interface CartItemsModalProps {
  cartId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CartItemsModal: React.FC<CartItemsModalProps> = ({
  cartId,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [priceEstimate, setPriceEstimate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch cart details
  const { data: cart } = useQuery({
    queryKey: ['group_cart_detail', cartId],
    enabled: Boolean(cartId) && isOpen,
    queryFn: async () => {
      if (!cartId) return null;
      const { data, error } = await supabase
        .from('group_carts')
        .select(`
          id,
          title,
          store_name,
          status,
          lock_at,
          pickup_instructions,
          created_by_user_id,
          total_estimated_amount,
          community:communities(name)
        `)
        .eq('id', cartId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch items in this cart
  const { data: items = [], isLoading: isItemsLoading } = useQuery({
    queryKey: ['cart_items', cartId],
    enabled: Boolean(cartId) && isOpen,
    queryFn: async () => {
      if (!cartId) return [];
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          item_name,
          quantity,
          unit_price_estimate,
          notes,
          is_fulfilled,
          added_by_user_id,
          added_by:profiles!added_by_user_id(full_name, username)
        `)
        .eq('cart_id', cartId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Add Item Mutation
  const addItemMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      if (!user || !cartId) return;

      // 1. Join cart as participant if not already
      await supabase
        .from('cart_participants')
        .insert({ cart_id: cartId, user_id: user.id })
        .select()
        .maybeSingle();

      // 2. Insert cart item
      const unitPrice = priceEstimate ? parseFloat(priceEstimate) : null;
      const { error } = await supabase.from('cart_items').insert({
        cart_id: cartId,
        added_by_user_id: user.id,
        item_name: itemName.trim(),
        quantity: Math.max(1, quantity),
        unit_price_estimate: unitPrice,
        notes: notes.trim() || null,
        is_fulfilled: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setItemName('');
      setQuantity(1);
      setPriceEstimate('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['cart_items', cartId] });
      queryClient.invalidateQueries({ queryKey: ['group_carts'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to add item';
      setActionError(msg);
    },
  });

  // Delete Item Mutation (owner only)
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      setActionError(null);
      const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart_items', cartId] });
      queryClient.invalidateQueries({ queryKey: ['group_carts'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to remove item';
      setActionError(msg);
    },
  });

  // Host Action: Update status (lock, order, complete)
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: 'locked' | 'ordered' | 'completed') => {
      setActionError(null);
      if (!cartId) return;
      const { error } = await supabase
        .from('group_carts')
        .update({ status: newStatus })
        .eq('id', cartId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group_cart_detail', cartId] });
      queryClient.invalidateQueries({ queryKey: ['group_carts'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      setActionError(msg);
    },
  });

  const isHost = Boolean(user?.id && cart?.created_by_user_id === user.id);
  const isLocked = Boolean(
    cart && (cart.status !== 'open' || new Date(cart.lock_at).getTime() <= Date.now())
  );

  const totalCalculated = items.reduce((sum, item) => {
    const price = item.unit_price_estimate ? Number(item.unit_price_estimate) : 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-6 sm:rounded-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-1 pb-2 border-b border-border/60">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold">
                  {cart?.title || 'Group Cart'}
                </DialogTitle>
                {cart && <StatusBadge status={cart.status} />}
              </div>
              <DialogDescription className="text-xs flex items-center gap-2 mt-1 text-muted-foreground">
                {cart?.store_name && (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Store className="w-3.5 h-3.5 text-primary" />
                    {cart.store_name}
                  </span>
                )}
                {cart?.lock_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Locks: {formatDateTime(cart.lock_at)}
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {actionError && (
          <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="font-bold px-1">
              ×
            </button>
          </div>
        )}

        {/* Scrollable Item List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {isItemsLoading ? (
            <div className="py-12 flex justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground space-y-2">
              <Package className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="text-xs">No items added yet.</p>
              {!isLocked && (
                <p className="text-[11px] text-muted-foreground">
                  Be the first to add snacks, milk, bread, or groceries below!
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const isMine = user?.id === item.added_by_user_id;
                const addedByName =
                  item.added_by && typeof item.added_by === 'object' && 'full_name' in item.added_by
                    ? (item.added_by as { full_name: string }).full_name
                    : 'Neighbor';

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground truncate">{item.item_name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                          ×{item.quantity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>By {isMine ? 'You' : addedByName}</span>
                        {item.notes && <span className="italic truncate">({item.notes})</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.unit_price_estimate ? (
                        <span className="font-semibold text-foreground">
                          {formatCurrency(Number(item.unit_price_estimate) * item.quantity)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}

                      {isMine && !isLocked && (
                        <button
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          disabled={deleteItemMutation.isPending}
                          className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Total Estimate Footer */}
        {items.length > 0 && (
          <div className="p-3 rounded-xl bg-muted/50 border border-border/70 flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              Total Estimated Pool ({items.length} items):
            </span>
            <span className="font-bold text-sm text-foreground">
              {formatCurrency(totalCalculated)}
            </span>
          </div>
        )}

        {/* Add Item Form (Only if cart is open) */}
        {!isLocked ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (itemName.trim()) addItemMutation.mutate();
            }}
            className="pt-3 border-t border-border/70 space-y-2.5"
          >
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <Input
                  placeholder="Item name (e.g. Milk 1L, Lays)"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min="1"
                  max="99"
                  placeholder="Qty"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="h-9 text-xs text-center"
                  required
                />
              </div>
              <div className="col-span-4">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Est. ₹ (opt)"
                  value={priceEstimate}
                  onChange={(e) => setPriceEstimate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Input
                placeholder="Item notes / flavor (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-8 text-[11px] flex-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={addItemMutation.isPending || !itemName.trim()}
                className="h-8 text-xs font-semibold gap-1 shrink-0"
              >
                {addItemMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0 text-amber-600" />
            <span>This cart is locked. No new items can be added while the host places the order.</span>
          </div>
        )}

        {/* Host Control Actions */}
        {isHost && (
          <div className="pt-3 border-t border-border/70 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Host Controls:</span>
            <div className="flex items-center gap-1.5">
              {cart?.status === 'open' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate('locked')}
                  disabled={updateStatusMutation.isPending}
                  className="h-7 text-xs font-semibold gap-1 text-amber-600"
                >
                  <Lock className="w-3 h-3" />
                  <span>Lock Cart Now</span>
                </Button>
              )}
              {cart?.status === 'locked' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate('ordered')}
                  disabled={updateStatusMutation.isPending}
                  className="h-7 text-xs font-semibold gap-1 text-indigo-600"
                >
                  <Store className="w-3 h-3" />
                  <span>Mark Placed</span>
                </Button>
              )}
              {cart?.status === 'ordered' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate('completed')}
                  disabled={updateStatusMutation.isPending}
                  className="h-7 text-xs font-semibold gap-1 text-emerald-600"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Mark Completed</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
