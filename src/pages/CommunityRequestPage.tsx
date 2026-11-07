import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  communityCreationRequestSchema,
  type CommunityCreationRequestInput,
} from '@/schemas/community';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { isSupabaseConfigured } from '@/utils/env';
import type { Database } from '@/types';
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

export const CommunityRequestPage: React.FC = () => {
  const { user, isAuthenticated, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CommunityCreationRequestInput>({
    resolver: zodResolver(communityCreationRequestSchema),
    defaultValues: {
      proposed_type: 'hostel',
      city: 'Gandhinagar',
    },
  });

  const onSubmit = async (data: CommunityCreationRequestInput) => {
    if (!isAuthenticated || !user) {
      signInWithGoogle();
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    if (!isSupabaseConfigured()) {
      // In development placeholder mode, simulate clean acceptance
      setTimeout(() => {
        setIsSubmitting(false);
        setIsSuccess(true);
        reset();
      }, 700);
      return;
    }

    try {
      const requestPayload: Database['public']['Tables']['community_requests']['Insert'] = {
        requested_by_user_id: user.id,
        proposed_name: data.proposed_name,
        proposed_type: data.proposed_type,
        college_affiliation: data.college_affiliation || null,
        address: data.address,
        proposed_delivery_pickup_point: data.proposed_delivery_pickup_point,
        proposed_taxi_pickup_point: data.proposed_taxi_pickup_point,
        status: 'pending',
      };

      const { error } = await supabase.from('community_requests').insert(requestPayload);

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit request';
      setSubmissionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer maxWidth="md">
      <Link
        to="/communities"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Communities</span>
      </Link>

      <Card className="shadow-elevated border-border/80">
        <CardHeader className="space-y-2">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <Building2 className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Request a Residential Community</CardTitle>
          <CardDescription>
            Can&apos;t find your hostel, PG, or student flat? Submit a request.
            Our support staff verifies physical pickup spots before opening it to residents.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Product Governance Notice */}
          <div className="p-4 rounded-2xl bg-muted/60 border border-border/70 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <span>Yuvnix Governance Rules</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
              <li>Communities represent physical residential living buildings, not colleges.</li>
              <li>Only authorized Yuvnix support staff approve and verify new communities.</li>
              <li>Submitting a request does not grant superior authority or admin privileges over peers.</li>
            </ul>
          </div>

          {isSuccess ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-foreground">Request Submitted</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Our support team will review the pickup points and residential details shortly.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <Button variant="outline" onClick={() => setIsSuccess(false)}>
                  Submit Another
                </Button>
                <Button onClick={() => navigate('/communities')}>
                  View Communities
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {submissionError && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                  {submissionError}
                </div>
              )}

              {/* Proposed Community Name */}
              <div className="space-y-2">
                <Label htmlFor="proposed_name">
                  Residence Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="proposed_name"
                  placeholder="e.g. PDEU Hostel, Sunrise PG, Friends Apartment"
                  {...register('proposed_name')}
                />
                {errors.proposed_name && (
                  <p className="text-xs text-destructive">{errors.proposed_name.message}</p>
                )}
              </div>

              {/* Residential Type */}
              <div className="space-y-2">
                <Label htmlFor="proposed_type">
                  Residence Type <span className="text-destructive">*</span>
                </Label>
                <select
                  id="proposed_type"
                  {...register('proposed_type')}
                  className="flex h-11 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="hostel">Hostel (Boys / Girls Wing)</option>
                  <option value="pg">Paying Guest (PG)</option>
                  <option value="apartment">Student Apartment / Society</option>
                  <option value="other">Other Student Living</option>
                </select>
                {errors.proposed_type && (
                  <p className="text-xs text-destructive">{errors.proposed_type.message}</p>
                )}
              </div>

              {/* College Affiliation (Optional metadata) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="college_affiliation">Affiliated College / University</Label>
                  <span className="text-[11px] text-muted-foreground font-medium">Optional</span>
                </div>
                <Input
                  id="college_affiliation"
                  placeholder="e.g. PDEU, NIFT, DA-IICT (optional metadata)"
                  {...register('college_affiliation')}
                />
                <p className="text-[11px] text-muted-foreground">
                  Colleges are optional context tags. Communities belong to the physical residence.
                </p>
                {errors.college_affiliation && (
                  <p className="text-xs text-destructive">{errors.college_affiliation.message}</p>
                )}
              </div>

              {/* Physical Street Address */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="address">
                    Physical Street Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="address"
                    placeholder="e.g. Near Knowledge Corridor, Raysan"
                    {...register('address')}
                  />
                  {errors.address && (
                    <p className="text-xs text-destructive">{errors.address.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input id="city" placeholder="e.g. Gandhinagar" {...register('city')} />
                  {errors.city && (
                    <p className="text-xs text-destructive">{errors.city.message}</p>
                  )}
                </div>
              </div>

              {/* Delivery Pickup Point */}
              <div className="space-y-2">
                <Label htmlFor="proposed_delivery_pickup_point">
                  Shared Delivery Pickup Point <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="proposed_delivery_pickup_point"
                  placeholder="e.g. Main Security Desk, Gate 1 Porch, Tower B Foyer"
                  {...register('proposed_delivery_pickup_point')}
                />
                <p className="text-[11px] text-muted-foreground">
                  Where delivery agents hand over group grocery bags.
                </p>
                {errors.proposed_delivery_pickup_point && (
                  <p className="text-xs text-destructive">
                    {errors.proposed_delivery_pickup_point.message}
                  </p>
                )}
              </div>

              {/* Taxi Pickup Point */}
              <div className="space-y-2">
                <Label htmlFor="proposed_taxi_pickup_point">
                  Shared Taxi Pickup Point <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="proposed_taxi_pickup_point"
                  placeholder="e.g. Hostel Circle, Main Gate Arch, Society Gate 2"
                  {...register('proposed_taxi_pickup_point')}
                />
                <p className="text-[11px] text-muted-foreground">
                  The exact meetup curb for shared taxi arrivals.
                </p>
                {errors.proposed_taxi_pickup_point && (
                  <p className="text-xs text-destructive">
                    {errors.proposed_taxi_pickup_point.message}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting Request...
                    </span>
                  ) : (
                    'Submit for Staff Verification'
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
};
