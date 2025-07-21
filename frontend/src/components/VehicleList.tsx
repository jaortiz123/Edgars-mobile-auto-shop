import React, { useState } from 'react';
import VehicleForm from './VehicleForm';

interface Vehicle {
  id?: string;
  make: string;
  model: string;
  year: number;
  license_plate?: string;
}

interface VehicleListProps {
  vehicles: Vehicle[];
  onEdit: (vehicleId: string, updatedVehicle: { make: string; model: string; year: number; license_plate?: string }) => void;
  onDelete: (vehicleId: string) => void;
}

const VehicleList: React.FC<VehicleListProps> = ({ vehicles, onEdit, onDelete }) => {
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  const handleEditSubmit = (vehicleData: { make: string; model: string; year: number; license_plate?: string }) => {
    if (editingVehicleId) {
      onEdit(editingVehicleId, vehicleData);
      setEditingVehicleId(null);
    }
  };

  const handleDeleteClick = (vehicleId: string, vehicleName: string) => {
    if (window.confirm(`Are you sure you want to delete ${vehicleName}?`)) {
      onDelete(vehicleId);
    }
  };

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No vehicles</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by adding your first vehicle.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {vehicles.map((vehicle) => (
        <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-6 w-6 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  {vehicle.license_plate && (
                    <p className="text-sm text-gray-500">License: {vehicle.license_plate}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setEditingVehicleId(vehicle.id || '')}
                className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => handleDeleteClick(vehicle.id || '', `${vehicle.year} ${vehicle.make} ${vehicle.model}`)}
                className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Edit Vehicle Modal */}
      {editingVehicleId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <VehicleForm
                vehicle={vehicles.find(v => v.id === editingVehicleId)}
                onSubmit={handleEditSubmit}
                onCancel={() => setEditingVehicleId(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleList;
