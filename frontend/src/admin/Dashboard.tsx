import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { AppointmentCalendar } from '../components/admin/AppointmentCalendar';
// import { AppointmentDetailModal } from '../components/admin/AppointmentDetailModal';
import { AppointmentFormModal } from '../components/admin/AppointmentFormModal';
import { CarsOnPremisesWidget } from '../components/admin/CarsOnPremisesWidget';
import { DashboardSidebar } from '../components/admin/DashboardSidebar';
import type { AppointmentFormData } from '../components/admin/AppointmentFormModal';
import { useAppointmentContext } from '../contexts/AppointmentContext';
import { 
  Calendar,
  CheckCircle,
  AlertTriangle,
  Phone,
  Wrench,
  Car,
  RefreshCw,
  PlusCircle
} from 'lucide-react';
import { 
  useApi, 
  handleApiError, 
  isOnline, 
  type Appointment,
  type DashboardStats 
} from '../lib/api';
import { parseDurationToMinutes } from '../lib/utils';
import { format } from 'date-fns';

// Utility function to convert 12-hour format to 24-hour format
const convertTo24Hour = (time12h: string): string => {
  try {
    if (!time12h || typeof time12h !== 'string') {
      console.warn('Invalid time input:', time12h);
      return '12:00'; // Default fallback
    }

    // Handle various formats and clean the input
    const cleanTime = time12h.trim().toUpperCase();
    
    // Check if already in 24-hour format
    if (!cleanTime.includes('AM') && !cleanTime.includes('PM')) {
      return cleanTime;
    }

    const [time, modifier] = cleanTime.split(/\s+(AM|PM)/);
    let [hours, minutes] = time.split(':').map(str => str.trim());
    
    if (!hours || !minutes) {
      console.warn('Invalid time format:', time12h);
      return '12:00';
    }

    hours = hours.padStart(2, '0');
    minutes = minutes.padStart(2, '0');
    
    let hour24 = parseInt(hours);
    
    if (modifier === 'AM') {
      if (hour24 === 12) {
        hour24 = 0; // 12:xx AM becomes 00:xx
      }
    } else if (modifier === 'PM') {
      if (hour24 !== 12) {
        hour24 += 12; // Add 12 for PM times (except 12 PM)
      }
    }
    
    const result = `${hour24.toString().padStart(2, '0')}:${minutes}`;
    console.log(`Converted ${time12h} to ${result}`);
    return result;
  } catch (error) {
    console.error('Error converting time:', time12h, error);
    return '12:00'; // Safe fallback
  }
};

// 1. Define types for API responses
interface AppointmentApi {
  id: string|number;
  customer_name?: string;
  vehicle_id?: string|number;
  service_id?: string|number;
  scheduled_time?: string;
  scheduled_at?: string;
  scheduled_date?: string;
  status?: string;
  customer_phone?: string;
  location_address?: string;
  estimatedDuration?: string;
  reminderStatus?: string;
}
interface StatsApi {
  todayAppointments: number;
  pendingAppointments: number;
  completedToday: number;
  totalCustomers: number;
  partsOrdered: number;
  todayRevenue: number;
}

// 2. Type guard for responseData
function isAppointmentsResponse(obj: unknown): obj is { appointments: AppointmentApi[] } {
  return typeof obj === 'object' && obj !== null && 'appointments' in obj;
}
function isStatsResponse(obj: unknown): obj is StatsApi {
  return typeof obj === 'object' && obj !== null && 'todayAppointments' in obj;
}

