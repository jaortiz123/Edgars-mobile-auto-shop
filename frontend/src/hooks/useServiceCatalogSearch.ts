import { useMemo } from 'react';
import raw from '@/data/serviceCatalog.json';
import type { ServiceCatalogItem, ServiceCatalogSearchIndex } from '@/types/serviceCatalog';
import { buildServiceCatalogIndex } from '@/types/serviceCatalog';

// Phase 2 Increment 1: read-only search hook (static JSON source)
// Future: replace static import w/ API fetch + SWR caching.
export function useServiceCatalogSearch(): ServiceCatalogSearchIndex {
  return useMemo(() => {
    const items = raw as ServiceCatalogItem[];
    return buildServiceCatalogIndex(items);
  }, []);
}

export default useServiceCatalogSearch;
