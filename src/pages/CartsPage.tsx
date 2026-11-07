import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { supabase } from '@/services/supabase';
import { formatDateTime } from '@/utils/formatters';
import { useAuth } from '@/hooks/useAuth';
import {
  PlusCircle,
  Clock,
  MessageSquare,
  Store,
  Info,
  Loader2,
  ShoppingCart,
  LogIn,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { CreateCartModal } from '@/components/carts/CreateCartModal';
import { CartItemsModal } from '@/components/carts/CartItemsModal';
import { CartChatModal } from '@/components/carts/CartChatModal';

export const CartsPage: React.FC = () => {
  const { user, isAuthenticated, signInWithGoogle } = useAuth();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCartIdForItems, setSelectedCartIdForItems] = useState<string | null>(null);
  const [selectedCartForChat, setSelectedCartForChat] = useState<{ id: string; title: string } | null>(null);

  // Fetch user's joined communities
  const { data: userCommunities = [] } = useQuery({
    queryKey: ['my_active_communities', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('community_memberships')
        .select(`
          community_id,
          community:communities!community_id(id, name, general_area)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) {
        console.warn('Could not fetch active communities:', error.message);
        return [];
      }

      return (data || [])
        .map((m) => m.community)
        .filter(Boolean) as { id: string; name: string; general_area: string | null }[];
    },
  });

  // Fetch active carts
  const {
    data: carts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['group_carts'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_carts')
        .select(`
          id,
          community_id,
          created_by_user_id,
          title,
          store_name,
          status,
          lock_at,
          pickup_instructions,
          total_estimated_amount,
          host_initial_amount,
          target_amount,
          created_at,
          updated_at,
          community:communities(name),
          cart_items(id, is_fulfilled)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      return data;
    },
  });

  const handleStartCartClick = () => {
    if (!isAuthenticated) {
      signInWithGoogle();
      return;
    }
    setIsCreateOpen(true);
  };

  return (
    <PageContainer
      title="Group Grocery Orders"
      subtitle="Pool grocery items with neighbors to save delivery fees. Group carts feature product lists, lock timers, and private group chat."
      action={
        <Button onClick={handleStartCartClick} className="gap-2 font-semibold">
          <PlusCircle className="w-4 h-4" />
          <span>Start Group Cart</span>
        </Button>
      }
    >
      {/* Product Rule Notice */}
      <div className="mb-6 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs flex items-start gap-3">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Peer-to-Peer Model:</strong> Students coordinate who places the order, pays the store directly, and collects at the verified gate. Yuvnix does not charge students or process payments.
        </div>
      </div>

      {/* Sign In Required State */}
      {!isAuthenticated && (
        <Card className="p-8 text-center border-dashed">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Sign In to View Group Carts</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Group grocery carts are pooled by verified residents in your hostel or PG. Sign in with your student account to join active orders and save on delivery fees.
            </p>
            <Button onClick={() => signInWithGoogle()} className="font-semibold gap-2 mt-2">
              <LogIn className="w-4 h-4" />
              <span>Sign In with Google</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isAuthenticated && isLoading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Loading active grocery carts...</p>
        </div>
      )}

      {/* Error State */}
      {isAuthenticated && error && !isLoading && (
        <div className="p-4 mb-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load group carts: {(error as Error).message}
        </div>
      )}

      {/* Grid of Group Carts */}
      {isAuthenticated && !isLoading && !error && carts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {carts.map((cart) => {
            const communityName =
              cart.community && typeof cart.community === 'object' && 'name' in cart.community
                ? (cart.community as { name: string }).name
                : 'Community';
            const itemsCount = cart.cart_items?.length || 0;
            const isLockImminent =
              new Date(cart.lock_at).getTime() - Date.now() < 3600 * 1000 &&
              new Date(cart.lock_at).getTime() > Date.now();

            return (
              <Card key={cart.id} className="hover:border-primary/40 transition-all flex flex-col justify-between">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="mb-1.5 text-[11px]">
                        {communityName}
                      </Badge>
                      <CardTitle className="text-lg font-bold">{cart.title}</CardTitle>
                    </div>
                    <StatusBadge status={cart.status} />
                  </div>

                  {cart.store_name && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Store className="w-3.5 h-3.5 text-primary" />
                      <span>
                        Store: <strong>{cart.store_name}</strong>
                      </span>
                    </div>
                  )}

                  {cart.pickup_instructions && (
                    <CardDescription className="text-xs">
                      {cart.pickup_instructions}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Free Delivery Goal Progress */}
                  {Boolean(cart.target_amount && Number(cart.target_amount) > 0) && (() => {
                    const target = Number(cart.target_amount);
                    const total = Number(cart.total_estimated_amount || 0);
                    const remaining = Math.max(0, target - total);
                    const pct = Math.min(100, Math.round((total / target) * 100));

                    return (
                      <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="flex items-center gap-1 text-foreground">
                            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>Free Delivery Goal</span>
                          </span>
                          {remaining === 0 ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Unlocked!
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              ₹{remaining} more needed
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              remaining === 0 ? 'bg-emerald-500' : 'bg-primary'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Pooled: ₹{total}</span>
                          <span>Target: ₹{target}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-muted/50 border border-border/50">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock
                        className={`w-3.5 h-3.5 ${
                          isLockImminent ? 'text-amber-600 animate-pulse' : 'text-muted-foreground'
                        }`}
                      />
                      <span>Lock: {formatDateTime(cart.lock_at)}</span>
                    </span>
                    <span className="font-semibold text-foreground">
                      {itemsCount} {itemsCount === 1 ? 'item' : 'items'} pooled
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCartForChat({ id: cart.id, title: cart.title })}
                      className="gap-1.5 text-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Group Chat</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setSelectedCartIdForItems(cart.id)}
                      className="text-xs font-semibold"
                    >
                      View Items ({itemsCount})
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {isAuthenticated && !isLoading && !error && carts.length === 0 && (
        <EmptyState
          icon={<ShoppingCart className="w-6 h-6" />}
          title="No active grocery carts"
          description="There are currently no open grocery carts in your residential communities. Start a cart to order together with your neighbors!"
          actionLabel="Start Group Cart"
          onAction={handleStartCartClick}
        />
      )}

      {/* Create Cart Modal */}
      <CreateCartModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCartCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['group_carts'] });
        }}
        userCommunities={userCommunities}
      />

      {/* Items Modal */}
      <CartItemsModal
        cartId={selectedCartIdForItems}
        isOpen={Boolean(selectedCartIdForItems)}
        onClose={() => setSelectedCartIdForItems(null)}
      />

      {/* Chat Modal */}
      <CartChatModal
        cartId={selectedCartForChat?.id || null}
        cartTitle={selectedCartForChat?.title}
        isOpen={Boolean(selectedCartForChat)}
        onClose={() => setSelectedCartForChat(null)}
      />
    </PageContainer>
  );
};
