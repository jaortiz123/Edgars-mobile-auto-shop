import raw from './vehicleCatalog.raw.json';
import type { VehicleCatalog } from './vehicleCatalog';

type RawRange = { start: number | null; end: number | null };
type RawModelValue = RawRange | RawRange[];
type RawMakeModels = Record<string, RawModelValue>;
type RawCatalog = Record<string, RawMakeModels>;

// raw shape: { [make: string]: { [model: string]: { start: number|null, end: number|null } | Array<{start:number|null,end:number|null}> } }
// target: VehicleCatalog = Array<{ name: string; models: Array<{ name: string; startYear?: number; endYear?: number }> }>

function normalizeRange(r: { start: number | null; end: number | null }) {
  return {
    startYear: r.start ?? undefined,
    endYear: r.end ?? undefined,
  } as const;
}

export function buildCatalogFromRaw(): VehicleCatalog {
  const makes: VehicleCatalog = [];
  for (const [make, models] of Object.entries(raw as RawCatalog)) {
    const modelList: { name: string; startYear?: number; endYear?: number }[] = [];
    for (const [model, rangeOrArray] of Object.entries(models)) {
      if (Array.isArray(rangeOrArray)) {
        for (const r of rangeOrArray) {
          const { startYear, endYear } = normalizeRange(r);
          modelList.push({ name: model, startYear, endYear });
        }
      } else if (rangeOrArray && typeof rangeOrArray === 'object') {
        const { startYear, endYear } = normalizeRange(rangeOrArray);
        modelList.push({ name: model, startYear, endYear });
      }
    }
    // If there are duplicate model names with multiple ranges, we keep them as duplicates; filtering step checks ranges.
    makes.push({ name: make, models: modelList });
  }
  return makes;
}

export default buildCatalogFromRaw;
