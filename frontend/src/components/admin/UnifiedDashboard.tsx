import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AppointmentFormModal } from './AppointmentFormModal';
import { 
  Calendar,
  Clock,
  Users,
  CheckCircle,
  AlertTriangle,
  Phone,
  Wrench,
  Car,
  MapPin,
  Plus,
  Timer,
  DollarSign,
  TrendingUp,
  Filter,
  MoreVertical
} from 'lucide-react';
import { format, addDays, isSameDay, isToday, isThisWeek, startOfWeek, endOfWeek } from 'date-fns';

interface Appointment {
  id: string;
  customer: string;
  phone: string;
  vehicle: string;
  service: string;
  date: Date;
  time: string;
  duration: string;
  address: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'pending';
  estimatedRevenue: number;
  notes?: string;
}

interface VehicleOnPremises {
  id: string;
  customer: string;
  vehicle: string;
  arrivalTime: Date;
  serviceStatus: 'waiting' | 'in-progress' | 'ready-for-pickup';
  expectedPickup: Date;
  technician?: string;
}

interface DashboardStats {
  todayAppointments: number;
  weeklyRevenue: number;
  carsOnPremises: number;
  completedToday: number;
  pendingJobs: number;
  nextAvailableSlot: string;
}

// Mock data - replace with real API calls
const mockAppointments: Appointment[] = [
  {
    id: '1',
    customer: 'John Smith',
    phone: '(555) 123-4567',
    vehicle: '2018 Toyota Camry',
    service: 'Oil Change',
    date: new Date(),
    time: '9:00 AM',
    duration: '30 min',
    address: '123 Main St',
    status: 'in-progress',
    estimatedRevenue: 45
  },
  {
    id: '2',
    customer: 'Sarah Johnson',
    phone: '(555) 234-5678',
    vehicle: '2020 Honda Accord',
    service: 'Brake Service',
    date: new Date(),
    time: '11:00 AM',
    duration: '2 hours',
    address: '456 Oak Ave',
    status: 'scheduled',
    estimatedRevenue: 280
  },
  {
    id: '3',
    customer: 'Mike Wilson',
    phone: '(555) 345-6789',
    vehicle: '2019 Ford F-150',
    service: 'Transmission Service',
    date: addDays(new Date(), 1),
    time: '2:00 PM',
    duration: '3 hours',
    address: '789 Pine St',
    status: 'scheduled',
    estimatedRevenue: 450
  }
];

const mockVehiclesOnPremises: VehicleOnPremises[] = [
  {
    id: '1',
    customer: 'John Smith',
    vehicle: '2018 Toyota Camry',
    arrivalTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    serviceStatus: 'in-progress',
    expectedPickup: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
    technician: 'Edgar'
  },
  {
    id: '2',
    customer: 'Lisa Davis',
    vehicle: '2017 Nissan Altima',
    arrivalTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    serviceStatus: 'ready-for-pickup',
    expectedPickup: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago (overdue)
  }
];

