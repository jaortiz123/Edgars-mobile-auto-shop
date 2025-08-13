import catalog from '@/data/serviceCatalog.json';
import type { ServiceDefinition } from '@/types/serviceCatalog';

// Static in-memory catalog (Phase 1). Swap to dynamic fetch in later phase.
const services = catalog as ServiceDefinition[];
const idMap: Record<string, ServiceDefinition> = Object.fromEntries(
  services.map(s => [s.id, s])
);

export function useServiceCatalog() {
  function search(q: string) {
    const needle = q.trim().toLowerCase();
    if (!needle) return services;
    return services.filter(s =>
      s.name.toLowerCase().includes(needle) ||
      s.slug.includes(needle) ||
      (s.synonyms?.some(x => x.includes(needle)) ?? false)
    );
  }
  return { services, byId: idMap, search };
}
