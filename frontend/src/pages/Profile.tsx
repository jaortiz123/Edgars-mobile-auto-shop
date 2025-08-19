import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import VehicleList from '../components/VehicleList';
import VehicleForm from '../components/VehicleForm';
import UserDashboard from '../components/UserDashboard';
import type { ProfileData } from '../services/authService';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  license_plate?: string;
}

const Profile: React.FC = () => {
  const { user, updateProfile, isLoading, error } = useAuth();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile' | 'vehicles'>('dashboard');
  const [formData, setFormData] = useState<ProfileData>({
    email: '',
    vehicles: []
  });

  // Memoize initial form data to prevent unnecessary re-initialization
  const initialFormData = useMemo(() => ({
    email: user?.profile?.email || '',
    vehicles: user?.profile?.vehicles || []
  }), [user?.profile]);

  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  const handleSaveProfile = useCallback(async () => {
    if (!formData.email.trim()) {
      showToast({
        type: 'error',
        title: 'Email required',
        message: 'Please enter a valid email address.',
        duration: 3000
      });
      return;
    }

    try {
      await updateProfile(formData);
      showToast({
        type: 'success',
        title: 'Profile updated!',
        message: 'Your profile has been saved successfully.',
        duration: 3000
      });
      setIsEditing(false);
    } catch (updateError) {
      const errorMessage = updateError instanceof Error
        ? updateError.message
        : 'There was an error updating your profile. Please try again.';

      showToast({
        type: 'error',
        title: 'Update failed',
        message: errorMessage,
        duration: 5000
      });
    }
  }, [formData, updateProfile, showToast]);

  const handleAddVehicle = useCallback((vehicle: Omit<Vehicle, 'id'>) => {
    // Generate a more robust temporary ID using crypto if available
    const generateTempId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `temp-${crypto.randomUUID()}`;
      }
      return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    const newVehicle: Vehicle = {
      ...vehicle,
      id: generateTempId()
    };

    setFormData(prev => ({
      ...prev,
      vehicles: [...(prev.vehicles || []), newVehicle]
    }));
    setShowVehicleForm(false);
    showToast({
      type: 'success',
      title: 'Vehicle added!',
      message: `${vehicle.year} ${vehicle.make} ${vehicle.model} has been added to your profile.`,
      duration: 3000
    });
  }, [showToast]);

  const handleEditVehicle = useCallback((vehicleId: string, updatedVehicle: Omit<Vehicle, 'id'>) => {
    setFormData(prev => ({
      ...prev,
      vehicles: (prev.vehicles || []).map(vehicle =>
        vehicle.id === vehicleId ? { ...updatedVehicle, id: vehicleId } : vehicle
      )
    }));
  }, []);

  const handleDeleteVehicle = useCallback((vehicleId: string) => {
    const vehicleToDelete = formData.vehicles?.find(v => v.id === vehicleId);
    setFormData(prev => ({
      ...prev,
      vehicles: (prev.vehicles || []).filter(vehicle => vehicle.id !== vehicleId)
    }));

    if (vehicleToDelete) {
      showToast({
        type: 'info',
        title: 'Vehicle removed',
        message: `${vehicleToDelete.year} ${vehicleToDelete.make} ${vehicleToDelete.model} has been removed.`,
        duration: 3000
      });
    }
  }, [formData.vehicles, showToast]);

  // Memoize tabs to prevent unnecessary re-renders
  const tabs = useMemo(() => [
    {
      id: 'dashboard' as const,
      name: 'Dashboard',
      icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z',
      ariaLabel: 'Dashboard tab'
    },
    {
      id: 'profile' as const,
      name: 'Profile',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      ariaLabel: 'Profile information tab'
    },
    {
      id: 'vehicles' as const,
      name: 'Vehicles',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      ariaLabel: 'My vehicles tab'
    }
  ], []);

  const handleTabChange = useCallback((tabId: typeof activeTab) => {
    setActiveTab(tabId);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status" aria-label="Loading profile">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Tab Navigation */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Profile sections" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                  role="tab"
                  aria-selected={activeTab === tab.id ? "true" : "false"}
                  aria-controls={`${tab.id}-panel`}
                  aria-label={tab.ariaLabel}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white shadow rounded-lg">
          {activeTab === 'dashboard' && (
            <div className="p-6" role="tabpanel" id="dashboard-panel" aria-labelledby="dashboard-tab">
              <UserDashboard />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="p-6" role="tabpanel" id="profile-panel" aria-labelledby="profile-tab">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Profile Information</h1>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-pressed={isEditing ? "true" : "false"}
                  aria-label={isEditing ? 'Cancel editing profile' : 'Edit profile information'}
                >
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-4" role="alert" aria-live="polite">
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      aria-describedby={error ? 'email-error' : undefined}
                      required
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{formData.email}</p>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    aria-describedby="save-status"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <span id="save-status" className="sr-only">
                    {isLoading ? 'Saving profile changes' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="p-6" role="tabpanel" id="vehicles-panel" aria-labelledby="vehicles-tab">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Vehicles</h1>
                <button
                  onClick={() => setShowVehicleForm(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-label="Add a new vehicle"
                >
                  Add Vehicle
                </button>
              </div>

              <VehicleList
                vehicles={formData.vehicles || []}
                onEdit={handleEditVehicle}
                onDelete={handleDeleteVehicle}
              />

              {showVehicleForm && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                  <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                      <VehicleForm
                        onSubmit={handleAddVehicle}
                        onCancel={() => setShowVehicleForm(false)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
