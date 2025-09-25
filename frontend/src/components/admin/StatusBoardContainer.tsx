// Feature Flag Controlled StatusBoardV2 Component
// Sprint 6 T8 - Production-ready with feature flag control and rollback capability

import React, { Suspense } from 'react';
import { useFeatureFlags } from '../../utils/featureFlags';
import StatusBoardV2WithSuspense from './StatusBoardV2';
import { RefreshCw } from 'lucide-react';

// Original StatusBoard fallback (V1)
const StatusBoardV1Fallback = React.lazy(() =>
  import('./StatusBoard').then(module => ({ default: module.default }))
);

interface StatusBoardContainerProps {
  onCardClick?: (appointment: any) => void;
  minimalHero?: boolean;
}

const StatusBoardContainer: React.FC<StatusBoardContainerProps> = (props) => {
  const { isEnabled } = useFeatureFlags();

  // Feature flag controlled rendering
  if (isEnabled('statusBoardV2Enabled')) {
    return <StatusBoardV2WithSuspense {...props} />;
  }

  // Fallback to original StatusBoard (V1)
  const handleV1CardClick = (id: string) => {
    // Convert V1 onOpen callback to V2 onCardClick format
    if (props.onCardClick) {
      // In V1, we only get ID, so we need to mock the appointment object
      props.onCardClick({ id } as any);
    }
  };

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading Status Board (Legacy)...</span>
          </div>
        </div>
      }
    >
      <StatusBoardV1Fallback
        onOpen={handleV1CardClick}
        minimalHero={props.minimalHero}
      />
    </Suspense>
  );
};

export default StatusBoardContainer;
