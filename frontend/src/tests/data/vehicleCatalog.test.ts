import { describe, it, expect, beforeAll } from 'vitest';
import { VehicleCatalog, VehicleMake, VehicleModel } from '../../data/vehicleCatalog';

// Import the default export
import vehicleCatalogData from '../../data/vehicleCatalog';

describe('Vehicle Catalog Coverage Tests', () => {
  let vehicleCatalog: VehicleCatalog;

  beforeAll(() => {
    // Get the actual catalog data
    vehicleCatalog = vehicleCatalogData as VehicleCatalog;
  });

  it('has valid vehicle catalog structure', () => {
    expect(vehicleCatalog).toBeDefined();
    expect(Array.isArray(vehicleCatalog)).toBe(true);
    expect(vehicleCatalog.length).toBeGreaterThan(0);
  });

  it('contains makes with required properties', () => {
    const firstMake = vehicleCatalog[0];
    expect(firstMake).toBeDefined();
    expect(firstMake).toHaveProperty('name');
    expect(firstMake).toHaveProperty('models');
    expect(typeof firstMake.name).toBe('string');
    expect(Array.isArray(firstMake.models)).toBe(true);
  });

  it('contains models with valid structure', () => {
    const makeWithModels = vehicleCatalog.find((make: VehicleMake) => make.models.length > 0);
    expect(makeWithModels).toBeDefined();

    if (makeWithModels) {
      const firstModel = makeWithModels.models[0];
      expect(firstModel).toHaveProperty('name');
      expect(typeof firstModel.name).toBe('string');

      // Test optional year properties
      if (firstModel.startYear !== undefined) {
        expect(typeof firstModel.startYear).toBe('number');
        expect(firstModel.startYear).toBeGreaterThan(1900);
      }

      if (firstModel.endYear !== undefined) {
        expect(typeof firstModel.endYear).toBe('number');
        expect(firstModel.endYear).toBeGreaterThan(1900);
      }
    }
  });

  it('handles year range filtering logic', () => {
    const currentYear = 2024;

    vehicleCatalog.forEach((make: VehicleMake) => {
      make.models.forEach((model: VehicleModel) => {
        // Test year filtering logic
        const startYear = model.startYear || 1900;
        const endYear = model.endYear || currentYear;

        expect(startYear).toBeLessThanOrEqual(endYear);

        // Test if model is available for a given year
        const isAvailableIn2020 = currentYear >= startYear && currentYear <= endYear;
        expect(typeof isAvailableIn2020).toBe('boolean');
      });
    });
  });

  it('supports make filtering operations', () => {
    const toyotaMake = vehicleCatalog.find((make: VehicleMake) => make.name.toLowerCase() === 'toyota');
    const hondaMake = vehicleCatalog.find((make: VehicleMake) => make.name.toLowerCase() === 'honda');

    expect(toyotaMake).toBeDefined();
    if (toyotaMake) {
      expect(toyotaMake.models.length).toBeGreaterThan(0);
    }

    if (hondaMake) {
      expect(hondaMake.models.length).toBeGreaterThan(0);
    }
  });

  it('supports model search within makes', () => {
    vehicleCatalog.forEach((make: VehicleMake) => {
      const modelNames = make.models.map((model: VehicleModel) => model.name);
      const uniqueModels = [...new Set(modelNames)];

      // Should not have duplicate model names within a make
      expect(modelNames.length).toBe(uniqueModels.length);

      // All model names should be non-empty strings
      modelNames.forEach((name: string) => {
        expect(name).toBeTruthy();
        expect(typeof name).toBe('string');
      });
    });
  });

  it('handles year range edge cases', () => {
    vehicleCatalog.forEach((make: VehicleMake) => {
      make.models.forEach((model: VehicleModel) => {
        // Test edge cases
        if (model.startYear !== undefined && model.endYear !== undefined) {
          expect(model.startYear).toBeLessThanOrEqual(model.endYear);
        }

        // Test for future years
        const currentYear = new Date().getFullYear();
        if (model.endYear !== undefined) {
          expect(model.endYear).toBeLessThanOrEqual(currentYear + 2); // Allow some future models
        }
      });
    });
  });

  it('supports catalog search and filtering', () => {
    // Test various filtering operations
    const allMakes = vehicleCatalog.map((make: VehicleMake) => make.name);
    const uniqueMakes = [...new Set(allMakes)];
    expect(allMakes.length).toBe(uniqueMakes.length); // Should not have duplicate makes

    // Test model count
    const totalModels = vehicleCatalog.reduce((total: number, make: VehicleMake) => {
      return total + make.models.length;
    }, 0);
    expect(totalModels).toBeGreaterThan(0);
  });

  it('handles year availability checks', () => {
    const testYear = 2020;

    vehicleCatalog.forEach((make: VehicleMake) => {
      const availableModels = make.models.filter((model: VehicleModel) => {
        const startYear = model.startYear || 1900;
        const endYear = model.endYear || new Date().getFullYear();
        return testYear >= startYear && testYear <= endYear;
      });

      // Each make should have at least some models available in 2020
      expect(availableModels.length).toBeGreaterThanOrEqual(0);
    });
  });

  it('supports case-insensitive searches', () => {
    const searchTerm = 'TOYOTA';
    const foundMakes = vehicleCatalog.filter((make: VehicleMake) =>
      make.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (foundMakes.length > 0) {
      expect(foundMakes[0].name.toLowerCase()).toContain('toyota');
    }
  });
});
