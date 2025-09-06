import React, { useState, useEffect } from 'react';
import { Appointment, AppointmentStatus, Customer, Vehicle } from '../../types/models';
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getCustomers,
  getVehicles
} from '../../lib/api';

// Status color mapping for badges
const getStatusColor = (status: AppointmentStatus) => {
  switch (status) {
    case 'SCHEDULED': return 'bg-blue-100 text-blue-800';
    case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
    case 'READY': return 'bg-green-100 text-green-800';
    case 'COMPLETED': return 'bg-gray-100 text-gray-800';
    case 'NO_SHOW': return 'bg-red-100 text-red-800';
    case 'CANCELED': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

// Status transition mapping
const getNextStatuses = (currentStatus: AppointmentStatus): AppointmentStatus[] => {
  switch (currentStatus) {
    case 'SCHEDULED': return ['IN_PROGRESS', 'CANCELED', 'NO_SHOW'];
    case 'IN_PROGRESS': return ['READY', 'SCHEDULED'];
    case 'READY': return ['COMPLETED', 'IN_PROGRESS'];
    case 'COMPLETED': return [];
    case 'NO_SHOW': return ['SCHEDULED'];
    case 'CANCELED': return ['SCHEDULED'];
    default: return [];
  }
};

interface AppointmentFormData {
  customer_id: string;
  vehicle_id: string;
  start_ts: string;
  end_ts?: string;
  status: AppointmentStatus;
  title?: string;
  notes?: string;
  total_amount?: number;
}

const AppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState<AppointmentFormData>({
    customer_id: '',
    vehicle_id: '',
    start_ts: '',
    status: 'SCHEDULED'
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [appointmentsData, customersData, vehiclesData] = await Promise.all([
        getAppointments(),
        getCustomers(),
        getVehicles()
      ]);

      setAppointments(appointmentsData.appointments);
      setCustomers(customersData);
      setVehicles(vehiclesData);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingAppointment(null);
    setFormData({
      customer_id: '',
      vehicle_id: '',
      start_ts: '',
      status: 'SCHEDULED'
    });
    setShowModal(true);
  };

  const openEditModal = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setFormData({
      customer_id: appointment.customer_id || '',
      vehicle_id: appointment.vehicle_id || '',
      start_ts: appointment.start_ts || appointment.start || '',
      end_ts: appointment.end_ts || appointment.end || '',
      status: appointment.status,
      title: appointment.title || '',
      notes: appointment.notes || '',
      total_amount: appointment.total_amount || undefined
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingAppointment) {
        await updateAppointment(editingAppointment.id, formData);
        setSuccessMessage('Appointment updated successfully');

        // Reload data after update
        await loadData();

        // Delay closing modal to show success message
        setTimeout(() => setShowModal(false), 1500);
      } else {
        const response = await createAppointment(formData);
        setSuccessMessage('Appointment created successfully');

        // Add the created appointment directly to the list
        setAppointments(prev => [...prev, response.appointment]);

        // Delay closing modal to show success message
        setTimeout(() => setShowModal(false), 1500);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { data?: { error?: { details?: { conflicts?: unknown }, message?: string } } } }).response;
        if (response?.data?.error?.details?.conflicts) {
          setError('Scheduling conflict detected. Please choose a different time slot.');
        } else {
          setError(response?.data?.error?.message || 'Failed to save appointment');
        }
      } else {
        setError('Failed to save appointment');
      }
    }
  };  const handleDelete = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) {
      return;
    }

    try {
      // Optimistically remove from UI
      const originalAppointments = [...appointments];
      setAppointments(prev => prev.filter(apt => apt.id !== appointmentId));

      await deleteAppointment(appointmentId);
      setSuccessMessage('Appointment deleted successfully');

      // Verify deletion with server
      await loadData();
    } catch (err) {
      console.error('Delete appointment failed:', err);
      setError('Failed to delete appointment');

      // Rollback optimistic update on error
      await loadData();
    }
  };

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      // Optimistically update local state
      const originalAppointments = [...appointments];
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === appointmentId
            ? { ...apt, status: newStatus }
            : apt
        )
      );

      await updateAppointment(appointmentId, { status: newStatus });
      setSuccessMessage(`Appointment status updated to ${newStatus}`);

      // Verify update with server
      await loadData();
    } catch (err) {
      console.error('Status update failed:', err);
      setError('Failed to update appointment status');

      // Rollback optimistic update on error
      await loadData();
    }
  };

  const getCustomerName = (customerId?: string | null) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  const getVehicleInfo = (vehicleId?: string | null) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return 'Unknown Vehicle';
    return `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.license_plate || 'Unknown Vehicle';
  };

  const formatDateTime = (dateTime?: string | null) => {
    if (!dateTime) return '-';
    try {
      return new Date(dateTime).toLocaleString();
    } catch {
      return dateTime;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600">Manage your shop's appointment schedule</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          New Appointment
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {appointments.map((appointment) => (
                <tr key={appointment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getCustomerName(appointment.customer_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {getVehicleInfo(appointment.vehicle_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {appointment.title || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDateTime(appointment.start_ts || appointment.start)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                      {getNextStatuses(appointment.status).length > 0 && (
                        <select
                          value=""
                          onChange={(e) => e.target.value && handleStatusChange(appointment.id, e.target.value as AppointmentStatus)}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                          aria-label="Change appointment status"
                        >
                          <option value="">Change to...</option>
                          {getNextStatuses(appointment.status).map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {appointment.total_amount ? `$${appointment.total_amount.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => openEditModal(appointment)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(appointment.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No appointments found. Create your first appointment to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  {editingAppointment ? 'Edit Appointment' : 'New Appointment'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    aria-label="Select customer"
                  >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle *
                  </label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    aria-label="Select vehicle"
                  >
                    <option value="">Select a vehicle</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {getVehicleInfo(vehicle.id)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.start_ts ? new Date(formData.start_ts).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setFormData({ ...formData, start_ts: new Date(e.target.value).toISOString() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    aria-label="Appointment start time"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.end_ts ? new Date(formData.end_ts).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setFormData({ ...formData, end_ts: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Appointment end time"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as AppointmentStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Appointment status"
                  >
                    <option value="SCHEDULED">SCHEDULED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="READY">READY</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="NO_SHOW">NO_SHOW</option>
                    <option value="CANCELED">CANCELED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief description of the work"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional notes or special instructions"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.total_amount || ''}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    {editingAppointment ? 'Update' : 'Create'} Appointment
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
