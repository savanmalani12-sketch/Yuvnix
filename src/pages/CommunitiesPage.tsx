import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import {
  Building2,
  MapPin,
  PlusCircle,
  Search,
  Users,
  Car,
  ShoppingCart,
  GraduationCap,
  Loader2,
  Lock,
  CheckCircle2,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { CreateCartModal } from '@/components/carts/CreateCartModal';
import { CartItemsModal } from '@/components/carts/CartItemsModal';
import { CartChatModal } from '@/components/carts/CartChatModal';

export const CommunitiesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreateCartOpen, setIsCreateCartOpen] = useState(false);
  const [selectedCommunityForCart, setSelectedCommunityForCart] = useState<string | undefined>(undefined);
  const [selectedCartIdForItems, setSelectedCartIdForItems] = useState<string | null>(null);
  const [selectedCartForChat, setSelectedCartForChat] = useState<{ id: string; title: string } | null>(null);

  const navigate = useNavigate();
  const { user, isAuthenticated, signInWithGoogle } = useAuth();
  const queryClient = useQueryClient();

  // Fetch active carts inside verified communities
  const { data: activeCarts = [] } = useQuery({
    queryKey: ['communities_active_carts'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_carts')
        .select(`
          id,
          community_id,
          title,
          store_name,
          status,
          lock_at,
          total_estimated_amount,
          target_amount,
          host_initial_amount,
          created_by:profiles!created_by_user_id(username),
          cart_items(id)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch active community carts:', error.message);
        return [];
      }
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Query live verified communities with optional pickup points (governed by RLS)
  const {
    data: communities = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['communities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communities')
        .select(`
          id,
          name,
          slug,
          description,
          type,
          college_affiliation,
          city,
          state,
          general_area,
          latitude,
          longitude,
          is_verified,
          active_member_count,
          created_at,
          updated_at,
          community_pickup_points (
            physical_address,
            delivery_pickup_point,
            taxi_pickup_point,
            gate_instructions
          )
        `)
        .eq('is_verified', true)
        .order('name');

      if (error) {
        throw error;
      }
      return data;
    },
  });

  // Query active memberships for the current authenticated user
  const { data: myMemberships = [] } = useQuery({
    queryKey: ['my_memberships', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('community_memberships')
        .select('community_id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) {
        throw error;
      }
      return data || [];
    },
  });

  const memberCommunityIds = new Set(myMemberships.map((m) => m.community_id));
  const myJoinedCommunities = communities
    .filter((c) => memberCommunityIds.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      general_area: c.general_area,
    }));

  // Join community mutation (uses atomic RPC join_community, with fallback to table upsert)
  const joinMutation = useMutation({
    mutationFn: async (communityId: string) => {
      setActionError(null);
      if (!isAuthenticated || !user) {
        await signInWithGoogle();
        return;
      }

      // Try atomic RPC function first
      const { error: rpcError } = await supabase.rpc('join_community', {
        p_community_id: communityId,
      });

      if (rpcError) {
        // If RPC function not yet provisioned in DB, fall back to upsert
        console.warn('join_community RPC error, attempting direct upsert:', rpcError.message);
        const { error: upsertError } = await supabase.from('community_memberships').upsert(
          {
            community_id: communityId,
            user_id: user.id,
            is_active: true,
          },
          { onConflict: 'community_id,user_id' }
        );

        if (upsertError) {
          throw new Error(upsertError.message || 'Failed to join community.');
        }
      }
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['my_memberships'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unable to join community. Please try again.';
      console.error('Failed to join community:', err);
      setActionError(message);
    },
  });

  // Leave community mutation
  const leaveMutation = useMutation({
    mutationFn: async (communityId: string) => {
      setActionError(null);
      if (!isAuthenticated || !user) return;

      const { error: rpcError } = await supabase.rpc('leave_community', {
        p_community_id: communityId,
      });

      if (rpcError) {
        console.warn('leave_community RPC error, attempting direct update:', rpcError.message);
        const { error: updateError } = await supabase
          .from('community_memberships')
          .update({ is_active: false })
          .eq('community_id', communityId)
          .eq('user_id', user.id);

        if (updateError) {
          throw new Error(updateError.message || 'Failed to leave community.');
        }
      }
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['my_memberships'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unable to leave community.';
      console.error('Failed to leave community:', err);
      setActionError(message);
    },
  });

  const filteredCommunities = communities.filter((c) => {
    const q = search.toLowerCase();
    const nameMatch = c.name.toLowerCase().includes(q);
    const cityMatch = c.city.toLowerCase().includes(q);
    const areaMatch = Boolean(c.general_area && c.general_area.toLowerCase().includes(q));
    const collegeMatch = Boolean(c.college_affiliation && c.college_affiliation.toLowerCase().includes(q));
    return nameMatch || cityMatch || areaMatch || collegeMatch;
  });

  return (
    <PageContainer
      title="Residential Communities"
      subtitle="Communities represent physical residential buildings (Hostels, PGs, Apartments). Select your residence to join group carts and rides."
      action={
        <Link to="/communities/request">
          <Button className="gap-2 font-semibold">
            <PlusCircle className="w-4 h-4" />
            <span>Request Community</span>
          </Button>
        </Link>
      }
    >
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by hostel, PG name, or landmark..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 bg-card"
        />
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center justify-between gap-3 mb-6 animate-in fade-in">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-destructive font-bold text-sm hover:opacity-80 px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Loading residential communities...</p>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="p-4 mb-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load communities: {(error as Error).message}
        </div>
      )}

      {/* Grid of Communities */}
      {!isLoading && !error && filteredCommunities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCommunities.map((community) => {
            const isMember = memberCommunityIds.has(community.id);
            const communityCarts = activeCarts.filter((c) => c.community_id === community.id);
            // In PostgreSQL 1:1 relation, community_pickup_points may be an array of length 0 or 1
            const pickupPoint = Array.isArray(community.community_pickup_points)
              ? community.community_pickup_points[0]
              : community.community_pickup_points;

            return (
              <Card key={community.id} className="hover:border-primary/50 transition-all flex flex-col justify-between">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{community.name}</CardTitle>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {community.general_area
                            ? `${community.general_area}, ${community.city}`
                            : `${community.city}, ${community.state || ''}`}
                        </span>
                      </div>
                    </div>
                    <Badge variant={community.type === 'hostel' ? 'default' : 'secondary'} className="capitalize">
                      {community.type}
                    </Badge>
                  </div>

                  {community.college_affiliation && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg w-fit">
                      <GraduationCap className="w-3.5 h-3.5 text-primary" />
                      <span>Affiliated: {community.college_affiliation}</span>
                    </div>
                  )}

                  {community.description && (
                    <CardDescription className="text-xs line-clamp-2">
                      {community.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Verified Pickup Points (Tier 2: Resident-Only Access via RLS) */}
                  <div className="text-xs space-y-1.5 p-3 rounded-xl bg-muted/40 border border-border/50">
                    {pickupPoint && pickupPoint.delivery_pickup_point !== pickupPoint.taxi_pickup_point ? (
                      <>
                        <div className="flex items-start gap-2">
                          <ShoppingCart className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">Delivery Point:</strong>{' '}
                            {pickupPoint.delivery_pickup_point}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Car className="w-3.5 h-3.5 text-violet-600 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">Taxi Point:</strong>{' '}
                            {pickupPoint.taxi_pickup_point}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">Delivery &amp; Pickup:</strong>{' '}
                          {pickupPoint ? (
                            pickupPoint.delivery_pickup_point
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground italic">
                              <Lock className="w-3 h-3 text-muted-foreground/70" />
                              Visible to verified residents
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Active Group Grocery Carts (Directly Inside Community) */}
                  {isMember ? (
                    <div className="pt-2 border-t border-border/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-semibold text-foreground">
                            Group Grocery Carts
                          </span>
                          {communityCarts.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary">
                              {communityCarts.length} active
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedCommunityForCart(community.id);
                            setIsCreateCartOpen(true);
                          }}
                          className="h-6 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Start Cart</span>
                        </Button>
                      </div>

                      {communityCarts.length > 0 ? (
                        <div className="space-y-2">
                          {communityCarts.map((cart) => {
                            const creatorHandle =
                              cart.created_by &&
                              typeof cart.created_by === 'object' &&
                              'username' in cart.created_by &&
                              cart.created_by.username
                                ? `@${(cart.created_by as { username: string }).username.replace(/^@/, '')}`
                                : '@resident';
                            const target = Number(cart.target_amount) || 0;
                            const total = Number(cart.total_estimated_amount) || 0;
                            const remaining = Math.max(0, target - total);
                            const percent = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 100;
                            const itemCount = cart.cart_items ? cart.cart_items.length : 0;

                            return (
                              <div
                                key={cart.id}
                                className="p-2.5 rounded-xl bg-background/80 border border-border/70 hover:border-primary/40 transition-all space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <Badge variant="outline" className="text-[10px] font-bold h-4 px-1.5 bg-primary/5 text-primary border-primary/30">
                                        {cart.store_name}
                                      </Badge>
                                      <span className="font-semibold text-xs text-foreground truncate">
                                        {cart.title}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                      <span>Host: <strong className="text-foreground/90 font-mono">{creatorHandle}</strong></span>
                                      <span>•</span>
                                      <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedCartIdForItems(cart.id)}
                                      className="h-6 text-[11px] px-2 font-medium"
                                    >
                                      View Items
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setSelectedCartForChat({ id: cart.id, title: cart.title })}
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                      title="Cart Chat"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Free delivery progress bar */}
                                {target > 0 && (
                                  <div className="space-y-1 bg-muted/30 p-1.5 rounded-lg border border-border/40">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-muted-foreground">Free Delivery:</span>
                                      {remaining === 0 ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                          <CheckCircle2 className="w-3 h-3" />
                                          Unlocked! (₹{total})
                                        </span>
                                      ) : (
                                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                                          ₹{remaining} left to free delivery
                                        </span>
                                      )}
                                    </div>
                                    <div className="w-full bg-border/60 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className={`h-full transition-all duration-300 rounded-full ${
                                          remaining === 0
                                            ? 'bg-emerald-500'
                                            : 'bg-gradient-to-r from-amber-500 to-indigo-500'
                                        }`}
                                        style={{ width: `${percent}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-muted/20 border border-dashed border-border/70 text-center">
                          <p className="text-[11px] text-muted-foreground">
                            No active orders in this hostel. Start a cart to pool delivery fees!
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    communityCarts.length > 0 && (
                      <div className="pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-primary/5 border border-primary/20 text-xs">
                          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                            <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                            {communityCarts.length} active group {communityCarts.length === 1 ? 'order' : 'orders'}
                          </span>
                          <span className="text-[11px] text-primary font-semibold">Join residence to join</span>
                        </div>
                      </div>
                    )
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {community.active_member_count} residents
                    </span>

                    {isMember ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-xs gap-1 border-primary/40 text-primary bg-primary/5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resident</span>
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                          disabled={leaveMutation.isPending && leaveMutation.variables === community.id}
                          onClick={() => leaveMutation.mutate(community.id)}
                          title="Leave this residence"
                        >
                          {leaveMutation.isPending && leaveMutation.variables === community.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Leave'
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="subtle"
                        className="text-xs"
                        disabled={joinMutation.isPending && joinMutation.variables === community.id}
                        onClick={() => joinMutation.mutate(community.id)}
                      >
                        {joinMutation.isPending && joinMutation.variables === community.id ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Joining...</span>
                          </span>
                        ) : (
                          'Join Residence'
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredCommunities.length === 0 && (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No residential communities found"
          description={
            search
              ? `We couldn't find any hostel or PG matching "${search}". You can submit a request for your residence!`
              : 'No residential communities have been registered yet. Be the first to propose your hostel or PG!'
          }
          actionLabel="Request Your Community"
          onAction={() => navigate('/communities/request')}
        />
      )}

      {/* Create Cart Modal */}
      {isCreateCartOpen && (
        <CreateCartModal
          isOpen={isCreateCartOpen}
          onClose={() => {
            setIsCreateCartOpen(false);
            setSelectedCommunityForCart(undefined);
          }}
          defaultCommunityId={selectedCommunityForCart}
          userCommunities={myJoinedCommunities}
          onCartCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['communities_active_carts'] });
          }}
        />
      )}

      {/* Cart Items Modal */}
      {selectedCartIdForItems && (
        <CartItemsModal
          cartId={selectedCartIdForItems}
          isOpen={Boolean(selectedCartIdForItems)}
          onClose={() => {
            setSelectedCartIdForItems(null);
            queryClient.invalidateQueries({ queryKey: ['communities_active_carts'] });
          }}
        />
      )}

      {/* Cart Chat Modal */}
      {selectedCartForChat && (
        <CartChatModal
          cartId={selectedCartForChat.id}
          cartTitle={selectedCartForChat.title}
          isOpen={Boolean(selectedCartForChat)}
          onClose={() => setSelectedCartForChat(null)}
        />
      )}
    </PageContainer>
  );
};
