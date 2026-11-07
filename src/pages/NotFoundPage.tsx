import React from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Compass, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <PageContainer maxWidth="sm" className="min-h-[50vh] flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Compass className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-foreground mb-2">Page Not Found</h1>
      <p className="text-sm text-muted-foreground mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/">
        <Button className="gap-2 font-semibold">
          <Home className="w-4 h-4" />
          <span>Return Home</span>
        </Button>
      </Link>
    </PageContainer>
  );
};
