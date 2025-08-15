import { describe, it, expect } from 'vitest';
import raw from '@/data/serviceCatalog.json';
import { buildServiceCatalogIndex, type ServiceCatalogItem } from '@/types/serviceCatalog';

describe('buildServiceCatalogIndex / search', () => {
  const index = buildServiceCatalogIndex(raw as ServiceCatalogItem[]);

  it('returns all items when query empty', () => {
    expect(index.search('').length).toBe(index.all.length);
  });

  it('finds by partial name', () => {
    const results = index.search('oil');
    expect(results.some(r => r.name.toLowerCase().includes('oil'))).toBe(true);
  });

  it('finds by synonym', () => {
    const results = index.search('rotation'); // synonym for tire rotation present
    expect(results.some(r => /rotation/i.test(r.name) || r.keywords?.includes('rotation'))).toBe(true);
  });

  it('is case insensitive', () => {
    const a = index.search('BrAkE');
    const b = index.search('brake');
    expect(a.map(x => x.id).sort()).toEqual(b.map(x => x.id).sort());
  });
});
