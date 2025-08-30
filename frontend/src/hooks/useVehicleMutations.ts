import { useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';

// Types for vehicle operations
export interface VehicleCreateData {
  customer_id: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  license_plate?: string;
  notes?: string;
}

export interface VehicleUpdateData {
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  license_plate?: string;
  notes?: string;
}

export interface VehicleApiResponse {
  id: string;
  customer_id: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  license_plate?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Vehicle Mutations Hook
 *
 * Encapsulates all vehicle CRUD operations with proper error handling,
 * loading states, and cache invalidation for the Customer Profile Foundation.
 */
export function useVehicleMutations(customerId: string) {
  const queryClient = useQueryClient();

  // Create vehicle mutation
  const createVehicle = useMutation({
    mutationFn: async (vehicleData: Omit<VehicleCreateData, 'customer_id'>): Promise<VehicleApiResponse> => {
      const response = await http.post('/api/admin/vehicles', {
        ...vehicleData,
        customer_id: customerId,
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate customer profile queries to refresh the vehicle list
      queryClient.invalidateQueries({
        queryKey: ['customerProfile', customerId],
      });
    },
    onError: (error: unknown) => {
      console.error('Failed to create vehicle:', error);
    },
  });

  // Update vehicle mutation
  const updateVehicle = useMutation({
    mutationFn: async ({ vehicleId, data, etag }: {
      vehicleId: string;
      data: VehicleUpdateData;
      etag?: string;
    }): Promise<VehicleApiResponse> => {
      const headers: Record<string, string> = {};
      if (etag) {
        headers['If-Match'] = etag;
      }

      const response = await http.patch(`/api/admin/vehicles/${vehicleId}`, data, {
        headers,
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate customer profile queries to refresh the vehicle list
      queryClient.invalidateQueries({
        queryKey: ['customerProfile', customerId],
      });
    },
    onError: (error: unknown) => {
      console.error('Failed to update vehicle:', error);
    },
  });

  // Delete vehicle mutation
  const deleteVehicle = useMutation({
    mutationFn: async (vehicleId: string): Promise<void> => {
      await http.delete(`/api/admin/vehicles/${vehicleId}`);
    },
    onSuccess: () => {
      // Invalidate customer profile queries to refresh the vehicle list
      queryClient.invalidateQueries({
        queryKey: ['customerProfile', customerId],
      });
    },
    onError: (error: unknown) => {
      console.error('Failed to delete vehicle:', error);
    },
  });

  return {
    createVehicle: {
      mutate: createVehicle.mutate,
      mutateAsync: createVehicle.mutateAsync,
      isLoading: createVehicle.isPending,
      error: createVehicle.error,
      reset: createVehicle.reset,
    },
    updateVehicle: {
      mutate: updateVehicle.mutate,
      mutateAsync: updateVehicle.mutateAsync,
      isLoading: updateVehicle.isPending,
      error: updateVehicle.error,
      reset: updateVehicle.reset,
    },
    deleteVehicle: {
      mutate: deleteVehicle.mutate,
      mutateAsync: deleteVehicle.mutateAsync,
      isLoading: deleteVehicle.isPending,
      error: deleteVehicle.error,
      reset: deleteVehicle.reset,
    },
  };
}
