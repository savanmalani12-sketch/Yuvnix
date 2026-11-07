import React from 'react';
import { Badge } from '@/components/ui/badge';
import type {
  CommunityRequestStatus,
  GroupCartStatus,
  SharedRideStatus,
} from '@/types';

type AnyStatus = CommunityRequestStatus | GroupCartStatus | SharedRideStatus;

interface StatusBadgeProps {
  status: AnyStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  switch (status) {
    case 'open':
      return (
        <Badge variant="success" className={className}>
          Open
        </Badge>
      );
    case 'locked':
      return (
        <Badge variant="warning" className={className}>
          Locked
        </Badge>
      );
    case 'ordered':
      return (
        <Badge variant="accent" className={className}>
          Ordered
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="secondary" className={className}>
          Completed
        </Badge>
      );
    case 'cancelled':
    case 'rejected':
      return (
        <Badge variant="destructive" className={className}>
          {status === 'cancelled' ? 'Cancelled' : 'Rejected'}
        </Badge>
      );
    case 'full':
      return (
        <Badge variant="warning" className={className}>
          Full
        </Badge>
      );
    case 'departed':
      return (
        <Badge variant="secondary" className={className}>
          Departed
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="warning" className={className}>
          Under Review
        </Badge>
      );
    case 'approved':
      return (
        <Badge variant="success" className={className}>
          Approved
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={className}>
          {status}
        </Badge>
      );
  }
};