export function Dashboard() {
  const { refreshTrigger, triggerRefresh, isRefreshing, setRefreshing } = useAppointmentContext();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>();
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [nextAvailableSlot, setNextAvailableSlot] = useState<Date | null>(null);
  // const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const api = useApi();
  const loadingRef = useRef(false);

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

  const loadDashboardData = useCallback(async () => {
    // Prevent rapid successive calls
    if (loadingRef.current) {
      console.log("🚫 Already loading, skipping duplicate call");
      return;
    }
    
    console.log("🚀 Starting loadDashboardData");
    
    // Safety timer to prevent infinite loading
    const safetyTimer = setTimeout(() => {
      console.log("⚠️ Safety timeout triggered after 10s - forcing loading to false");
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }, 10000);
    
     loadingRef.current = true;
     setLoading(true);
     setRefreshing(true);
     let fetchedApts: Appointment[] = [];
     let fetchedStats: StatsApi | undefined;
     try {
      console.log("📡 Making API calls to backend...");
       const [aptRes, statsRes] = await Promise.all([api.getTodaysAppointments(), api.getDashboardStats()]);
      console.log("✅ API calls completed", { aptRes: aptRes.success, statsRes: statsRes.success });
      
       if (aptRes.success && aptRes.data && isAppointmentsResponse(aptRes.data)) {
        console.log("📋 Processing appointments data", aptRes.data);
         fetchedApts = aptRes.data.appointments.map(apt => {
           // Safe date parsing with fallbacks
           let dateTime;
           try {
             if (apt.scheduled_at) {
               dateTime = new Date(apt.scheduled_at);
             } else if (apt.scheduled_date && apt.scheduled_time) {
               dateTime = new Date(`${apt.scheduled_date}T${apt.scheduled_time}`);
             } else if (apt.scheduled_date) {
               dateTime = new Date(`${apt.scheduled_date}T12:00:00`);
             } else {
               dateTime = new Date(); // fallback to current date
             }
             
             // Validate the date
             if (isNaN(dateTime.getTime())) {
               console.warn('Invalid date for appointment:', apt.id, apt);
               dateTime = new Date(); // fallback to current date
             }
           } catch (error) {
             console.error('Date parsing error for appointment:', apt.id, error);
             dateTime = new Date(); // fallback to current date
           }

           return {
             id: apt.id.toString(),
             customer: apt.customer_name || 'Unknown Customer',
             vehicle: `Vehicle ${apt.vehicle_id || 'N/A'}`,
             service: `Service ${apt.service_id || 'N/A'}`,
             timeSlot: apt.scheduled_time || '12:00 PM',
             dateTime,
             status: (apt.status === 'completed' || apt.status === 'in-progress' || apt.status === 'canceled') ? apt.status as 'completed' | 'in-progress' | 'canceled' : 'scheduled',
             phone: apt.customer_phone || '(555) 000-0000',
             address: apt.location_address || 'Address not provided',
             estimatedDuration: '1 hour', // Default value since backend doesn't provide this
             reminderStatus: 'pending' as const, // Default value since backend doesn't provide this
           };
         });
       }
       if (statsRes.success && statsRes.data && isStatsResponse(statsRes.data)) {
        console.log("📊 Processing stats data", statsRes.data);
         fetchedStats = statsRes.data;
       }
     } catch (err) {
      console.error('❌ Dashboard API error', err);
      // Still proceed to show empty dashboard instead of hanging
     } finally {
      clearTimeout(safetyTimer);
      console.log("🔄 Setting appointments and stats");
       setAppointments(fetchedApts);
       if (fetchedStats) setStats(fetchedStats);
       try {
        // Compute next appointment and derived stats
        const todayStr = new Date().toDateString();
        const todayList = fetchedApts.filter(a => a.dateTime.toDateString() === todayStr);
        const next = todayList.filter(a => a.status === 'scheduled' || a.status === 'in-progress')
          .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())[0];
        setNextAppointment(next || null);
        // Compute next available slot
        let slot = new Date();
        if (slot.getMinutes() > 30) slot.setHours(slot.getHours()+1,0,0,0);
        else if (slot.getMinutes() > 0) slot.setMinutes(30,0,0);
        for (const a of fetchedApts) {
          const start = a.dateTime.getTime();
          const end = start + parseDurationToMinutes(a.estimatedDuration || '1 hour') * 60000;
          if (slot.getTime() < end && slot.getTime() >= start) {
            slot = new Date(end);
            if (slot.getMinutes() > 30) slot.setHours(slot.getHours()+1,0,0,0);
            else if (slot.getMinutes() > 0) slot.setMinutes(30,0,0);
          }
        }
        setNextAvailableSlot(slot);
        // Offline fallback
        if (isOffline || !isOnline()) {
          setStats(prev => ({
            ...prev,
            todayAppointments: todayList.length,
            pendingAppointments: todayList.filter(a=>a.status==='scheduled').length,
            completedToday: todayList.filter(a=>a.status==='completed').length,
            todayRevenue: todayList.filter(a=>a.status==='completed').length * 150
          }));
        }
      } catch (procErr) {
        console.error('🛠️ Dashboard post-processing error', procErr);
      } finally {
        console.log("✅ Setting loading and refreshing to false");
         loadingRef.current = false;
         setLoading(false);
         setRefreshing(false);
       }
     }
  }, [api, isOffline, setRefreshing]); // Added setRefreshing to dependencies

  useEffect(() => {
    // Only load once on mount, then rely on refresh triggers
    console.log("🎯 Initial dashboard load triggered");
    loadDashboardData();
  }, [loadDashboardData]);  // Include loadDashboardData in dependencies

  // Handle refresh triggers separately
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log("🔄 Refresh trigger activated:", refreshTrigger);
      loadDashboardData();
    }
  }, [refreshTrigger, loadDashboardData]);

  // Auto-refresh appointments every 2 minutes (reduced from 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline() && !loadingRef.current && !isRefreshing) {
        console.log("⏰ Auto-refresh triggered");
        loadDashboardData();
      }
    }, 120000); // 2 minutes instead of 30 seconds
    return () => clearInterval(interval);
  }, [isRefreshing, loadDashboardData]);

  const handleAppointmentClick = (appointment: Appointment) => {
    // setSelectedAppointment(appointment);
    console.log('Appointment clicked:', appointment);
  };

  const handleAddAppointment = () => {
    setShowAppointmentForm(true);
  };

  const handleAppointmentFormSubmit = async (formData: AppointmentFormData) => {
    console.log('🔄 Submitting appointment form:', formData);
    setIsSubmittingAppointment(true);
    
    // Validate required fields
    if (!formData.customerName || !formData.serviceType || (!formData.appointmentDate && formData.appointmentType !== 'emergency') || (!formData.appointmentTime && formData.appointmentType !== 'emergency')) {
      alert('❌ Please fill in all required fields');
      setIsSubmittingAppointment(false);
      return;
    }

    try {
      const appointmentData = {
        customer_id: formData.customerName,
        service: formData.serviceType,
        requested_time: formData.appointmentDate && formData.appointmentTime ? 
          new Date(`${formData.appointmentDate}T${convertTo24Hour(formData.appointmentTime)}:00`).toISOString() : 
          undefined,
        customer_phone: formData.customerPhone || '',
        customer_email: formData.customerEmail || '',
        location_address: formData.serviceAddress || '',
        notes: `Vehicle: ${formData.vehicleYear} ${formData.vehicleMake} ${formData.vehicleModel}. ${formData.notes || ''}`.trim(),
        estimated_duration: formData.estimatedDuration || '1 hour',
        appointmentType: formData.appointmentType,
      };

      console.log('📤 Sending appointment data:', appointmentData);

      if (isOnline()) {
        const response = await api.createAppointment(appointmentData);
        console.log('📥 API response:', response);
        
        if (response.success) {
          // Add to local state for immediate UI update
          const newApt: Appointment = {
            id: Date.now().toString(),
            customer: formData.customerName,
            vehicle: `${formData.vehicleYear} ${formData.vehicleMake} ${formData.vehicleModel}`,
            service: formData.serviceType,
            timeSlot: formData.appointmentTime || '12:00 PM',
            dateTime: formData.appointmentDate && formData.appointmentTime ? new Date(`${formData.appointmentDate}T${formData.appointmentTime}`) : new Date(),
            status: formData.appointmentType === 'emergency' ? 'in-progress' : 'scheduled',
            phone: formData.customerPhone || '(555) 000-0000',
            address: formData.serviceAddress || 'Address not provided',
            estimatedDuration: formData.estimatedDuration || '1 hour',
            reminderStatus: 'pending' as const,
          };
          
          setAppointments(prev => [...prev, newApt]);
          setStats(prev => ({
            todayAppointments: (prev?.todayAppointments ?? 0) + 1,
            pendingAppointments: (prev?.pendingAppointments ?? 0) + 1,
            completedToday: prev?.completedToday ?? 0,
            totalCustomers: prev?.totalCustomers ?? 0,
            partsOrdered: prev?.partsOrdered ?? 0,
            todayRevenue: prev?.todayRevenue ?? 0
          }));
          
          alert('✅ Appointment scheduled successfully!');
          setShowAppointmentForm(false);
          setIsSubmittingAppointment(false);
          
          // Refresh data to sync with backend
          setTimeout(() => {
            console.log('🔄 Refreshing dashboard after appointment creation...');
            triggerRefresh();
          }, 1000);
        } else {
          throw new Error(response.error || 'API request failed');
        }
      } else {
        alert('⚠️ You are offline. Appointment will be scheduled when connection is restored.');
        setShowAppointmentForm(false);
        setIsSubmittingAppointment(false);
      }
    } catch (err) {
      console.error('❌ Error creating appointment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`❌ Failed to schedule appointment: ${errorMessage}`);
      setIsSubmittingAppointment(false);
    }
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
      
      // setSelectedAppointment(null);
      
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
        completedToday: (prev?.completedToday ?? 0) + 1,
        pendingAppointments: Math.max(0, (prev?.pendingAppointments ?? 0) - 1),
        todayRevenue: (prev?.todayRevenue ?? 0) + 150
      }));
      
      // setSelectedAppointment(null);
      
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
            completedToday: (prev?.completedToday ?? 0) - 1,
            pendingAppointments: (prev?.pendingAppointments ?? 0) + 1,
            todayRevenue: (prev?.todayRevenue ?? 0) - 150
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
    <>
      <div className="space-y-4 p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">🔧 Edgar's Shop Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                console.log('🔄 Manual refresh triggered');
                triggerRefresh();
              }}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-900 rounded-lg border border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${(isRefreshing) ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Badge variant={isOffline ? "destructive" : "success"}>
              {isOffline ? "Offline Mode" : "Shop Open"}
            </Badge>
            <span className="text-xs text-gray-500">
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Offline notification */}
        {isOffline && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-yellow-600 mr-2" />
              <span className="text-sm text-yellow-800 font-medium">
                Working in offline mode. Changes will sync when connection is restored.
              </span>
            </div>
          </div>
        )}

        {/* Calendar Section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <AppointmentCalendar 
              appointments={appointments}
              onAppointmentClick={handleAppointmentClick}
              onAddAppointment={handleAddAppointment}
              onStartJob={handleStartJob}
              onCompleteJob={handleCompleteJob}
              onCallCustomer={handleCallCustomer}
            />
          </div>

          {/* Next Appointment & Big Action Buttons */}
          <div className="lg:col-span-2 space-y-4">
            {/* Next Appointment Card */}
            <Card>
              <CardContent className="p-5 sm:p-5">
                <h2 className="text-lg font-bold text-gray-700 mb-4">🕐 Next Appointment</h2>
              {nextAppointment ? (
                 <div className="text-center py-2">
                   <div className="text-xl sm:text-2xl font-bold text-orange-600 mb-2">
                     {nextAppointment.timeSlot}
                   </div>
                   <div className="font-bold text-base text-gray-900">
                     {nextAppointment.customer}
                   </div>
                   <div className="text-gray-600 mt-1 text-xs sm:text-sm">
                     🚗 {nextAppointment.vehicle}
                   </div>
                   <div className="text-gray-600 text-xs sm:text-sm">
                     🔧 {nextAppointment.service}
                   </div>
                   <div className="text-gray-500 text-xs mt-2">
                     📞 {nextAppointment.phone}
                   </div>
                 </div>
               ) : (
                 <div className="text-center py-4">
                   <div className="text-2xl sm:text-3xl mb-2">✅</div>
                   <div className="font-medium text-base text-gray-600">All caught up!</div>
                   <div className="text-xs text-gray-500">No more appointments today</div>
                 </div>
               )}
               </CardContent>
             </Card>
             
             {/* Big Action Buttons */}
             <Card>
               <CardContent className="p-5 sm:p-5">
                 <h3 className="text-lg font-bold text-gray-600 mb-4">⚡ Schedule New Service</h3>
                 {nextAvailableSlot && (
                   <div className="mb-4 text-center text-gray-700">
                     Next available slot: <span className="font-bold text-blue-600">{format(nextAvailableSlot, 'h:mm a')}</span>
                   </div>
                 )}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {nextAppointment && nextAppointment.status === 'scheduled' && (
                     <button 
                     onClick={() => handleQuickAction('start')}
                     className="w-full py-5 text-lg font-bold rounded-xl shadow-lg flex items-center justify-center space-x-2 touch-manipulation bg-orange-500 text-white hover:bg-orange-600"
                   >
                     <Wrench className="h-7 w-7" />
                     <span>🔧 Start Next Job</span>
                   </button>
                   )}
                   
                   {nextAppointment && nextAppointment.status === 'in-progress' && (
                     <button 
                     onClick={() => handleQuickAction('complete')}
                     className="w-full py-5 text-lg font-bold rounded-xl shadow-lg flex items-center justify-center space-x-2 touch-manipulation bg-green-600 text-white hover:bg-green-700"
                   >
                     <CheckCircle className="h-7 w-7" />
                     <span>✅ Complete Current Job</span>
                   </button>
                   )}
                   
                   <div className="relative">
                     <button 
                     onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                     className="w-full py-5 text-lg font-bold rounded-xl shadow-lg flex items-center justify-center space-x-2 touch-manipulation bg-blue-600 text-white hover:bg-blue-700"
                   >
                       <Calendar className="h-7 w-7" />
                       <span>📅 Schedule Service</span>
                       <PlusCircle className="h-6 w-6 ml-2" />
                     </button>
                     {showScheduleDropdown && (
                       <div className="absolute z-10 mt-2 w-full bg-white rounded-md shadow-lg">
                         <button
                           onClick={() => { handleAddAppointment(); setShowScheduleDropdown(false); }}
                           className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                         >
                           Regular Appointment
                         </button>
                         <button
                           onClick={() => { handleAddAppointment(); setShowScheduleDropdown(false); }}
                           className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                         >
                           Walk-in Service
                         </button>
                       </div>
                     )}
                   </div>
                   
                   {nextAppointment && (
                     <button 
                     onClick={() => handleQuickAction('call')}
                     className="w-full py-5 text-lg font-bold rounded-xl shadow-lg flex items-center justify-center space-x-2 touch-manipulation bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                   >
                       <Phone className="h-7 w-7" />
                       <span>📞 Call Customer</span>
                     </button>
                   )}
                   
                   <button 
                     onClick={handleVehicleLookup}
                     className="w-full py-5 text-lg font-bold rounded-xl shadow-lg flex items-center justify-center space-x-2 touch-manipulation bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                   >
                     <Car className="h-7 w-7" />
                     <span>👥 Customer History</span>
                   </button>
                 </div>
               </CardContent>
             </Card>
           </div>
         </div>

         {/* Stats and Quick Info */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <DashboardSidebar 
             stats={stats ?? { todayAppointments: 0, pendingAppointments: 0, completedToday: 0, totalCustomers: 0, partsOrdered: 0, todayRevenue: 0 }}
             handleWorkOrders={handleWorkOrders}
             handlePartsLookup={handlePartsLookup}
             handleCreateQuote={handleCreateQuote}
             handleEmergency={handleEmergency}
           />
           <CarsOnPremisesWidget />
         </div>
       </div>

       {/* Detail Modal */}
       {/* {selectedAppointment && (
         <AppointmentDetailModal
           appointment={selectedAppointment}
           isOpen={!!selectedAppointment}
           onClose={() => setSelectedAppointment(null)}
           onStartJob={handleStartJob}
           onCompleteJob={handleCompleteJob}
           onCallCustomer={handleCallCustomer}
         />
       )} */}

       {/* Appointment Form Modal */}
       <AppointmentFormModal
         isOpen={showAppointmentForm}
         onClose={() => setShowAppointmentForm(false)}
         onSubmit={handleAppointmentFormSubmit}
         isSubmitting={isSubmittingAppointment}
       />
     </>
   );
 }

 export default Dashboard;