export function UnifiedDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [vehiclesOnPremises, setVehiclesOnPremises] = useState<VehicleOnPremises[]>(mockVehiclesOnPremises);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week'>('today');
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);

  // Calculate dashboard stats
  const stats: DashboardStats = {
    todayAppointments: appointments.filter(apt => isToday(apt.date)).length,
    weeklyRevenue: appointments
      .filter(apt => isThisWeek(apt.date))
      .reduce((sum, apt) => sum + apt.estimatedRevenue, 0),
    carsOnPremises: vehiclesOnPremises.length,
    completedToday: appointments.filter(apt => isToday(apt.date) && apt.status === 'completed').length,
    pendingJobs: appointments.filter(apt => apt.status === 'pending' || apt.status === 'scheduled').length,
    nextAvailableSlot: 'Tomorrow 10:00 AM'
  };

  // Get appointments for selected time range
  const getFilteredAppointments = () => {
    if (selectedTimeRange === 'today') {
      return appointments.filter(apt => isToday(apt.date));
    } else {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return appointments.filter(apt => apt.date >= weekStart && apt.date <= weekEnd);
    }
  };

  const filteredAppointments = getFilteredAppointments();

  // Generate week view data
  const getWeekDays = () => {
    const weekStart = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  };

  const weekDays = getWeekDays();

  const getStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getServiceStatusColor = (status: VehicleOnPremises['serviceStatus']) => {
    switch (status) {
      case 'ready-for-pickup': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAppointmentSubmit = async (data: any) => {
    setIsSubmittingAppointment(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newAppointment: Appointment = {
        id: Date.now().toString(),
        customer: data.customerName,
        phone: data.customerPhone,
        vehicle: `${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel}`,
        service: data.serviceType,
        date: new Date(data.appointmentDate),
        time: data.appointmentTime,
        duration: data.estimatedDuration,
        address: data.serviceAddress,
        status: 'scheduled',
        estimatedRevenue: 150, // Default estimate
        notes: data.notes
      };

      setAppointments(prev => [...prev, newAppointment]);
      setShowAppointmentForm(false);
    } catch (error) {
      console.error('Failed to create appointment:', error);
    } finally {
      setIsSubmittingAppointment(false);
    }
  };

  const handleStartJob = (appointmentId: string) => {
    setAppointments(prev => prev.map(apt => 
      apt.id === appointmentId ? { ...apt, status: 'in-progress' as const } : apt
    ));
  };

  const handleCompleteJob = (appointmentId: string) => {
    setAppointments(prev => prev.map(apt => 
      apt.id === appointmentId ? { ...apt, status: 'completed' as const } : apt
    ));
  };

  const isOverdue = (expectedTime: Date) => expectedTime < new Date();

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔧 Edgar's Auto Shop</h1>
          <p className="text-gray-600 mt-1">Your complete workshop management dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border rounded-lg">
            <Button
              variant={selectedTimeRange === 'today' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('today')}
              className="rounded-none rounded-l-lg"
            >
              Today
            </Button>
            <Button
              variant={selectedTimeRange === 'week' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('week')}
              className="rounded-none rounded-r-lg"
            >
              This Week
            </Button>
          </div>
          <Button
            onClick={() => setShowAppointmentForm(true)}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Schedule Service
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.todayAppointments}</p>
                <p className="text-sm text-gray-600">Today's Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Car className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.carsOnPremises}</p>
                <p className="text-sm text-gray-600">Cars Here</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.completedToday}</p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{stats.pendingJobs}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">${stats.weeklyRevenue}</p>
                <p className="text-sm text-gray-600">Week Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Timer className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm font-bold">{stats.nextAvailableSlot}</p>
                <p className="text-sm text-gray-600">Next Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar/Schedule - Takes up 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {selectedTimeRange === 'today' ? "Today's Schedule" : "Week Schedule"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{filteredAppointments.length} appointments</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedTimeRange === 'today' ? (
                /* Today's Schedule */
                <div className="space-y-4">
                  {filteredAppointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No appointments today</p>
                      <p className="text-sm">Perfect time to catch up on other tasks!</p>
                    </div>
                  ) : (
                    filteredAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-xl font-bold text-blue-600">{appointment.time}</div>
                            <div className="text-sm text-gray-500">{appointment.duration}</div>
                          </div>
                          <div className={`w-1 h-16 rounded-full ${
                            appointment.status === 'completed' ? 'bg-green-500' :
                            appointment.status === 'in-progress' ? 'bg-yellow-500' :
                            appointment.status === 'pending' ? 'bg-orange-500' :
                            'bg-blue-500'
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-gray-900">{appointment.customer}</h3>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(appointment.status)}`}>
                                {appointment.status.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-gray-600 font-medium">🚗 {appointment.vehicle}</p>
                            <p className="text-gray-600">🔧 {appointment.service}</p>
                            <p className="text-gray-500 text-sm">📍 {appointment.address}</p>
                            <p className="text-gray-500 text-sm">📞 {appointment.phone}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">${appointment.estimatedRevenue}</div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {appointment.status === 'scheduled' && (
                            <Button
                              size="sm"
                              onClick={() => handleStartJob(appointment.id)}
                              className="bg-orange-500 hover:bg-orange-600"
                            >
                              🔧 Start
                            </Button>
                          )}
                          {appointment.status === 'in-progress' && (
                            <Button
                              size="sm"
                              onClick={() => handleCompleteJob(appointment.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              ✅ Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`tel:${appointment.phone}`)}
                          >
                            📞 Call
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Week View */
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-7 gap-2 min-w-[800px]">
                    {weekDays.map((day) => {
                      const dayAppointments = appointments.filter(apt => isSameDay(apt.date, day));
                      return (
                        <div key={day.toString()} className="border rounded-lg overflow-hidden">
                          <div className={`py-3 font-bold text-center text-sm ${
                            isToday(day) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {format(day, 'EEE')}
                            <br />
                            <span className="text-lg">{format(day, 'd')}</span>
                          </div>
                          <div className="h-[200px] p-2 overflow-y-auto space-y-1">
                            {dayAppointments.map(apt => (
                              <div
                                key={apt.id}
                                className={`p-2 text-xs rounded cursor-pointer hover:shadow-sm transition-shadow ${
                                  apt.status === 'completed' ? 'bg-green-100 border-l-4 border-green-500' :
                                  apt.status === 'in-progress' ? 'bg-yellow-100 border-l-4 border-yellow-500' :
                                  apt.status === 'pending' ? 'bg-orange-100 border-l-4 border-orange-500' :
                                  'bg-blue-100 border-l-4 border-blue-500'
                                }`}
                              >
                                <div className="font-bold text-sm">{apt.time}</div>
                                <div className="font-medium truncate">{apt.customer}</div>
                                <div className="text-gray-600 truncate">{apt.vehicle}</div>
                                <div className="text-gray-600 truncate">{apt.service}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Cars on Premises & Quick Actions */}
        <div className="space-y-6">
          {/* Cars on Premises */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5 text-green-600" />
                Cars on Premises
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vehiclesOnPremises.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <Car className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No vehicles currently on premises</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vehiclesOnPremises.map((vehicle) => (
                    <div key={vehicle.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-sm">{vehicle.customer}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getServiceStatusColor(vehicle.serviceStatus)}`}>
                          {vehicle.serviceStatus.replace('-', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-1">🚗 {vehicle.vehicle}</p>
                      <p className="text-gray-500 text-xs">
                        📅 Arrived: {format(vehicle.arrivalTime, 'h:mm a')}
                      </p>
                      <p className={`text-xs ${isOverdue(vehicle.expectedPickup) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        🕐 Pickup: {format(vehicle.expectedPickup, 'h:mm a')}
                        {isOverdue(vehicle.expectedPickup) && ' (OVERDUE)'}
                      </p>
                      {vehicle.technician && (
                        <p className="text-gray-500 text-xs">👨‍🔧 {vehicle.technician}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button
                  onClick={() => setShowAppointmentForm(true)}
                  className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule New Service
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => alert('Emergency protocol activated!')}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Emergency Service
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => alert('Parts lookup coming soon!')}
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Parts Lookup
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => alert('Customer records coming soon!')}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Customer Records
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Appointment Form Modal */}
      <AppointmentFormModal
        isOpen={showAppointmentForm}
        onClose={() => setShowAppointmentForm(false)}
        onSubmit={handleAppointmentSubmit}
        isSubmitting={isSubmittingAppointment}
      />
    </div>
  );
}

export default UnifiedDashboard;
