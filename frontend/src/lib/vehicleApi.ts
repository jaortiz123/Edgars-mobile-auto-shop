// Vehicle API functions for Milestone 2
import type { AddVehiclePayload } from '@/components/admin/EditCustomerDialog';

const API_BASE = '/api/admin';

export interface CreateVehicleRequest {
  customer_id: number;
  make: string;
  model: string;
  year: number;
  vin?: string;
  license_plate?: string;
  notes?: string;
}

export interface CreateVehicleResponse {
  id: number;
  customer_id: number;
  make: string;
  model: string;
  year: number;
  vin?: string;
  license_plate?: string;
  notes?: string;
  is_primary?: boolean;
  is_active?: boolean;
}

export interface UpdateVehicleRequest {
  is_primary?: boolean;
  is_active?: boolean;
}

export interface TransferVehicleRequest {
  customer_id: number;
}

/**
 * Create a new vehicle for a customer
 */
export async function createVehicle(
  customerId: number,
  vehicleData: AddVehiclePayload
): Promise<CreateVehicleResponse> {
  const payload: CreateVehicleRequest = {
    customer_id: customerId,
    make: vehicleData.make,
    model: vehicleData.model,
    year: vehicleData.year,
    vin: vehicleData.vin || undefined,
    license_plate: vehicleData.license_plate || undefined,
    notes: vehicleData.notes || undefined,
  };

  const response = await fetch(`${API_BASE}/vehicles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
    throw new Error(`Failed to create vehicle: ${errorMessage}`);
  }

  return response.json();
}

/**
 * Update a vehicle (for Milestone 3 - Set Primary, Mark Inactive)
 */
export async function updateVehicle(
  vehicleId: string,
  updates: UpdateVehicleRequest,
  etag?: string
): Promise<CreateVehicleResponse> {
  const response = await fetch(`${API_BASE}/vehicles/${vehicleId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(etag && { 'If-Match': etag }),
    },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
    throw new Error(`Failed to update vehicle: ${errorMessage}`);
  }

  return response.json();
}

/**
 * Transfer a vehicle to another customer (for Milestone 3 - Vehicle Transfer)
 */
export async function transferVehicle(
  vehicleId: string,
  targetCustomerId: string
): Promise<{ success: boolean; vehicle: CreateVehicleResponse }> {
  const payload: TransferVehicleRequest = {
    customer_id: parseInt(targetCustomerId, 10),
  };

  const response = await fetch(`${API_BASE}/vehicles/${vehicleId}/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
    throw new Error(`Failed to transfer vehicle: ${errorMessage}`);
  }

  return response.json();
}
