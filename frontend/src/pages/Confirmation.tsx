// /frontend/src/pages/Confirmation.tsx

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Calendar, Clock, MapPin, Mail, Phone, List } from 'lucide-react'; // Import icons for better display

// Define the expected shape of the appointment data passed via state
interface AppointmentConfirmationState {
  appointment: {
    name: string; // Full Name from the form (mapped to customer_id in backend)
    phone?: string;
    email?: string;
    address: string; // Service Address
    date: string; // Preferred Date
    time: string; // Preferred Time
    notes?: string;
    service_name: string; // Selected Service Name
    // Add any other fields you passed from Booking.tsx's state for confirmation
    customer_id?: string; // Optional: If you want to show the backend's customer_id
    service?: string; // Optional: If you want to show the raw service field
    requested_time?: string; // Optional: The ISO string sent to backend
  };
}

export default function Confirmation() {
  const location = useLocation();
  const navigate = useNavigate();

  // Safely get the appointment data from the router state
  const appointment = (location.state as AppointmentConfirmationState)?.appointment;

  // If no appointment data is found, redirect to home or an error page
  if (!appointment) {
    console.error("No appointment data found in state. Redirecting to home.");
    navigate('/');
    return null; // Don't render anything
  }

  // --- FORGED: Date Formatting Function ---
  const formatDisplayDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      console.error("Failed to parse date string:", dateString, e);
      return dateString;
    }
  };

  // --- FORGED: Time Formatting Function ---
  const formatDisplayTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const dummyDate = new Date();
      dummyDate.setHours(parseInt(hours), parseInt(minutes));
      return dummyDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      console.error("Failed to parse time string:", timeString, e);
      return timeString;
    }
  };

  // --- RE-FORGED: Enhanced Display ---
  return (
    <div className="container mx-auto max-w-4xl py-16 px-4 text-center">
      <div className="flex flex-col items-center justify-center mb-8">
        <svg className="h-24 w-24 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 className="text-4xl font-bold text-primary mt-4 mb-2">Booking Confirmed!</h1>
        <p className="text-lg text-muted-foreground">Your appointment is scheduled. We'll be in touch shortly.</p>
      </div>

      <Card className="max-w-2xl mx-auto text-left">
        <CardHeader>
          <CardTitle className="text-2xl">{appointment.service_name}</CardTitle>
          <p className="text-sm text-muted-foreground">Appointment for {appointment.name}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3 text-lg">
            <Calendar className="h-6 w-6 text-accent" />
            <span className="font-medium">Date:</span>{' '}
            <span>{formatDisplayDate(appointment.date)}</span>
          </div>
          <div className="flex items-center space-x-3 text-lg">
            <Clock className="h-6 w-6 text-accent" />
            <span className="font-medium">Time:</span>{' '}
            <span>{formatDisplayTime(appointment.time)}</span>
          </div>
          <div className="flex items-center space-x-3 text-lg">
            <MapPin className="h-6 w-6 text-accent" />
            <span className="font-medium">Address:</span> <span>{appointment.address}</span>
          </div>
          {appointment.phone && (
            <div className="flex items-center space-x-3 text-lg">
              <Phone className="h-6 w-6 text-accent" />
              <span className="font-medium">Phone:</span> <span>{appointment.phone}</span>
            </div>
          )}
          {appointment.email && (
            <div className="flex items-center space-x-3 text-lg">
              <Mail className="h-6 w-6 text-accent" />
              <span className="font-medium">Email:</span> <span>{appointment.email}</span>
            </div>
          )}
          {appointment.notes && (
            <div className="flex items-center space-x-3 text-lg">
              <List className="h-6 w-6 text-accent" />
              <span className="font-medium">Notes:</span> <span>{appointment.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={() => navigate('/')} className="mt-8 px-8 py-3 text-lg">
        Back to Homepage
      </Button>
    </div>
  );
}
