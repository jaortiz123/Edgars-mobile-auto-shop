import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AppointmentCalendar } from '@/components/admin/AppointmentCalendar';
import AppointmentDrawer from '@/components/admin/AppointmentDrawer';
import { AppointmentFormModal } from '@/components/admin/AppointmentFormModal';
import QuickAddModal from '@/components/QuickAddModal/QuickAddModal';
import DailyFocusHero from '@/components/admin/DailyFocusHero';
import ScheduleFilterToggle from '@/components/admin/ScheduleFilterToggle';
import NotificationCenter from '@/components/admin/NotificationCenter';
import type { AppointmentFormData } from '@/components/admin/AppointmentFormModal';
import { useAppointments } from '@/contexts/AppointmentContext';
import { getViewMode, setViewMode, ViewMode } from '@lib/prefs';
import StatusBoard from '@/components/admin/StatusBoard';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import { scheduleReminder } from '@/services/notificationService';
import '@/styles/appointment-reminders.css';
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
  handleApiError, 
  isOnline, 
  updateAppointmentStatus
} from '@lib/api';
import { createAppointment, getAdminAppointments } from '@/services/apiService';
import { parseDurationToMinutes } from '@lib/utils';
import { format } from 'date-fns';
import { saveLastQuickAdd } from '@lib/quickAddUtils';
import IntelligentWorkflowPanel from '@/components/admin/IntelligentWorkflowPanel';

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

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}


// Local UI appointment type used by the dashboard
interface UIAppointment {
  id: string;
  customer: string;
  vehicle: string;
  service: string;
  timeSlot: string;
  dateTime: Date;
  status: 'scheduled' | 'in-progress' | 'completed' | 'canceled';
  phone?: string;
  address?: string;
  estimatedDuration?: string;
  reminderStatus: 'pending' | 'sent' | 'failed';
}

// Backend appointment response type
interface ApiAppointmentResponse {
  id: string;
  customer_name?: string;
  customer_id?: string;
  customer_phone?: string;
  customer_email?: string;
  service_id?: string;
  service?: string;
  vehicle_id?: string;
  scheduled_at?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  location_address?: string;
  status?: string;
  notes?: string;
}

