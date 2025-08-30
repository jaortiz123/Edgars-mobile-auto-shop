import React, { useState, useEffect, useCallback } from 'react';
import {
  searchServiceOperations,
  createServiceOperation,
  updateServiceOperation,
  deleteServiceOperation
} from '../../lib/api';
import { ServiceOperation, ServiceOperationInput } from '../../types/models';
import { useDebounce } from '../../hooks/useDebounce';

// Service categories for filtering
const SERVICE_CATEGORIES = [
  'MAINTENANCE',
  'BRAKES',
  'ENGINE',
  'TRANSMISSION_DRIVETRAIN',
  'TIRES_STEERING_SUSPENSION',
  'ELECTRICAL',
  'HVAC',
  'BODY_PAINT',
  'INSPECTION',
  'OTHER'
];

interface ServiceFormData {
  name: string;
  category: string;
  subcategory: string;
  internal_code: string;
  skill_level: number;
  default_hours: number;
  base_labor_rate: number;
  keywords: string[];
  display_order: number;
  is_active: boolean;
}

const initialFormData: ServiceFormData = {
  name: '',
  category: 'MAINTENANCE',
  subcategory: '',
  internal_code: '',
  skill_level: 1,
  default_hours: 1,
  base_labor_rate: 100,
  keywords: [],
  display_order: 0,
  is_active: true
};

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceOperation | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  // Debounce search query to avoid too many API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Load services with current filters
  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const results = await searchServiceOperations({
        q: debouncedSearchQuery || undefined,
        sort: sortField,
        dir: sortDir,
        limit: 100,
        category: selectedCategory || undefined
      });
      setServices(results);
    } catch (error) {
      console.error('Failed to load services:', error);
      alert('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery, sortField, sortDir, selectedCategory]);

  // Load services on mount and when filters change
  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Open create modal
  const handleCreate = () => {
    setEditingService(null);
    setFormData(initialFormData);
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (service: ServiceOperation) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category: service.category,
      subcategory: service.subcategory || '',
      internal_code: service.internal_code || '',
      skill_level: service.skill_level || 1,
      default_hours: service.default_hours || 1,
      base_labor_rate: service.base_labor_rate || 100,
      keywords: service.keywords || [],
      display_order: service.display_order || 0,
      is_active: service.is_active
    });
    setShowModal(true);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);

      const payload: ServiceOperationInput = {
        ...formData,
        keywords: formData.keywords.length > 0 ? formData.keywords : undefined,
        subcategory: formData.subcategory || undefined,
        internal_code: formData.internal_code || undefined
      };

      if (editingService) {
        await updateServiceOperation(editingService.id, payload);
        alert('Service updated successfully');
      } else {
        await createServiceOperation(payload);
        alert('Service created successfully');
      }

      setShowModal(false);
      loadServices(); // Refresh the list
    } catch (error) {
      console.error('Failed to save service:', error);
      alert(`Failed to ${editingService ? 'update' : 'create'} service`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (service: ServiceOperation) => {
    if (!confirm(`Are you sure you want to delete "${service.name}"? This will mark it as inactive.`)) {
      return;
    }

    try {
      await deleteServiceOperation(service.id);
      alert('Service deleted successfully');
      loadServices(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete service:', error);
      alert('Failed to delete service');
    }
  };

  // Handle sort change
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Handle keywords input change (comma-separated)
  const handleKeywordsChange = (value: string) => {
    const keywords = value.split(',').map(k => k.trim()).filter(k => k);
    setFormData({ ...formData, keywords });
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Service Management</h1>
        <p className="mt-2 text-sm text-gray-700">
          Manage your shop's service catalog. Add, edit, and organize the services you offer.
        </p>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search services by name, category, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Category Filter */}
          <div className="sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by category"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {SERVICE_CATEGORIES.map(category => (
                <option key={category} value={category}>
                  {category.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Add Service Button */}
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Service
          </button>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Name</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Category</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Skill Level
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    </div>
                    Loading services...
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    {debouncedSearchQuery || selectedCategory ? 'No services found matching your criteria.' : 'No services found. Click "Add Service" to create your first service.'}
                  </td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{service.name}</div>
                      {service.subcategory && (
                        <div className="text-sm text-gray-500">{service.subcategory}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {service.category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {service.default_hours ? `${service.default_hours} hrs` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {service.base_labor_rate ? `$${service.base_labor_rate}` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {service.skill_level && (
                        <div className="flex">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div
                              key={i}
                              className={`h-2 w-2 rounded-full mr-1 ${
                                i < (service.skill_level || 0) ? 'bg-indigo-600' : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        service.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {service.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(service)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="sr-only">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(service)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="sr-only">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Service Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowModal(false)}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {editingService ? 'Edit Service' : 'Create New Service'}
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Service Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Service Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                      Category *
                    </label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      {SERVICE_CATEGORIES.map(category => (
                        <option key={category} value={category}>
                          {category.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategory */}
                  <div>
                    <label htmlFor="subcategory" className="block text-sm font-medium text-gray-700">
                      Subcategory
                    </label>
                    <input
                      type="text"
                      id="subcategory"
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Default Hours */}
                    <div>
                      <label htmlFor="default_hours" className="block text-sm font-medium text-gray-700">
                        Default Hours
                      </label>
                      <input
                        type="number"
                        id="default_hours"
                        step="0.25"
                        min="0"
                        value={formData.default_hours}
                        onChange={(e) => setFormData({ ...formData, default_hours: parseFloat(e.target.value) || 0 })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    {/* Labor Rate */}
                    <div>
                      <label htmlFor="base_labor_rate" className="block text-sm font-medium text-gray-700">
                        Labor Rate ($)
                      </label>
                      <input
                        type="number"
                        id="base_labor_rate"
                        step="0.01"
                        min="0"
                        value={formData.base_labor_rate}
                        onChange={(e) => setFormData({ ...formData, base_labor_rate: parseFloat(e.target.value) || 0 })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Skill Level */}
                    <div>
                      <label htmlFor="skill_level" className="block text-sm font-medium text-gray-700">
                        Skill Level (1-5)
                      </label>
                      <select
                        id="skill_level"
                        value={formData.skill_level}
                        onChange={(e) => setFormData({ ...formData, skill_level: parseInt(e.target.value) })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {[1, 2, 3, 4, 5].map(level => (
                          <option key={level} value={level}>Level {level}</option>
                        ))}
                      </select>
                    </div>

                    {/* Display Order */}
                    <div>
                      <label htmlFor="display_order" className="block text-sm font-medium text-gray-700">
                        Display Order
                      </label>
                      <input
                        type="number"
                        id="display_order"
                        value={formData.display_order}
                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Keywords */}
                  <div>
                    <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
                      Keywords (comma-separated)
                    </label>
                    <input
                      type="text"
                      id="keywords"
                      value={formData.keywords.join(', ')}
                      onChange={(e) => handleKeywordsChange(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="oil, filter, maintenance"
                    />
                  </div>

                  {/* Active Status */}
                  <div className="flex items-center">
                    <input
                      id="is_active"
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                      Active service
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : (editingService ? 'Update Service' : 'Create Service')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
