import { useLocation } from 'react-router-dom';
import { CheckCircle, Calendar, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function Confirmation() {
  const location = useLocation();
  const appointment = location.state?.appointment;

  if (!appointment) {
    return (
      <div className="container mx-auto text-center py-20">
        <h1 className="text-2xl font-bold">No Appointment Data Found</h1>
        <p className="mt-4">Please book an appointment first.</p>
        <Button asLink to="/booking" className="mt-8">Go to Booking</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-12 px-4">
        <div className="text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h1 className="mt-4 text-4xl font-extrabold text-slate-900">Booking Confirmed!</h1>
            <p className="mt-2 text-lg text-slate-600">Your appointment is scheduled. We'll be in touch shortly.</p>
        </div>
        <Card className="mt-12">
            <CardHeader>
                <CardTitle>{appointment.service_name}</CardTitle>
                <CardDescription>Appointment for {appointment.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center">
                    <Calendar className="h-5 w-5 mr-3 text-slate-500" />
                    <span>{appointment.date}</span>
                </div>
                 <div className="flex items-center">
                    <Clock className="h-5 w-5 mr-3 text-slate-500" />
                    <span>{appointment.time}</span>
                </div>
                 <div className="flex items-center">
                    <MapPin className="h-5 w-5 mr-3 text-slate-500" />
                    <span>{appointment.address}</span>
                </div>
            </CardContent>
        </Card>
        <div className="text-center mt-8">
            <Button asLink to="/" variant="outline">Back to Homepage</Button>
        </div>
    </div>
  );
}
