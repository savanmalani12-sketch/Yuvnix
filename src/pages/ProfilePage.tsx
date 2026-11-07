import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/utils/formatters';
import { Mail, Shield, LogOut, LogIn } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, profile, isAuthenticated, signInWithGoogle, signOut } = useAuth();

  return (
    <PageContainer maxWidth="md" title="Student Profile" subtitle="Your account and residential settings">
      {isAuthenticated && user ? (
        <Card className="shadow-elevated border-border/80">
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <Avatar className="w-16 h-16 ring-4 ring-primary/20">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
              )}
              <AvatarFallback className="text-base font-bold">
                {getInitials(profile?.full_name || user.email || 'Student')}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl">
                  {profile?.full_name || user.user_metadata?.full_name || 'Student Member'}
                </CardTitle>
                {profile?.username && (
                  <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    @{profile.username}
                  </span>
                )}
              </div>
              <CardDescription className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {user.email}
              </CardDescription>
              <div className="pt-1">
                <Badge variant="default" className="capitalize text-[11px]">
                  {profile?.role || 'student'}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-4 border-t border-border/60">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Account Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                  <span className="text-muted-foreground block mb-0.5">Student Handle</span>
                  <span className="font-mono font-semibold text-primary block">
                    {profile?.username ? `@${profile.username}` : 'Not set'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                  <span className="text-muted-foreground block mb-0.5">Authentication</span>
                  <span className="font-semibold text-foreground">Google OAuth 2.0</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/50 border border-border/50 sm:col-span-2">
                  <span className="text-muted-foreground block mb-0.5">User ID</span>
                  <span className="font-mono text-muted-foreground truncate block">
                    {user.id}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="destructive"
                className="w-full gap-2 font-semibold"
                onClick={() => signOut()}
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Yuvnix</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="text-center p-8 space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-xl">Student Sign In</CardTitle>
            <CardDescription className="max-w-sm mx-auto">
              Sign in with your student Google account to join your residence, pool groceries, and split rides.
            </CardDescription>
          </div>
          <Button
            size="lg"
            className="gap-2 font-semibold shadow-card mx-auto"
            onClick={() => signInWithGoogle()}
          >
            <LogIn className="w-4 h-4" />
            <span>Continue with Google</span>
          </Button>
        </Card>
      )}
    </PageContainer>
  );
};
