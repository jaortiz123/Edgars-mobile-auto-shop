import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Filter, X, Calendar, MapPin, Phone, User, Wrench } from 'lucide-react';

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

interface AdvancedFilterProps {
  onFilterChange: (filters: FilterOptions) => void;
  onClearFilters: () => void;
  activeFilters: FilterOptions;
  isOpen: boolean;
  onToggle: () => void;
}

const AdvancedFilter: React.FC<AdvancedFilterProps> = ({
  onFilterChange,
  onClearFilters,
  activeFilters,
  isOpen,
  onToggle
}) => {
  const [tempFilters, setTempFilters] = useState<FilterOptions>(activeFilters);

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'warning' },
    { value: 'confirmed', label: 'Confirmed', color: 'success' },
    { value: 'in-progress', label: 'In Progress', color: 'default' },
    { value: 'completed', label: 'Completed', color: 'secondary' },
    { value: 'cancelled', label: 'Cancelled', color: 'destructive' },
    { value: 'no-show', label: 'No Show', color: 'destructive' }
  ];

  const serviceOptions = [
    'Oil Change',
    'Brake Service',
    'Tire Rotation',
    'Battery Replacement',
    'Engine Diagnostics',
    'Transmission Service',
    'Air Conditioning',
    'Wheel Alignment',
    'Suspension Repair',
    'Electrical System'
  ];

  const commonLocations = [
    'Downtown Area',
    'North Side',
    'South Side',
    'East End',
    'West End',
    'Business District',
    'Residential Area',
    'Industrial Zone'
  ];

  const handleStatusToggle = (status: string) => {
    const newStatus = tempFilters.status.includes(status)
      ? tempFilters.status.filter(s => s !== status)
      : [...tempFilters.status, status];

    setTempFilters({ ...tempFilters, status: newStatus });
  };

  const handleServiceToggle = (service: string) => {
    const newServices = tempFilters.services.includes(service)
      ? tempFilters.services.filter(s => s !== service)
      : [...tempFilters.services, service];

    setTempFilters({ ...tempFilters, services: newServices });
  };

  const handleLocationToggle = (location: string) => {
    const newLocations = tempFilters.locations.includes(location)
      ? tempFilters.locations.filter(l => l !== location)
      : [...tempFilters.locations, location];

    setTempFilters({ ...tempFilters, locations: newLocations });
  };

  const applyFilters = () => {
    onFilterChange(tempFilters);
    onToggle();
  };

  const resetFilters = () => {
    const emptyFilters: FilterOptions = {
      dateRange: { start: '', end: '' },
      status: [],
      services: [],
      locations: [],
      customerSearch: '',
      phoneSearch: ''
    };
    setTempFilters(emptyFilters);
    onClearFilters();
  };

  const getActiveFilterCount = () => {
    return (
      (tempFilters.dateRange.start || tempFilters.dateRange.end ? 1 : 0) +
      tempFilters.status.length +
      tempFilters.services.length +
      tempFilters.locations.length +
      (tempFilters.customerSearch ? 1 : 0) +
      (tempFilters.phoneSearch ? 1 : 0)
    );
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        onClick={onToggle}
        className="flex items-center gap-2"
      >
        <Filter className="h-4 w-4" />
        Advanced Filters
        {getActiveFilterCount() > 0 && (
          <Badge variant="primary" className="ml-1">
            {getActiveFilterCount()}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            className="flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Date Range Filter */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <Calendar className="h-4 w-4" />
            Date Range
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={tempFilters.dateRange.start}
                onChange={(e) => setTempFilters({
                  ...tempFilters,
                  dateRange: { ...tempFilters.dateRange, start: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={tempFilters.dateRange.end}
                onChange={(e) => setTempFilters({
                  ...tempFilters,
                  dateRange: { ...tempFilters.dateRange, end: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <span className="w-4 h-4 inline-flex items-center justify-center rounded-full border border-gray-300">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            </span>
            Appointment Status
          </label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusToggle(option.value)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  tempFilters.status.includes(option.value)
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Service Type Filter */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <Wrench className="h-4 w-4" />
            Service Types
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {serviceOptions.map((service) => (
              <label key={service} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={tempFilters.services.includes(service)}
                  onChange={() => handleServiceToggle(service)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{service}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Location Filter */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <MapPin className="h-4 w-4" />
            Service Areas
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {commonLocations.map((location) => (
              <label key={location} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={tempFilters.locations.includes(location)}
                  onChange={() => handleLocationToggle(location)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{location}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Customer Search */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <User className="h-4 w-4" />
            Customer Search
          </label>
          <input
            type="text"
            placeholder="Search by customer name or email..."
            value={tempFilters.customerSearch}
            onChange={(e) => setTempFilters({
              ...tempFilters,
              customerSearch: e.target.value
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Phone Search */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <Phone className="h-4 w-4" />
            Phone Number
          </label>
          <input
            type="text"
            placeholder="Search by phone number..."
            value={tempFilters.phoneSearch}
            onChange={(e) => setTempFilters({
              ...tempFilters,
              phoneSearch: e.target.value
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            onClick={applyFilters}
            className="flex-1 sm:flex-none"
          >
            Apply Filters ({getActiveFilterCount()})
          </Button>
          <Button
            variant="outline"
            onClick={resetFilters}
            className="flex-1 sm:flex-none"
          >
            Clear All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdvancedFilter;
