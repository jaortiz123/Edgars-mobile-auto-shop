// Task: Create AdminAppointments React page
import React, { useEffect, useState } from 'react';
import { getAdminAppointmentsToday, updateAppointment } from '../services/apiService';

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    getAdminAppointmentsToday()
      .then(data => {
        setAppointments(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch appointments');
        setLoading(false);
      });
  }, []);

  const handleMarkComplete = async (id: string) => {
    setUpdatingId(id);
    try {
      await updateAppointment(id, { status: 'completed' });
      setAppointments(appts => appts.map(appt => appt.id === id ? { ...appt, status: 'completed' } : appt));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to update appointment');
      } else {
        setError('Failed to update appointment');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Edgar's Daily Schedule</h1>
      {loading && <p>Loading appointments...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">Customer Name</th>
              <th className="border px-4 py-2">Service ID</th>
              <th className="border px-4 py-2">Time</th>
              <th className="border px-4 py-2">Address</th>
              <th className="border px-4 py-2">Status</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appt, idx) => (
              <tr key={idx}>
                <td className="border px-4 py-2">{appt.customer_name || appt.customer_id}</td>
                <td className="border px-4 py-2">{appt.service_id}</td>
                <td className="border px-4 py-2">{appt.scheduled_at || appt.scheduled_time}</td>
                <td className="border px-4 py-2">{appt.location_address}</td>
                <td className="border px-4 py-2">{appt.status}</td>
                <td className="border px-4 py-2">
                  {appt.status !== 'completed' && (
                    <button
                      className="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
                      onClick={() => handleMarkComplete(appt.id)}
                      disabled={updatingId === appt.id}
                    >
                      {updatingId === appt.id ? 'Updating...' : 'Mark Complete'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
