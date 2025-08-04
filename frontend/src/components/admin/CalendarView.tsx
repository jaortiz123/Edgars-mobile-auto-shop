import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Calendar, ChevronLeft, ChevronRight, Filter, Download, Search } from 'lucide-react';

interface Appointment {
  id: string;
  customer_name: string;
  service: string;
  scheduled_at: string;
  status: string;
  customer_phone?: string;
  location_address?: string;
  notes?: string;
}

interface CalendarDay {
  date: Date;
  appointments: Appointment[];
  isCurrentMonth: boolean;
  isToday: boolean;
}

type ViewMode = 'day' | 'week' | 'month';

export const CalendarView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchAppointments();
  }, [currentDate, viewMode]);

  // Auto-refresh appointments every 30 seconds
  useEffect(() => {
    // TEMP: Disabled polling to fix infinite request loop
    console.log('Calendar polling disabled to prevent infinite requests');
    return;
    
    const interval = setInterval(() => {
      if (!loading) {
        console.log('🔄 Auto-refreshing calendar appointments...');
        fetchAppointments();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [loading]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      // Fetch real appointments from backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/admin/appointments/today`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && Array.isArray(data.data.appointments)) {
          const realAppointments: Appointment[] = data.data.appointments.map((apt: any) => ({
            id: apt.id.toString(),
            customer_name: apt.customer_name || 'Unknown Customer',
            service: `Service ${apt.service_id || 'N/A'}`,
            scheduled_at: apt.scheduled_at || apt.scheduled_date + 'T' + apt.scheduled_time,
            status: apt.status || 'pending',
            customer_phone: apt.customer_phone || '',
            location_address: apt.location_address || '',
            notes: apt.notes || ''
          }));
          setAppointments(realAppointments);
        } else {
          console.warn('Invalid appointments data structure:', data);
          setAppointments([]);
        }
      } else {
        console.error('Failed to fetch appointments:', response.statusText);
        // Fall back to mock data if API fails
        const mockAppointments: Appointment[] = [
          {
            id: '1',
            customer_name: 'John Doe',
            service: 'Oil Change',
            scheduled_at: new Date().toISOString(),
            status: 'confirmed',
            customer_phone: '+15551234567',
            location_address: '123 Main St, City',
            notes: 'Customer prefers morning appointments'
          }
        ];
        setAppointments(mockAppointments);
      }
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      // Fall back to empty appointments on error
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = (appointments: Appointment[]) => {
    return appointments.filter(apt => {
      const matchesSearch = 
        apt.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.customer_phone?.includes(searchTerm) ||
        apt.location_address?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayAppointments = filterAppointments(appointments).filter(apt => {
        const aptDate = new Date(apt.scheduled_at);
        return aptDate.toDateString() === date.toDateString();
      });
      
      days.push({
        date: new Date(date),
        appointments: dayAppointments,
        isCurrentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime()
      });
    }
    
    return days;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setCurrentDate(newDate);
  };

  const getDateRangeText = () => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: viewMode === 'day' ? 'numeric' : undefined
    });
    
    if (viewMode === 'week') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
    }
    
    return formatter.format(currentDate);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'completed': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  const toggleAppointmentSelection = (appointmentId: string) => {
    setSelectedAppointments(prev => 
      prev.includes(appointmentId)
        ? prev.filter(id => id !== appointmentId)
        : [...prev, appointmentId]
    );
  };

  const exportAppointments = () => {
    const appointmentsToExport = selectedAppointments.length > 0
      ? appointments.filter(apt => selectedAppointments.includes(apt.id))
      : filterAppointments(appointments);
    
    const csvData = [
      ['Customer Name', 'Service', 'Date', 'Time', 'Status', 'Phone', 'Address', 'Notes'],
      ...appointmentsToExport.map(apt => [
        apt.customer_name,
        apt.service,
        new Date(apt.scheduled_at).toLocaleDateString(),
        new Date(apt.scheduled_at).toLocaleTimeString(),
        apt.status,
        apt.customer_phone || '',
        apt.location_address || '',
        apt.notes || ''
      ])
    ];
    
    const csvContent = csvData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading calendar...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Calendar className="h-6 w-6 text-blue-600" />
              <CardTitle>Appointment Calendar</CardTitle>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Selector */}
              <div className="flex border rounded-lg">
                {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode(mode)}
                    className="rounded-none first:rounded-l-lg last:rounded-r-lg"
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Button>
                ))}
              </div>
              
              {/* Export Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={exportAppointments}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export ({selectedAppointments.length || filterAppointments(appointments).length})
              </Button>
            </div>
          </div>
          
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers, services, or addresses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-600" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('prev')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <h2 className="text-xl font-semibold">{getDateRangeText()}</h2>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('next')}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {viewMode === 'month' && (
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center font-medium text-gray-600 border-b">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {generateCalendarDays().map((day, index) => (
                <div
                  key={index}
                  className={`min-h-[120px] p-2 border border-gray-200 ${
                    !day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''
                  } ${day.isToday ? 'bg-blue-50 border-blue-200' : ''}`}
                >
                  <div className="font-medium mb-1">
                    {day.date.getDate()}
                  </div>
                  
                  <div className="space-y-1">
                    {day.appointments.slice(0, 2).map(apt => (
                      <div
                        key={apt.id}
                        onClick={() => toggleAppointmentSelection(apt.id)}
                        className={`text-xs p-1 rounded cursor-pointer border ${
                          selectedAppointments.includes(apt.id)
                            ? 'border-blue-500 bg-blue-100'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium truncate">{apt.customer_name}</div>
                        <div className="text-gray-600 truncate">{apt.service}</div>
                        <Badge variant={getStatusColor(apt.status) as any} className="text-xs">
                          {apt.status}
                        </Badge>
                      </div>
                    ))}
                    
                    {day.appointments.length > 2 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{day.appointments.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {viewMode === 'week' && (
            <div className="space-y-4">
              <p className="text-gray-600">Week view implementation coming soon...</p>
            </div>
          )}
          
          {viewMode === 'day' && (
            <div className="space-y-4">
              <p className="text-gray-600">Day view implementation coming soon...</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Selection Summary */}
      {selectedAppointments.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedAppointments.length} appointment(s) selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAppointments([])}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={exportAppointments}
                >
                  Export Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CalendarView;
