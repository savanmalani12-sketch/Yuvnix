import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  PlusCircle,
  MapPin,
  Clock,
  Users,
  Navigation,
  MessageSquare,
  Info,
} from 'lucide-react';
import type { SharedRide } from '@/types';
import { formatDateTime } from '@/utils/formatters';

const SAMPLE_RIDES: (SharedRide & { community_name: string })[] = [
  {
    id: 'ride-1',
    community_id: 'c1',
    community_name: 'PDEU Hostel',
    created_by_user_id: 'u1',
    pickup_point: 'Hostel Gate 1 Porch',
    destination: 'SVP International Airport (Terminal 2)',
    departure_time: new Date(Date.now() + 3600 * 1000 * 5).toISOString(),
    total_seats: 4,
    available_seats: 2,
    estimated_cost_per_seat: 180,
    status: 'open',
    luggage_details: '1 trolley bag + 1 backpack per seat',
    notes: 'Booking an Uber XL. Splitting fare via UPI after ride.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ride-2',
    community_id: 'c3',
    community_name: 'Sunrise PG',
    created_by_user_id: 'u3',
    pickup_point: 'Sunrise PG Front Parking Bay',
    destination: 'Kalupur Railway Station, Ahmedabad',
    departure_time: new Date(Date.now() + 3600 * 1000 * 18).toISOString(),
    total_seats: 3,
    available_seats: 1,
    estimated_cost_per_seat: 140,
    status: 'open',
    luggage_details: 'Standard luggage accepted',
    notes: 'Departing early morning for Vande Bharat train.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const RidesPage: React.FC = () => {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SAMPLE_RIDES.map((ride) => (
          <Card key={ride.id} className="hover:border-primary/40 transition-all flex flex-col justify-between">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant="outline" className="mb-1 text-[11px]">
                    {ride.community_name}
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
                  <span><strong>Pickup:</strong> {ride.pickup_point}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span><strong>Departing:</strong> {formatDateTime(ride.departure_time)}</span>
                </div>
              </div>

              <CardDescription className="text-xs">
                {ride.notes}
              </CardDescription>
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
                <Button size="sm" variant="default" className="text-xs">
                  Request Seat
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
};
