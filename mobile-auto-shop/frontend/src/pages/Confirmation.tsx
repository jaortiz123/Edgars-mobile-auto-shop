import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, Calendar, Clock, MapPin, ArrowLeft, Wrench } from 'lucide-react';
import type { Appointment } from '../services/api';
import { useEffect } from 'react';

export default function Confirmation() {
  const location = useLocation();
  const { appointment } = (location.state as { appointment: Appointment }) || {};

  // Redirect to booking if no appointment data
  useEffect(() => {
    if (!appointment && location.state === null) {
      // Redirect to booking page after a short delay
      const timeout = setTimeout(() => {
        window.location.href = '/booking';
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [appointment, location.state]);

  if (!appointment) {
    return (
      <div className="max-w-lg mx-auto my-12 bg-yellow-50 p-8 rounded-xl border border-yellow-200 text-center">
        <p className="text-lg text-yellow-800 mb-6">No appointment information found.</p>
        <p className="text-sm text-yellow-700 mb-6">You will be redirected to the booking page shortly...</p>
        <Link to="/booking" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Booking
        </Link>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fadeInUp">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Booking Confirmed!</h2>
        <p className="text-gray-600 mb-8">Your appointment has been successfully booked.</p>
        
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 mb-8">
          <div className="flex flex-col items-start space-y-4 text-left">
            <div className="flex items-center">
              <div className="bg-blue-100 p-2 rounded-md mr-4">
                <Wrench className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Service</div>
                <div className="font-semibold">Service #{appointment.service_id}</div>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="bg-blue-100 p-2 rounded-md mr-4">
                <Calendar className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Date</div>
                <div className="font-semibold">{formatDate(appointment.scheduled_date)}</div>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="bg-blue-100 p-2 rounded-md mr-4">
                <Clock className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Time</div>
                <div className="font-semibold">{appointment.scheduled_time}</div>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="bg-blue-100 p-2 rounded-md mr-4">
                <MapPin className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Location</div>
                <div className="font-semibold">{appointment.location_address}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-8 text-sm">
          <p className="text-gray-700">
            Your appointment reference number is <span className="font-mono font-bold text-blue-700">#{appointment.id}</span>.
            Please save this for your records.
          </p>
        </div>
        
        <p className="text-gray-600 mb-8">
          We've sent a confirmation to your email. If you need to make any changes, please call us at (555) 123-4567.
        </p>
        
        <Link 
          to="/" 
          className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
