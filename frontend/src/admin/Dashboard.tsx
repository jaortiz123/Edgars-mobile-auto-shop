import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { AppointmentCalendar } from '../components/admin/AppointmentCalendar';
import { AppointmentDetailModal } from '../components/admin/AppointmentDetailModal';
import { 
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Phone,
  Wrench,
  Car
} from 'lucide-react';
import { 
  useApi, 
  handleApiError, 
  isOnline, 
  MOCK_APPOINTMENTS, 
  MOCK_STATS,
  type Appointment,
  type DashboardStats 
} from '../lib/api';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>(MOCK_STATS);
  const [loading, setLoading] = useState(true);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const api = useApi();

  useEffect(() => {
    // Check online status
    const handleOnlineStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        if (isOnline()) {
          // Try to fetch from API
          const [appointmentsResponse, statsResponse] = await Promise.all([
            api.getAppointments(new Date().toISOString().split('T')[0]),
            api.getDashboardStats()
          ]);

          if (appointmentsResponse.success && appointmentsResponse.data) {
            // Convert date strings back to Date objects
            const appointmentsWithDates = appointmentsResponse.data.map((apt: Appointment) => ({
              ...apt,
              dateTime: new Date(apt.dateTime)
            }));
            setAppointments(appointmentsWithDates);
          }

          if (statsResponse.success && statsResponse.data) {
            setStats(statsResponse.data);
          }
        }
      } catch (error) {
        console.warn('Using offline data:', error);
      }

      // Calculate next appointment and update stats based on current data
      const today = new Date();
      const todayAppointments = appointments.filter((apt: Appointment) => 
        apt.dateTime.toDateString() === today.toDateString()
      );
      
      const nextAppt = todayAppointments
        .filter((apt: Appointment) => apt.status === 'scheduled' || apt.status === 'in-progress')
        .sort((a: Appointment, b: Appointment) => a.dateTime.getTime() - b.dateTime.getTime())[0];

      setNextAppointment(nextAppt || null);
      
      // Update stats if using offline data
      if (isOffline || !isOnline()) {
        setStats(prev => ({
          ...prev,
          todayAppointments: todayAppointments.length,
          pendingAppointments: todayAppointments.filter((apt: Appointment) => apt.status === 'scheduled').length,
          completedToday: todayAppointments.filter((apt: Appointment) => apt.status === 'completed').length,
          todayRevenue: todayAppointments.filter((apt: Appointment) => apt.status === 'completed').length * 150
        }));
      }
      
      setLoading(false);
    };

    loadDashboardData();
  }, [api, isOffline, appointments]);

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleAddAppointment = () => {
    // Navigate to appointments page to add new appointment
    window.location.href = '/admin/appointments';
  };

  const handleWorkOrders = () => {
    // Open work orders functionality
    alert('📋 Work Orders feature coming soon! This will show all active work orders and their status.');
  };

  const handlePartsLookup = () => {
    // Open parts lookup functionality
    alert('🔧 Parts Lookup feature coming soon! This will help you find and order parts for repairs.');
  };

  const handleCreateQuote = () => {
    // Open quote creation functionality
    alert('💰 Create Quote feature coming soon! This will help you generate quotes for potential customers.');
  };

  const handleVehicleLookup = () => {
    // Open vehicle lookup functionality
    alert('🚗 Vehicle Lookup feature coming soon! This will help you look up vehicle specifications and history.');
  };

  const handleEmergency = () => {
    // Handle emergency situations
    if (window.confirm('🚨 Emergency Protocol\n\nAre you dealing with an emergency situation that requires immediate attention?')) {
      alert('Emergency protocol activated!\n\n1. Prioritize safety first\n2. Contact emergency services if needed: 911\n3. Notify dispatch: (555) 123-4567\n4. Document the situation');
    }
  };

  const handleStartJob = async (appointmentId: string) => {
    try {
      // Optimistically update UI
      setAppointments(prev => prev.map((apt: Appointment) => 
        apt.id === appointmentId 
          ? { ...apt, status: 'in-progress' as const }
          : apt
      ));
      
      if (nextAppointment?.id === appointmentId) {
        setNextAppointment(prev => prev ? { ...prev, status: 'in-progress' as const } : null);
      }
      
      setSelectedAppointment(null);
      
      // Try to update backend if online
      if (isOnline()) {
        const response = await api.updateAppointmentStatus(appointmentId, 'in-progress');
        if (!handleApiError(response, 'Failed to start job')) {
          // Revert on failure
          setAppointments(prev => prev.map((apt: Appointment) => 
            apt.id === appointmentId 
              ? { ...apt, status: 'scheduled' as const }
              : apt
          ));
        }
      }
      
      console.log(`Starting job for appointment ${appointmentId}`);
    } catch (error) {
      console.error('Error starting job:', error);
    }
  };

  const handleCompleteJob = async (appointmentId: string) => {
    try {
      // Optimistically update UI
      setAppointments(prev => prev.map((apt: Appointment) => 
        apt.id === appointmentId 
          ? { ...apt, status: 'completed' as const }
          : apt
      ));
      
      if (nextAppointment?.id === appointmentId) {
        setNextAppointment(null);
      }
      
      setStats(prev => ({
        ...prev,
        completedToday: prev.completedToday + 1,
        pendingAppointments: Math.max(0, prev.pendingAppointments - 1),
        todayRevenue: prev.todayRevenue + 150
      }));
      
      setSelectedAppointment(null);
      
      // Try to update backend if online
      if (isOnline()) {
        const response = await api.updateAppointmentStatus(appointmentId, 'completed');
        if (!handleApiError(response, 'Failed to complete job')) {
          // Revert on failure
          setAppointments(prev => prev.map((apt: Appointment) => 
            apt.id === appointmentId 
              ? { ...apt, status: 'in-progress' as const }
              : apt
          ));
          setStats(prev => ({
            ...prev,
            completedToday: prev.completedToday - 1,
            pendingAppointments: prev.pendingAppointments + 1,
            todayRevenue: prev.todayRevenue - 150
          }));
        }
      }
      
      console.log(`Completing job for appointment ${appointmentId}`);
    } catch (error) {
      console.error('Error completing job:', error);
    }
  };

  const handleCallCustomer = (phone: string) => {
    if (window.confirm(`Call ${phone}?`)) {
      window.open(`tel:${phone}`);
    }
  };

  const handleQuickAction = (action: 'start' | 'complete' | 'call') => {
    if (!nextAppointment) return;
    
    switch (action) {
      case 'start':
        handleStartJob(nextAppointment.id);
        break;
      case 'complete':
        handleCompleteJob(nextAppointment.id);
        break;
      case 'call':
        if (nextAppointment.phone) {
          handleCallCustomer(nextAppointment.phone);
        }
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🔧 Edgar's Shop Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isOffline ? "secondary" : "success"}>
            {isOffline ? "Offline Mode" : "Shop Open"}
          </Badge>
          <span className="text-sm text-gray-500">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Offline notification */}
      {isOffline && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
            <span className="text-yellow-800 font-medium">
              Working in offline mode. Changes will sync when connection is restored.
            </span>
          </div>
        </div>
      )}

      {/* Next Appointment & Big Action Buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Appointment Card */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-lg font-bold text-gray-600 mb-4">🕐 Next Appointment</h3>
            {nextAppointment ? (
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-orange-600 mb-2">
                  {nextAppointment.timeSlot}
                </div>
                <div className="font-bold text-lg text-gray-900">
                  {nextAppointment.customer}
                </div>
                <div className="text-gray-600 mt-1 text-sm sm:text-base">
                  🚗 {nextAppointment.vehicle}
                </div>
                <div className="text-gray-600 text-sm sm:text-base">
                  🔧 {nextAppointment.service}
                </div>
                <div className="text-gray-500 text-sm mt-2">
                  📞 {nextAppointment.phone}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-3xl sm:text-4xl mb-2">✅</div>
                <div className="font-medium text-gray-600">All caught up!</div>
                <div className="text-sm text-gray-500">No more appointments today</div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Big Action Buttons */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-lg font-bold text-gray-600 mb-4">⚡ Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {nextAppointment && nextAppointment.status === 'scheduled' && (
                <button 
                  onClick={() => handleQuickAction('start')}
                  className="w-full py-4 bg-orange-500 text-white text-lg font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg flex items-center justify-center space-x-2 touch-manipulation"
                >
                  <Wrench className="h-6 w-6" />
                  <span>🔧 Start Next Job</span>
                </button>
              )}
              
              {nextAppointment && nextAppointment.status === 'in-progress' && (
                <button 
                  onClick={() => handleQuickAction('complete')}
                  className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-xl hover:bg-green-700 transition-colors shadow-lg flex items-center justify-center space-x-2 touch-manipulation"
                >
                  <CheckCircle className="h-6 w-6" />
                  <span>✅ Complete Current Job</span>
                </button>
              )}
              
              <button 
                onClick={handleAddAppointment}
                className="w-full py-4 bg-blue-500 text-white text-lg font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-lg flex items-center justify-center space-x-2 touch-manipulation"
              >
                <Calendar className="h-6 w-6" />
                <span>📅 Add Emergency Job</span>
              </button>
              
              {nextAppointment && (
                <button 
                  onClick={() => handleQuickAction('call')}
                  className="w-full py-4 bg-purple-500 text-white text-lg font-bold rounded-xl hover:bg-purple-600 transition-colors shadow-lg flex items-center justify-center space-x-2 touch-manipulation"
                >
                  <Phone className="h-6 w-6" />
                  <span>📞 Call Customer</span>
                </button>
              )}
              
              <button 
                onClick={handleVehicleLookup}
                className="w-full py-4 bg-yellow-500 text-white text-lg font-bold rounded-xl hover:bg-yellow-600 transition-colors shadow-lg flex items-center justify-center space-x-2 touch-manipulation"
              >
                <Car className="h-6 w-6" />
                <span>🚗 Vehicle Lookup</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Section */}
      <AppointmentCalendar 
        appointments={appointments}
        onAppointmentClick={handleAppointmentClick}
        onAddAppointment={handleAddAppointment}
        onStartJob={handleStartJob}
        onCompleteJob={handleCompleteJob}
        onCallCustomer={handleCallCustomer}
      />

      {/* Appointment Detail Modal */}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          isOpen={!!selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStartJob={handleStartJob}
          onCompleteJob={handleCompleteJob}
          onCallCustomer={handleCallCustomer}
        />
      )}

      {/* Stats and Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              📊 Today's Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.completedToday}</div>
                <div className="text-gray-600 font-medium">✅ Jobs Completed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{stats.pendingAppointments}</div>
                <div className="text-gray-600 font-medium">⏳ Jobs Pending</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">${stats.todayRevenue}</div>
                <div className="text-gray-600 font-medium">💰 Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.partsOrdered}</div>
                <div className="text-gray-600 font-medium">🔧 Parts Ordered</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Quick Tools */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-600" />
              🛠️ Shop Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleWorkOrders}
                className="p-4 bg-blue-50 text-blue-800 rounded-xl hover:bg-blue-100 transition-colors flex flex-col items-center space-y-2 touch-manipulation"
              >
                <span className="text-3xl">📋</span>
                <span className="font-medium text-sm">Work Orders</span>
              </button>
              <button 
                onClick={handlePartsLookup}
                className="p-4 bg-green-50 text-green-800 rounded-xl hover:bg-green-100 transition-colors flex flex-col items-center space-y-2 touch-manipulation"
              >
                <span className="text-3xl">🔧</span>
                <span className="font-medium text-sm">Parts Lookup</span>
              </button>
              <button 
                onClick={handleCreateQuote}
                className="p-4 bg-yellow-50 text-yellow-800 rounded-xl hover:bg-yellow-100 transition-colors flex flex-col items-center space-y-2 touch-manipulation"
              >
                <span className="text-3xl">💰</span>
                <span className="font-medium text-sm">Create Quote</span>
              </button>
              <button 
                onClick={handleEmergency}
                className="p-4 bg-red-50 text-red-800 rounded-xl hover:bg-red-100 transition-colors flex flex-col items-center space-y-2 touch-manipulation"
              >
                <span className="text-3xl">🚨</span>
                <span className="font-medium text-sm">Emergency</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
