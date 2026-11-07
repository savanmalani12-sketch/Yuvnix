import React from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  ShoppingCart,
  Car,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  return (
    <PageContainer maxWidth="xl" className="space-y-10 sm:space-y-14">
      {/* Hero Section */}
      <section className="relative pt-4 sm:pt-8 text-center max-w-3xl mx-auto space-y-5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Student Residential Network</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground font-sans leading-[1.15]">
          Your people.{' '}
          <span className="bg-gradient-to-r from-primary via-indigo-500 to-brand-violet bg-clip-text text-transparent">
            Your community.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Connect with peers in your hostel, PG, or apartment. Coordinate group grocery delivery orders
          and split taxi rides to campuses and transit stations.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to="/communities" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto gap-2 text-base font-semibold shadow-elevated">
              <span>Find Your Residence</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/communities/request" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto font-medium">
              Request New Community
            </Button>
          </Link>
        </div>
      </section>

      {/* Core Value Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1: Communities */}
        <Card className="relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform" />
          <CardHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-subtle">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="default" className="mb-2">Physical Residences</Badge>
              <CardTitle className="text-xl">Residential Communities</CardTitle>
            </div>
            <CardDescription>
              Anchored to real living spaces like <strong>PDEU Hostel</strong>, <strong>Sunrise PG</strong>, and <strong>Friends Apartment</strong> with verified pickup gates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/communities" className="inline-flex items-center text-xs font-semibold text-primary hover:underline gap-1">
              Browse communities <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Pillar 2: Group Grocery Orders */}
        <Card className="relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform" />
          <CardHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 flex items-center justify-center shadow-subtle">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="accent" className="mb-2">Zero Delivery Waste</Badge>
              <CardTitle className="text-xl">Group Grocery Carts</CardTitle>
            </div>
            <CardDescription>
              Pool items with hostel mates for Zepto, Blinkit or Instamart orders. Save on small cart fees and collect together at the gate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/carts" className="inline-flex items-center text-xs font-semibold text-primary hover:underline gap-1">
              View active carts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Pillar 3: Shared Taxi Rides */}
        <Card className="relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="absolute top-0 right-0 w-28 h-28 bg-violet-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform" />
          <CardHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300 flex items-center justify-center shadow-subtle">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="secondary" className="mb-2">Split Fares</Badge>
              <CardTitle className="text-xl">Shared Taxi Rides</CardTitle>
            </div>
            <CardDescription>
              Heading to the airport, railway station, or college campus? Match with co-residents departing from your exact gate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/rides" className="inline-flex items-center text-xs font-semibold text-primary hover:underline gap-1">
              Find shared rides <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Architectural Guarantee / Product Model */}
      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-foreground">
                Foundation Architecture Ready
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vite + React + TypeScript, Tailwind CSS, shadcn/ui design tokens, React Router,
              Supabase PostgreSQL client, and TanStack Query are configured under strict engineering rules.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto text-xs font-medium">
            <div className="flex items-center gap-1.5 text-foreground bg-muted/60 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>Strict Types</span>
            </div>
            <div className="flex items-center gap-1.5 text-foreground bg-muted/60 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>Zero-Leak RLS</span>
            </div>
            <div className="flex items-center gap-1.5 text-foreground bg-muted/60 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>Mobile-First UI</span>
            </div>
          </div>
        </div>
      </section>
    </PageContainer>
  );
};