export function Dashboard() {
  const { refreshTrigger, triggerRefresh, isRefreshing, setRefreshing } = useAppointments();
  const [view, setView] = useState<ViewMode>(getViewMode());
  const [loading, setLoading] = useState(true);
  // Dashboard state
  const [nextAppointment, setNextAppointment] = useState<UIAppointment | null>(null);
  const [nextAvailableSlot, setNextAvailableSlot] = useState<Date | null>(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);
  const [appointments, setAppointments] = useState<UIAppointment[]>([]);
  const [filter, setFilter] = useState<'all' | 'today'>('today');
  // Drawer state for appointment details
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const openDrawer = (id: string) => setDrawerId(id);
  const closeDrawer = () => setDrawerId(null);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const loadingRef = useRef(false);
  const setRefreshingRef = useRef(setRefreshing);
  
  // Update the ref when setRefreshing changes
  useEffect(() => {
    setRefreshingRef.current = setRefreshing;
  }, [setRefreshing]);

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
      setRefreshingRef.current(false);
    }, 10000);
    
     loadingRef.current = true;
     setLoading(true);
     setRefreshingRef.current(true);
     let fetchedApts: UIAppointment[] = [];
     try {
      console.log("📡 Making API calls to backend...");
       const aptRes = await getAdminAppointments();
      console.log("✅ API calls completed", { aptRes });
      
       if (aptRes && aptRes.appointments && Array.isArray(aptRes.appointments)) {
        console.log("📋 Processing appointments data", aptRes);
         fetchedApts = aptRes.appointments.map((apt: ApiAppointmentResponse) => {
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
     } catch (err) {
      console.error('❌ Dashboard API error', err);
      // Still proceed to show empty dashboard instead of hanging
     } finally {
      clearTimeout(safetyTimer);
      console.log("🔄 Setting appointments");
       setAppointments(fetchedApts);
       try {
        // Compute next appointment and derived stats
        // Find next appointment from ALL appointments (not just today's) that are scheduled or in-progress
        const now = new Date();
        const next = fetchedApts
          .filter(a => a.status === 'scheduled' || a.status === 'in-progress')
          .filter(a => a.dateTime >= now) // Only consider future/current appointments
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
        // Calculate next available slot
        setNextAvailableSlot(slot);
      } catch (procErr) {
        console.error('🛠️ Dashboard post-processing error', procErr);
      } finally {
        console.log("✅ Setting loading and refreshing to false");
         loadingRef.current = false;
         setLoading(false);
         setRefreshingRef.current(false);
       }
     }
  }, []); // Stable function - no dependencies needed

  useEffect(() => {
    // Only load once on mount, then rely on refresh triggers
    console.log("🎯 Initial dashboard load triggered");
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle refresh triggers separately
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log("🔄 Refresh trigger activated:", refreshTrigger);
      loadDashboardData();
    }
  }, [refreshTrigger, loadDashboardData]);

  // Auto-refresh appointments disabled to prevent infinite requests
  useEffect(() => {
    console.log("⏰ Auto-refresh disabled to prevent infinite requests");
    // const interval = setInterval(() => {
    //   if (isOnline() && !loadingRef.current && !isRefreshing) {
    //     console.log("⏰ Auto-refresh triggered");
    //     loadDashboardData();
    //   }
    // }, 120000); // 2 minutes instead of 30 seconds
    // return () => clearInterval(interval);
  }, [isRefreshing]); // Remove loadDashboardData dependency

  // Schedule notifications for today's appointments
  useEffect(() => {
    appointments.forEach(apt => {
      if (apt.dateTime.toDateString() === new Date().toDateString()) {
        scheduleReminder(apt.id, apt.customer, 15); // Schedule reminder 15 minutes before
      }
    });
  }, [appointments]);

  // Computed filtered appointments
  const filteredAppointments = React.useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    switch (filter) {
      case 'today':
        return appointments.filter(apt => 
          apt.dateTime >= startOfDay && apt.dateTime <= endOfDay
        );
      case 'all':
      default:
        return appointments;
    }
  }, [appointments, filter]);

  const handleFilterChange = (newFilter: 'all' | 'today') => {
    setFilter(newFilter);
  };

  const handleQuickSchedule = () => {
    setShowAppointmentForm(true);
  };

  const handleAddAppointment = () => {
    // Use QuickAddModal for FAB clicks to enable faster appointment creation
    setShowQuickAddModal(true);
  };

  // Handler for QuickAddModal submission - integrates with existing appointment creation flow
  const handleQuickAddSubmit = async (formData: AppointmentFormData) => {
    console.log('🚀 QuickAdd submission:', formData);
    
    // Reuse existing appointment creation logic
    await handleAppointmentFormSubmit(formData);
    
    // Close QuickAddModal on success
    setShowQuickAddModal(false);
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
      const requestedTime = formData.appointmentDate && formData.appointmentTime ? 
        new Date(`${formData.appointmentDate}T${convertTo24Hour(formData.appointmentTime)}:00`).toISOString() : 
        new Date().toISOString(); // fallback to current time for emergency appointments
        
      const appointmentData = {
        customer_id: formData.customerName,
        service: formData.serviceType,
        requested_time: requestedTime,
        customer_phone: formData.customerPhone || '',
        customer_email: formData.customerEmail || '',
        location_address: formData.serviceAddress || '',
        notes: `Vehicle: ${formData.vehicleYear} ${formData.vehicleMake} ${formData.vehicleModel}. ${formData.notes || ''}`.trim(),
      };

      console.log('📤 Sending appointment data:', appointmentData);

      if (isOnline()) {
        const response = await createAppointment(appointmentData);
        console.log('📥 API response:', response);
        
        if (response) {
          // Add to local state for immediate UI update
          const newApt: UIAppointment = {
            id: Date.now().toString(),
            customer: formData.customerName,
            vehicle: `${formData.vehicleYear} ${formData.vehicleMake} ${formData.vehicleModel}`,
            service: formData.serviceType,
            timeSlot: formData.appointmentTime || '12:00 PM',
            dateTime: formData.appointmentDate && formData.appointmentTime ? new Date(`${formData.appointmentDate}T${formData.appointmentTime}`) : new Date(),
            status: formData.appointmentType === 'emergency' ? 'in-progress' : 'scheduled',
            phone: formData.customerPhone || '(555) 000-0000',
            address: formData.serviceAddress || 'Address not provided',
            estimatedDuration: '1 hour',
            reminderStatus: 'pending' as const,
          };
          
          setAppointments(prev => [...prev, newApt]);
          saveLastQuickAdd({
            customer_id: formData.customerName,
            service: formData.serviceType,
            estimated_duration: formData.estimatedDuration,
          });
          
          alert('✅ Appointment scheduled successfully!');
          setShowAppointmentForm(false);
          setIsSubmittingAppointment(false);
          
          // Refresh data to sync with backend
          setTimeout(() => {
            console.log('🔄 Refreshing dashboard after appointment creation...');
            triggerRefresh();
          }, 1000);
        } else {
          throw new Error('API request failed');
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

  const handleStartJob = async (appointmentId: string) => {
    try {
      // Optimistically update UI
      setAppointments(prev => prev.map((apt: UIAppointment) => 
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
        const response = await updateAppointmentStatus(appointmentId, 'IN_PROGRESS');
        if (!handleApiError(response, 'Failed to start job')) {
          // Revert on failure
          setAppointments(prev => prev.map((apt: UIAppointment) => 
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
      setAppointments(prev => prev.map((apt: UIAppointment) => 
        apt.id === appointmentId 
          ? { ...apt, status: 'completed' as const }
          : apt
      ));
      
      if (nextAppointment?.id === appointmentId) {
        // Recalculate next appointment instead of setting to null
        const now = new Date();
        const updatedAppointments = appointments.map((apt: UIAppointment) => 
          apt.id === appointmentId ? { ...apt, status: 'completed' as const } : apt
        );
        const nextAvailable = updatedAppointments
          .filter(a => a.status === 'scheduled' || a.status === 'in-progress')
          .filter(a => a.dateTime >= now)
          .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())[0];
        setNextAppointment(nextAvailable || null);
      }
      
      // setSelectedAppointment(null);
      
      // Try to update backend if online
      if (isOnline()) {
        const response = await updateAppointmentStatus(appointmentId, 'COMPLETED');
        if (!handleApiError(response, 'Failed to complete job')) {
          // Revert on failure
          setAppointments(prev => prev.map((apt: UIAppointment) => 
            apt.id === appointmentId 
              ? { ...apt, status: 'in-progress' as const }
              : apt
          ));
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

  const handleVehicleLookup = () => {
    // Open customer history functionality
    alert('👥 Customer History feature coming soon! This will show customer history and vehicle details.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-sp-3"></div>
          <p className="text-fs-3 font-medium text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <FloatingActionButton onClick={handleAddAppointment} />
      <div className="space-y-sp-3 p-sp-3 sm:p-sp-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sp-3">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">🔧 Edgar's Shop Dashboard</h1>
            <p className="text-lg font-medium text-gray-600 mt-1">{getTimeGreeting()}, Edgar • {format(new Date(), 'EEEE, MMMM do')}</p>
          </div>
          <div className="flex items-center gap-sp-2">
            {/* Work progress display - show jobs completed vs total */}
            <div className="hidden sm:block text-right mr-2">
              <p className="text-sm font-medium text-gray-500">Jobs Today</p>
              <p className="text-2xl font-bold text-blue-600">{(filteredAppointments || []).filter(a => a.status === 'completed').length}/{(filteredAppointments || []).length}</p>
              <p className="text-xs text-gray-500">completed</p>
            </div>
            <button
              onClick={() => {
                console.log('🔄 Manual refresh triggered');
                triggerRefresh();
              }}
              disabled={isRefreshing}
              className="flex items-center gap-sp-2 px-sp-3 py-sp-2 bg-white text-blue-900 rounded-lg border border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${(isRefreshing) ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Badge variant={isOffline ? "destructive" : "success"}>
              {isOffline ? "Offline Mode" : "Shop Open"}
            </Badge>
            <NotificationCenter />
            <span className="text-fs-0 text-gray-500">
              {new Date().toLocaleTimeString()}
            </span>
            {/* View Mode Toggles */}
            <div className="flex items-center gap-sp-2">
              <button 
                data-testid="toggle-calendar" 
                onClick={() => { setView('calendar'); setViewMode('calendar'); }}
                onKeyDown={(e) => { 
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setView('calendar');
                    setViewMode('calendar');
                  }
                }}
                aria-label="Switch to calendar view"
                className={view === 'calendar' ? 'px-sp-2 py-sp-1 bg-blue-500 text-white rounded' : 'px-sp-2 py-sp-1 bg-gray-200 text-gray-700 rounded'}
              >
                Calendar
              </button>
              <button 
                data-testid="toggle-board" 
                onClick={() => { setView('board'); setViewMode('board'); }}
                onKeyDown={(e) => { 
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setView('board');
                    setViewMode('board');
                  }
                }}
                aria-label="Switch to board view"
                className={view === 'board' ? 'px-sp-2 py-sp-1 bg-blue-500 text-white rounded' : 'px-sp-2 py-sp-1 bg-gray-200 text-gray-700 rounded'}
              >
                Board
              </button>
            </div>
          </div>
        </div>

        {/* Offline notification */}
        {isOffline && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-sp-3">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-yellow-600 mr-sp-2" />
              <span className="text-fs-1 text-yellow-800 font-medium">
                Working in offline mode. Changes will sync when connection is restored.
              </span>
            </div>
          </div>
        )}

        {/* Main View Section */}
        {view === 'calendar' ? (
          <div data-testid="calendar-view">
            <DailyFocusHero nextAppointment={nextAppointment} appointments={filteredAppointments} />
            <div className="mt-sp-3">
              <ScheduleFilterToggle onFilterChange={handleFilterChange} activeFilter={filter} />
            </div>
            {/* Calendar Section */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-sp-3 mt-sp-3">
              <div className="lg:col-span-3">
                <AppointmentCalendar
                  appointments={filteredAppointments}
                  onAppointmentClick={(apt) => openDrawer(apt.id)}
                  onAddAppointment={handleAddAppointment}
                  onStartJob={handleStartJob}
                  onCompleteJob={handleCompleteJob}
                  onCallCustomer={handleCallCustomer}
                />
              </div>

              {/* Next Appointment & Big Action Buttons */}
              <div className="lg:col-span-2 space-y-sp-3">
                {/* Next Appointment Card */}
                <Card>
                  <CardContent className="p-sp-4 sm:p-sp-4">
                    <h2 className="text-fs-3 font-bold text-gray-700 mb-sp-3">🕐 Next Appointment</h2>
                    {nextAppointment ? (
                      <div className="text-center py-sp-2">
                        <div className="text-fs-4 sm:text-fs-5 font-bold text-orange-600 mb-sp-2">
                          {nextAppointment.timeSlot}
                        </div>
                        <div className="font-bold text-fs-2 text-gray-900">
                          {nextAppointment.customer}
                        </div>
                        <div className="text-gray-600 mt-sp-1 text-fs-0 sm:text-fs-1">
                          🚗 {nextAppointment.vehicle}
                        </div>
                        <div className="text-gray-600 text-fs-0 sm:text-fs-1">
                          🔧 {nextAppointment.service}
                        </div>
                        <div className="text-gray-500 text-fs-0 mt-sp-2">
                          📞 {nextAppointment.phone}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-sp-3">
                        <div className="text-fs-5 sm:text-fs-6 mb-sp-2">✅</div>
                        <div className="font-medium text-fs-2 text-gray-600">All caught up!</div>
                        <div className="text-fs-0 text-gray-500">No more appointments today</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Big Action Buttons */}
                <Card>
                  <CardContent className="p-sp-4 sm:p-sp-4">
                    <h3 className="text-fs-3 font-bold text-gray-600 mb-sp-3">⚡ Schedule New Service</h3>
                    {nextAvailableSlot && (
                      <div className="mb-sp-3 text-center text-gray-700">
                        Next available slot: <span className="font-bold text-blue-600">{format(nextAvailableSlot, 'h:mm a')}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3">
                      {nextAppointment && nextAppointment.status === 'scheduled' && (
                        <button
                          onClick={() => handleQuickAction('start')}
                          className="w-full py-sp-4 text-fs-3 font-bold rounded-xl shadow-lg flex items-center justify-center space-x-sp-2 touch-manipulation bg-orange-500 text-white hover:bg-orange-600"
                        >
                          <Wrench className="h-7 w-7" />
                          <span>🔧 Start Next Job</span>
                        </button>
                      )}

                      {nextAppointment && nextAppointment.status === 'in-progress' && (
                        <button
                          onClick={() => handleQuickAction('complete')}
                          className="w-full py-sp-4 text-fs-3 font-bold rounded-xl shadow-lg flex items-center justify-center space-x-sp-2 touch-manipulation bg-green-600 text-white hover:bg-green-700"
                        >
                          <CheckCircle className="h-7 w-7" />
                          <span>✅ Complete Current Job</span>
                        </button>
                      )}

                      <div className="relative">
                        <button
                          onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                          className="w-full py-sp-4 text-fs-3 font-bold rounded-xl shadow-lg flex items-center justify-center space-x-sp-2 touch-manipulation bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Calendar className="h-7 w-7" />
                          <span>📅 Schedule Service</span>
                          <PlusCircle className="h-6 w-6 ml-sp-2" />
                        </button>
                        {showScheduleDropdown && (
                          <div className="absolute z-10 mt-sp-2 w-full bg-white rounded-md shadow-lg">
                            <button
                              onClick={() => { handleAddAppointment(); setShowScheduleDropdown(false); }}
                              className="block w-full text-left px-sp-3 py-sp-2 text-fs-1 text-gray-700 hover:bg-gray-100"
                            >
                              Regular Appointment
                            </button>
                            <button
                              onClick={() => { handleAddAppointment(); setShowScheduleDropdown(false); }}
                              className="block w-full text-left px-sp-3 py-sp-2 text-fs-1 text-gray-700 hover:bg-gray-100"
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
          </div>
        ) : (
          <div data-testid="board-view">
            <div className="mb-4">
              <IntelligentWorkflowPanel />
            </div>
            <StatusBoard onOpen={openDrawer} />
          </div>
        )}
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
         onQuickSchedule={handleQuickSchedule}
         isSubmitting={isSubmittingAppointment}
       />

       {/* Quick Add Modal - Enhanced for rapid appointment creation */}
       <QuickAddModal
         isOpen={showQuickAddModal}
         onClose={() => setShowQuickAddModal(false)}
         onSubmit={handleQuickAddSubmit}
         isSubmitting={isSubmittingAppointment}
       />

      {/* Appointment Details Drawer */}
      <AppointmentDrawer open={!!drawerId} id={drawerId} onClose={closeDrawer} />
    </>
  ); // close return of Dashboard
} // close Dashboard function

export default Dashboard;