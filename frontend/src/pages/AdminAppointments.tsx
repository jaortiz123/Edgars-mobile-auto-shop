// Task: Create AdminAppointments React page
import React, { useEffect, useState } from 'react';
import { getAdminAppointmentsToday, updateAppointment } from '../services/apiService';
import { NotificationTracker } from '../components/admin/NotificationTracker';
import CalendarView from '../components/admin/CalendarView';
import AdvancedFilter from '../components/admin/AdvancedFilter';
import DataExport from '../components/admin/DataExport';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { 
  Calendar, 
  List, 
  Filter, 
  Download, 
  RefreshCw, 
  BarChart3,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface Appointment {
  id: string;
  customer_name: string;
  customer_id?: string;
  customer_email?: string;
  service: string;
  service_id?: string;
  requested_time: string;
  scheduled_at?: string;
  scheduled_time?: string;
  location_address?: string;
  status: string;
  customer_phone?: string;
  notes?: string;
  created_at?: string;
  price?: number;
}

interface FilterOptions {
  dateRange: {
    start: string;
    end: string;
  };
  status: string[];
  services: string[];
  locations: string[];
  customerSearch: string;
  phoneSearch: string;
}

type ViewMode = 'list' | 'calendar';

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: { start: '', end: '' },
    status: [],
    services: [],
    locations: [],
    customerSearch: '',
    phoneSearch: ''
  });

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Auto-refresh appointments every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        console.log('🔄 Auto-refreshing appointments...');
        fetchAppointments();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [loading]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const data = await getAdminAppointmentsToday();
      setAppointments(data as Appointment[]);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to fetch appointments');
      } else {
        setError('Failed to fetch appointments');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (id: string) => {
    setUpdatingId(id);
    try {
      await updateAppointment(id, { status: 'completed' });
      setAppointments(appts => appts.map(appt => appt.id === id ? { ...appt, status: 'completed' } : appt));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to update appointment');
      } else {
        setError('Failed to update appointment');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const applyFilters = (appointments: Appointment[]): Appointment[] => {
    return appointments.filter(apt => {
      // Date range filter
      if (filters.dateRange.start || filters.dateRange.end) {
        const aptDate = new Date(apt.scheduled_at || apt.requested_time);
        if (filters.dateRange.start && aptDate < new Date(filters.dateRange.start)) return false;
        if (filters.dateRange.end && aptDate > new Date(filters.dateRange.end)) return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(apt.status)) return false;

      // Service filter
      if (filters.services.length > 0 && !filters.services.includes(apt.service)) return false;

      // Customer search
      if (filters.customerSearch) {
        const searchTerm = filters.customerSearch.toLowerCase();
        const customerMatch = apt.customer_name.toLowerCase().includes(searchTerm) ||
                             apt.customer_email?.toLowerCase().includes(searchTerm);
        if (!customerMatch) return false;
      }

      // Phone search
      if (filters.phoneSearch && !apt.customer_phone?.includes(filters.phoneSearch)) return false;

      return true;
    });
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      dateRange: { start: '', end: '' },
      status: [],
      services: [],
      locations: [],
      customerSearch: '',
      phoneSearch: ''
    });
  };

  const toggleAppointmentSelection = (appointmentId: string) => {
    setSelectedAppointments(prev => 
      prev.includes(appointmentId)
        ? prev.filter(id => id !== appointmentId)
        : [...prev, appointmentId]
    );
  };

  const selectAllAppointments = () => {
    const filteredAppts = applyFilters(appointments);
    const allIds = filteredAppts.map(apt => apt.id);
    setSelectedAppointments(prev => 
      prev.length === allIds.length ? [] : allIds
    );
  };

  const getAppointmentStats = () => {
    const filteredAppts = applyFilters(appointments);
    return {
      total: filteredAppts.length,
      pending: filteredAppts.filter(apt => apt.status === 'pending').length,
      confirmed: filteredAppts.filter(apt => apt.status === 'confirmed').length,
      completed: filteredAppts.filter(apt => apt.status === 'completed').length,
      cancelled: filteredAppts.filter(apt => apt.status === 'cancelled').length,
    };
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

  const filteredAppointments = applyFilters(appointments);
  const stats = getAppointmentStats();

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edgar's Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage appointments, monitor notifications, and view analytics</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={fetchAppointments}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export ({selectedAppointments.length || filteredAppointments.length})
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Confirmed</p>
                <p className="text-2xl font-bold">{stats.confirmed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold">{stats.cancelled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notification Tracking Panel */}
      <NotificationTracker />

      {/* View Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === 'list' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-none rounded-l-lg flex items-center gap-2"
                >
                  <List className="h-4 w-4" />
                  List View
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className="rounded-none rounded-r-lg flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Calendar View
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AdvancedFilter
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
                activeFilters={filters}
                isOpen={showFilters}
                onToggle={() => setShowFilters(!showFilters)}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters Panel */}
      {showFilters && (
        <AdvancedFilter
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          activeFilters={filters}
          isOpen={showFilters}
          onToggle={() => setShowFilters(!showFilters)}
        />
      )}

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <DataExport
            appointments={filteredAppointments}
            selectedAppointments={selectedAppointments}
            onClose={() => setShowExport(false)}
          />
        </div>
      )}

      {/* Content */}
      {error && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading appointments...</p>
          </CardContent>
        </Card>
      ) : viewMode === 'calendar' ? (
        <CalendarView />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Appointments ({filteredAppointments.length})</CardTitle>
              {filteredAppointments.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllAppointments}
                  >
                    {selectedAppointments.length === filteredAppointments.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  {selectedAppointments.length > 0 && (
                    <Badge variant="primary">
                      {selectedAppointments.length} selected
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent>
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No appointments found</p>
                <p className="text-sm">Try adjusting your filters or check back later.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedAppointments.length === filteredAppointments.length}
                          onChange={selectAllAppointments}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAppointments.map((appt) => (
                      <tr key={appt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedAppointments.includes(appt.id)}
                            onChange={() => toggleAppointmentSelection(appt.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {appt.customer_name || appt.customer_id}
                            </div>
                            {appt.customer_phone && (
                              <div className="text-sm text-gray-500">{appt.customer_phone}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {appt.service || appt.service_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(appt.scheduled_at || appt.scheduled_time || appt.requested_time).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {appt.location_address || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={getStatusColor(appt.status) as any}>
                            {appt.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {appt.status !== 'completed' && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkComplete(appt.id)}
                              disabled={updatingId === appt.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {updatingId === appt.id ? 'Updating...' : 'Mark Complete'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
