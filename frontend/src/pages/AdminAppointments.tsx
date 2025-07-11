// Task: Create AdminAppointments React page
import React, { useEffect, useState } from 'react';
import { getAppointments } from '../services/apiService';

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAppointments()
      .then(data => {
        setAppointments(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch appointments');
        setLoading(false);
      });
  }, []);

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Edgar's Daily Appointments</h1>
      {loading && <p>Loading appointments...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">Customer ID</th>
              <th className="border px-4 py-2">Service ID</th>
              <th className="border px-4 py-2">Date</th>
              <th className="border px-4 py-2">Time</th>
              <th className="border px-4 py-2">Address</th>
              <th className="border px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appt, idx) => (
              <tr key={idx}>
                <td className="border px-4 py-2">{appt.customer_id}</td>
                <td className="border px-4 py-2">{appt.service_id}</td>
                <td className="border px-4 py-2">{appt.scheduled_date}</td>
                <td className="border px-4 py-2">{appt.scheduled_time}</td>
                <td className="border px-4 py-2">{appt.location_address}</td>
                <td className="border px-4 py-2">{appt.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
