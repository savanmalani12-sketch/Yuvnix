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
  ArrowRight,
  Sparkles,
  Zap,
  Users,
  MapPin,
  CheckCircle2,
  PlusCircle,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  return (
    <PageContainer maxWidth="xl" className="space-y-12 sm:space-y-16">
      {/* Hero Section */}
      <section className="relative pt-4 sm:pt-10 text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Student Hyperlocal Living Network</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground font-sans leading-[1.15]">
          Your people.{' '}
          <span className="text-primary">
            Your community.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Connect with peers living in your hostel, PG, or apartment. Meet the ₹199 store threshold on late-night grocery orders for ₹0 free delivery, and split cab rides right from your gate.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <Link to="/communities" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto gap-2 text-base font-semibold shadow-elevated">
              <span>Find Your Residence</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/carts" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto font-medium gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <span>Explore Group Carts</span>
            </Button>
          </Link>
        </div>

        {/* Quick Trust Pills Bar */}
        <div className="pt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border/60">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>⚡ Zepto, Blinkit &amp; Instamart</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border/60">
            <Car className="w-3.5 h-3.5 text-violet-500" />
            <span>Airport &amp; Station Cabs</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>100% Free for Students</span>
          </span>
        </div>
      </section>

      {/* Core Value Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1: Communities */}
        <Card className="relative overflow-hidden group hover:border-primary/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform" />
          <CardHeader className="space-y-3 pb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-subtle">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="default" className="mb-2">Physical Residences</Badge>
              <CardTitle className="text-xl">Hostels &amp; PGs</CardTitle>
            </div>
            <CardDescription className="text-xs leading-relaxed">
              Anchored to real student living quarters like <strong>PDEU Hostel</strong>, <strong>Sunrise PG</strong>, and <strong>Friends Apartment</strong> with verified pickup gates.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Link to="/communities" className="inline-flex items-center text-xs font-semibold text-primary hover:underline gap-1">
              Browse residences <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Pillar 2: Group Grocery Orders */}
        <Card className="relative overflow-hidden group hover:border-primary/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform" />
          <CardHeader className="space-y-3 pb-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 flex items-center justify-center shadow-subtle">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="accent" className="mb-2">Save ₹35+ Each Time</Badge>
              <CardTitle className="text-xl">Group Grocery Carts</CardTitle>
            </div>
            <CardDescription className="text-xs leading-relaxed">
              Pool items with hostel mates for Zepto, Blinkit or Instamart orders. Hit store thresholds together, unlock ₹0 free delivery, and collect at the gate.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Link to="/carts" className="inline-flex items-center text-xs font-semibold text-primary hover:underline gap-1">
              View active carts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Pillar 3: Shared Taxi Rides */}
        <Card className="relative overflow-hidden group hover:border-primary/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-violet-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform" />
          <CardHeader className="space-y-3 pb-2">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300 flex items-center justify-center shadow-subtle">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="secondary" className="mb-2">Split Fares 4-Ways</Badge>
              <CardTitle className="text-xl">Shared Taxi Rides</CardTitle>
            </div>
            <CardDescription className="text-xs leading-relaxed">
              Heading to the airport, railway station, or campus? Connect with co-residents departing from your exact gate to share the cab fare.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Link to="/rides" className="inline-flex items-center text-xs font-semibold text-primary hover:underline gap-1">
              Find shared rides <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* How Yuvnix Works in 3 Steps */}
      <section className="rounded-3xl border border-border/80 bg-card p-6 sm:p-10 shadow-card space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            How Yuvnix Works
          </h2>
          <p className="text-sm text-muted-foreground">
            Simple, gate-level residential coordination with zero middleman markups.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-muted/40 border border-border/50 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" />
              <span>Select Your Residence</span>
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Join your verified hostel or PG. Detailed delivery foyer and cab pickup coordinates are protected and visible only to verified residents.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-muted/40 border border-border/50 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-indigo-600" />
              <span>Pool Items or Rides</span>
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add your midnight snacks to reach the store's free delivery threshold together. Or claim an empty seat in a split cab with peers.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-muted/40 border border-border/50 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Meet at Gate &amp; Pay P2P</span>
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Collect your items together at the gate. Settle your share directly with your neighbor via UPI or cash with zero platform commission.
            </p>
          </div>
        </div>
      </section>

      {/* Community Request Callout */}
      <section className="rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center sm:text-left">
          <h3 className="text-lg font-bold text-foreground">
            Don't see your hostel or PG listed?
          </h3>
          <p className="text-xs text-muted-foreground">
            Submit a request for your residence in under 30 seconds. Our staff verifies pickup points and gates promptly.
          </p>
        </div>
        <Link to="/communities/request" className="shrink-0 w-full sm:w-auto">
          <Button className="w-full sm:w-auto gap-1.5 font-semibold">
            <PlusCircle className="w-4 h-4" />
            <span>Request Your Community</span>
          </Button>
        </Link>
      </section>
    </PageContainer>
  );
};
