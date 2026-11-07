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
} from 'lucide-react';

export const CommunitiesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user, isAuthenticated, signInWithGoogle } = useAuth();
  const queryClient = useQueryClient();

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

  // Join community mutation
  const joinMutation = useMutation({
    mutationFn: async (communityId: string) => {
      if (!isAuthenticated || !user) {
        await signInWithGoogle();
        return;
      }

      const { error } = await supabase.from('community_memberships').insert({
        community_id: communityId,
        user_id: user.id,
        is_active: true,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_memberships'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
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
                    <div className="flex items-start gap-2">
                      <ShoppingCart className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">Delivery Point:</strong>{' '}
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
                    <div className="flex items-start gap-2">
                      <Car className="w-3.5 h-3.5 text-violet-600 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">Taxi Point:</strong>{' '}
                        {pickupPoint ? (
                          pickupPoint.taxi_pickup_point
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground italic">
                            <Lock className="w-3 h-3 text-muted-foreground/70" />
                            Visible to verified residents
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {community.active_member_count} residents
                    </span>

                    {isMember ? (
                      <Badge variant="outline" className="text-xs gap-1 border-primary/40 text-primary">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resident Member</span>
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="subtle"
                        className="text-xs"
                        disabled={joinMutation.isPending}
                        onClick={() => joinMutation.mutate(community.id)}
                      >
                        {joinMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
    </PageContainer>
  );
};
