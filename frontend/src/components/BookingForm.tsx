// /frontend/src/components/BookingForm.tsx

import React, { useState } from 'react';
// Import the hardened service function and the reusable payload type.
import { createAppointment, AppointmentPayload } from '../services/apiService';

const BookingForm: React.FC = () => {
  // --- Aligned State Management ---
  // The form state is now typed using the shared AppointmentPayload interface.
  const [formData, setFormData] = useState<AppointmentPayload>({
    customer_id: '',
    service: '',
    requested_time: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // A typed handler to update form state, ensuring type safety.
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Pass the typed formData directly to the service function.
      await createAppointment(formData);
      setSuccessMessage('Appointment booked successfully!');
      // Reset form to its initial state.
      setFormData({ customer_id: '', service: '', requested_time: '' });
    } catch (err) {
      // --- Hardened Error Typing ---
      // Use 'unknown' and perform a type check for more robust error handling.
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Book an Appointment</h2>

      {/* The 'name' attribute of each input now directly corresponds to a key
          in the AppointmentPayload interface, enabling the unified handleInputChange. */}

      <div className="mb-3">
        <label className="block mb-1 font-medium" htmlFor="customer_id">Customer ID</label>
        <input
          type="text"
          id="customer_id"
          name="customer_id"
          value={formData.customer_id}
          onChange={handleInputChange}
          className="w-full border rounded px-2 py-1"
          required
        />
      </div>
      <div className="mb-3">
        <label className="block mb-1 font-medium" htmlFor="service">Service</label>
        <input
          type="text"
          id="service"
          name="service"
          value={formData.service}
          onChange={handleInputChange}
          className="w-full border rounded px-2 py-1"
          required
        />
      </div>
      <div className="mb-3">
        <label className="block mb-1 font-medium" htmlFor="requested_time">Requested Time</label>
        <input
          type="datetime-local"
          id="requested_time"
          name="requested_time"
          value={formData.requested_time}
          onChange={handleInputChange}
          className="w-full border rounded px-2 py-1"
          required
        />
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={isLoading}
      >
        {isLoading ? 'Booking...' : 'Book Appointment'}
      </button>

      {error && <div className="mt-2 text-red-600">{error}</div>}
      {successMessage && <div className="mt-2 text-green-600">{successMessage}</div>}
    </form>
  );
};

export default BookingForm;
