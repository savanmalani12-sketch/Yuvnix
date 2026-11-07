import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
  MapPin,
  Clock,
  Users,
  Navigation,
  MessageSquare,
  Info,
  Loader2,
  Car,
  LogIn,
} from 'lucide-react';

export const RidesPage: React.FC = () => {
  const { isAuthenticated, signInWithGoogle } = useAuth();

  const {
    data: rides = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['shared_rides'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_rides')
        .select(`
          id,
          community_id,
          created_by_user_id,
          pickup_point,
          destination,
          departure_time,
          total_seats,
          available_seats,
          estimated_cost_per_seat,
          status,
          luggage_details,
          notes,
          created_at,
          updated_at,
          community:communities(name)
        `)
        .order('departure_time', { ascending: true });

      if (error) {
        throw error;
      }
      return data;
    },
  });

  return (
    <PageContainer
      title="Shared Taxi Rides"
      subtitle="Find people going your way from your residence. Share cabs to airports, stations, and tech parks."
      action={
        <Button className="gap-2 font-semibold">
          <PlusCircle className="w-4 h-4" />
          <span>Post Ride Offer</span>
        </Button>
      }
    >
      {/* Product Rule Notice */}
      <div className="mb-6 p-4 rounded-2xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 text-xs flex items-start gap-3">
        <Info className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
        <div className="text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Direct Fare Splitting:</strong> Riders connect directly and split actual cab fare on Uber/Ola/Rapido. Yuvnix charges zero platform commission.
        </div>
      </div>

      {/* Sign In Required State */}
      {!isAuthenticated && (
        <Card className="p-8 text-center border-dashed">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Car className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Sign In to View Shared Rides</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Shared taxi pools and airport cabs are coordinated between verified peers. Sign in with your student account to request seats and split fares.
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
          <p className="text-sm">Loading upcoming shared rides...</p>
        </div>
      )}

      {/* Error State */}
      {isAuthenticated && error && !isLoading && (
        <div className="p-4 mb-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load shared rides: {(error as Error).message}
        </div>
      )}

      {/* Grid of Shared Rides */}
      {isAuthenticated && !isLoading && !error && rides.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {rides.map((ride) => {
            const communityName =
              ride.community && typeof ride.community === 'object' && 'name' in ride.community
                ? (ride.community as { name: string }).name
                : 'Community';

            return (
              <Card key={ride.id} className="hover:border-primary/40 transition-all flex flex-col justify-between">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="mb-1 text-[11px]">
                        {communityName}
                      </Badge>
                      <CardTitle className="text-lg font-bold flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-primary shrink-0" />
                        <span>{ride.destination}</span>
                      </CardTitle>
                    </div>
                    <StatusBadge status={ride.status} />
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                      <span>
                        <strong>Pickup:</strong> {ride.pickup_point}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>
                        <strong>Departing:</strong> {formatDateTime(ride.departure_time)}
                      </span>
                    </div>
                  </div>

                  {ride.notes && (
                    <CardDescription className="text-xs">
                      {ride.notes}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-muted/50 border border-border/50">
                    <span className="flex items-center gap-1.5 text-foreground font-semibold">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      {ride.available_seats} of {ride.total_seats} seats left
                    </span>
                    {ride.estimated_cost_per_seat && (
                      <span className="font-bold text-primary">
                        ~₹{ride.estimated_cost_per_seat} / seat
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Ride Chat</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="text-xs"
                      disabled={ride.available_seats <= 0 || ride.status !== 'open'}
                    >
                      {ride.available_seats <= 0 ? 'Full' : 'Request Seat'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {isAuthenticated && !isLoading && !error && rides.length === 0 && (
        <EmptyState
          icon={<Car className="w-6 h-6" />}
          title="No upcoming shared rides"
          description="Nobody has posted a taxi ride yet from your residence. Offer a ride to split fare with students going your way!"
          actionLabel="Post Ride Offer"
          onAction={() => {}}
        />
      )}
    </PageContainer>
  );
};
