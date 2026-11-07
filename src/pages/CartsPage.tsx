import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  PlusCircle,
  Clock,
  MessageSquare,
  Store,
  Info,
} from 'lucide-react';
import type { GroupCart } from '@/types';

// Foundation mockup demonstrating data structure and peer-to-peer model
const SAMPLE_CARTS: (GroupCart & { community_name: string; items_count: number })[] = [
  {
    id: 'cart-1',
    community_id: 'c1',
    community_name: 'PDEU Hostel',
    created_by_user_id: 'u1',
    title: 'Midnight Snacks & Energy Drinks',
    store_name: 'Zepto',
    status: 'open',
    lock_at: new Date(Date.now() + 3600 * 1000 * 2).toISOString(),
    pickup_instructions: 'Will collect at Hostel Gate 1 security desk and ping in group chat',
    total_estimated_amount: 480,
    items_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cart-2',
    community_id: 'c2',
    community_name: 'PDEU Girls Hostel',
    created_by_user_id: 'u2',
    title: 'Sunday Morning Fruits & Milk',
    store_name: 'Blinkit',
    status: 'locked',
    lock_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    pickup_instructions: 'Order placed, arriving at Block G Foyer in 15 mins',
    total_estimated_amount: 820,
    items_count: 9,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const CartsPage: React.FC = () => {
  return (
    <PageContainer
      title="Group Grocery Orders"
      subtitle="Pool grocery items with neighbors to save delivery fees. Group carts feature product lists, lock timers, and private group chat."
      action={
        <Button className="gap-2 font-semibold">
          <PlusCircle className="w-4 h-4" />
          <span>Start Group Cart</span>
        </Button>
      }
    >
      {/* Product Rule Notice */}
      <div className="mb-6 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs flex items-start gap-3">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Peer-to-Peer Model:</strong> Students coordinate who places the order, pays the store directly, and collects at the verified gate. Yuvnix does not charge students or process payments.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SAMPLE_CARTS.map((cart) => (
          <Card key={cart.id} className="hover:border-primary/40 transition-all flex flex-col justify-between">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant="outline" className="mb-1.5 text-[11px]">
                    {cart.community_name}
                  </Badge>
                  <CardTitle className="text-lg font-bold">{cart.title}</CardTitle>
                </div>
                <StatusBadge status={cart.status} />
              </div>

              {cart.store_name && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Store className="w-3.5 h-3.5 text-primary" />
                  <span>Store: <strong>{cart.store_name}</strong></span>
                </div>
              )}

              <CardDescription className="text-xs">
                {cart.pickup_instructions}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-muted/50 border border-border/50">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Locking soon
                </span>
                <span className="font-semibold text-foreground">
                  {cart.items_count} items pooled
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Group Chat</span>
                </Button>
                <Button size="sm" variant="default" className="text-xs">
                  View Items
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
};
