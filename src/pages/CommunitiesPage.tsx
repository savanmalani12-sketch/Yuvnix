import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import {
  Building2,
  MapPin,
  PlusCircle,
  Search,
  Users,
  Car,
  ShoppingCart,
  GraduationCap,
} from 'lucide-react';
import type { Community } from '@/types';

// Foundation showcase communities demonstrating real residential physical locations
const SAMPLE_COMMUNITIES: Community[] = [
  {
    id: 'c1',
    name: 'PDEU Hostel',
    slug: 'pdeu-hostel',
    description: 'On-campus boys hostel blocks with high evening delivery volume.',
    type: 'hostel',
    college_affiliation: 'PDEU Gandhinagar',
    address: 'Knowledge Corridor, Raisan',
    city: 'Gandhinagar',
    state: 'Gujarat',
    delivery_pickup_point: 'Hostel Gate 1 Main Security Desk',
    taxi_pickup_point: 'Hostel Circle / Gate 1 Porch',
    is_verified: true,
    active_member_count: 248,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c2',
    name: 'PDEU Girls Hostel',
    slug: 'pdeu-girls-hostel',
    description: 'Girls residential wings with strict security pickup protocols.',
    type: 'hostel',
    college_affiliation: 'PDEU Gandhinagar',
    address: 'Girls Wing, Campus Block G',
    city: 'Gandhinagar',
    state: 'Gujarat',
    delivery_pickup_point: 'Block G Entrance Foyer Security Desk',
    taxi_pickup_point: 'Girls Hostel Perimeter Gate',
    is_verified: true,
    active_member_count: 182,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c3',
    name: 'Sunrise PG',
    slug: 'sunrise-pg',
    description: 'Popular off-campus student PG residence near Raysan crossroads.',
    type: 'pg',
    college_affiliation: 'Nearby Universities (PDEU, NIFT)',
    address: 'Plot 44, Raysan Village Road',
    city: 'Gandhinagar',
    state: 'Gujarat',
    delivery_pickup_point: 'Building Main Reception / Gate',
    taxi_pickup_point: 'Sunrise PG Front Parking Bay',
    is_verified: true,
    active_member_count: 64,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c4',
    name: 'Friends Apartment',
    slug: 'friends-apartment',
    description: 'Student-shared flat clusters with joint weekend grocery runs.',
    type: 'apartment',
    college_affiliation: 'Multi-College Students',
    address: 'Near Bhaijipura Cross Road, Kudasan',
    city: 'Gandhinagar',
    state: 'Gujarat',
    delivery_pickup_point: 'Tower A Ground Lobby',
    taxi_pickup_point: 'Society Entrance Gate',
    is_verified: true,
    active_member_count: 42,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const CommunitiesPage: React.FC = () => {
  const [search, setSearch] = useState('');

  const filteredCommunities = SAMPLE_COMMUNITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase()) ||
      (c.college_affiliation && c.college_affiliation.toLowerCase().includes(search.toLowerCase()))
  );

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

      {/* Grid of Communities */}
      {filteredCommunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCommunities.map((community) => (
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
                        {community.address}, {community.city}
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

                <CardDescription className="text-xs line-clamp-2">
                  {community.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {/* Verified Pickup Points */}
                <div className="text-xs space-y-1.5 p-3 rounded-xl bg-muted/40 border border-border/50">
                  <div className="flex items-start gap-2">
                    <ShoppingCart className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Delivery Point:</strong> {community.delivery_pickup_point}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Car className="w-3.5 h-3.5 text-violet-600 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Taxi Point:</strong> {community.taxi_pickup_point}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {community.active_member_count} residents
                  </span>

                  <Button size="sm" variant="subtle" className="text-xs">
                    Join Residence
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No residential communities found"
          description={`We couldn't find any hostel or PG matching "${search}". You can submit a request for your residence!`}
          actionLabel="Request Your Community"
          onAction={() => {}}
        />
      )}
    </PageContainer>
  );
};
