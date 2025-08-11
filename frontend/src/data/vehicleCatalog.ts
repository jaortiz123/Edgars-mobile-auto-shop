// Minimal vehicle catalog with year ranges. Replace/extend with your curated dataset.
// The UI will filter models by the selected year and show only valid options.

export interface VehicleModel {
  name: string;
  startYear?: number; // inclusive
  endYear?: number;   // inclusive
}

export interface VehicleMake {
  name: string;
  models: VehicleModel[];
}

export type VehicleCatalog = VehicleMake[];

// Example seed data (safe to replace with your full list)
const catalog: VehicleCatalog = [
  {
    name: 'Toyota',
    models: [
      { name: 'Camry', startYear: 1983 },
      { name: 'Corolla', startYear: 1966 },
      { name: 'RAV4', startYear: 1994 },
      { name: 'Tacoma', startYear: 1995 },
      { name: 'Highlander', startYear: 2000 },
    ],
  },
  {
    name: 'Honda',
    models: [
      { name: 'Civic', startYear: 1972 },
      { name: 'Accord', startYear: 1976 },
      { name: 'CR-V', startYear: 1995 },
      { name: 'Pilot', startYear: 2002 },
      { name: 'Odyssey', startYear: 1994 },
    ],
  },
  {
    name: 'Ford',
    models: [
      { name: 'F-150', startYear: 1975 },
      { name: 'Escape', startYear: 2000 },
      { name: 'Explorer', startYear: 1990 },
      { name: 'Focus', startYear: 1998, endYear: 2018 },
      { name: 'Fusion', startYear: 2005, endYear: 2020 },
    ],
  },
];

export default catalog;
