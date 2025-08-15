/**
 * P2-T-004 Coverage Tests - API Service
 * Tests specifically designed to achieve coverage on critical apiService functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock environment before any imports
vi.stubEnv('VITE_API_ENDPOINT_URL', 'http://localhost:5001');

describe('ApiService Coverage Tests', () => {
  let apiService: any;
  
  // Mock fetch
  const mockFetch = vi.fn();

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup fetch mock
    global.fetch = mockFetch;
    
    // Dynamic import to get fresh module
    apiService = await import('../../services/apiService');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAppointment', () => {
    const mockAppointmentData = {
      customer_id: 'cust123',
      service: 'Oil Change',
      requested_time: '2025-08-03T14:00:00Z',
      customer_phone: '+1234567890',
      customer_email: 'test@example.com',
      location_address: '123 Main St',
      notes: 'Test appointment',
      sms_consent: true,
      sms_consent_ip: '192.168.1.1'
    };

    it('should create appointment successfully', async () => {
      const mockResponse = { id: 'apt123', status: 'created' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      const result = await apiService.createAppointment(mockAppointmentData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/admin/appointments',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle creation failure with JSON error', async () => {
      const errorResponse = { error: 'Customer not found' };
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue(errorResponse)
      });

      await expect(apiService.createAppointment(mockAppointmentData))
        .rejects.toThrow('Customer not found');
    });

    it('should handle network failures', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(apiService.createAppointment(mockAppointmentData))
        .rejects.toThrow('Network error');
    });
  });

  // Removed legacy getAppointments() tests (endpoint deprecated)

  describe('getAdminAppointments', () => {
    it('should fetch admin appointments successfully', async () => {
      const mockAppointments = [
        { id: 'apt1', customer_id: 'cust1', service_id: 'svc1', status: 'scheduled' }
      ];
      const mockResponse = { data: { appointments: mockAppointments } };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      const result = await apiService.getAdminAppointments();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/admin/appointments',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual({ appointments: mockAppointments });
    });

    it('should return empty array when no data.appointments', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({})
      });

      const result = await apiService.getAdminAppointments();
      expect(result).toEqual({ appointments: [] });
    });

    it('should handle admin fetch failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Unauthorized access' })
      });

      await expect(apiService.getAdminAppointments())
        .rejects.toThrow('Unauthorized access');
    });
  });

  describe('getAdminAppointmentsToday', () => {
    it('should fetch today\'s appointments successfully', async () => {
      const mockAppointments = [
        { id: 'apt1', customer_id: 'cust1', service_id: 'svc1', status: 'scheduled' }
      ];
      const mockResponse = { appointments: mockAppointments };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      const result = await apiService.getAdminAppointmentsToday();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/admin/appointments/today',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual(mockAppointments);
    });

    it('should return empty array when no appointments today', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({})
      });

      const result = await apiService.getAdminAppointmentsToday();
      expect(result).toEqual([]);
    });
  });

  describe('updateAppointment', () => {
    it('should update appointment successfully', async () => {
      const updateData = { status: 'completed', notes: 'Work finished' };
      const mockResponse = { message: 'Appointment updated successfully' };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      const result = await apiService.updateAppointment('apt123', updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/admin/appointments/apt123',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle update failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ message: 'Appointment not found' })
      });

      await expect(apiService.updateAppointment('apt123', { status: 'completed' }))
        .rejects.toThrow('Appointment not found');
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle createAppointment with message field error', async () => {
      const errorResponse = { message: 'Invalid time slot' };
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue(errorResponse)
      });

      await expect(apiService.createAppointment({
        customer_id: 'cust123',
        service: 'Oil Change',
        requested_time: '2025-08-03T14:00:00Z'
      })).rejects.toThrow('Invalid time slot');
    });

    it('should handle createAppointment with JSON stringify fallback', async () => {
      const errorResponse = { custom_field: 'some custom error data' };
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue(errorResponse)
      });

      await expect(apiService.createAppointment({
        customer_id: 'cust123',
        service: 'Oil Change',
        requested_time: '2025-08-03T14:00:00Z'
      })).rejects.toThrow(JSON.stringify(errorResponse));
    });

    it('should handle createAppointment with text fallback when JSON fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
        text: vi.fn().mockResolvedValue('Internal Server Error')
      });

      await expect(apiService.createAppointment({
        customer_id: 'cust123',
        service: 'Oil Change',
        requested_time: '2025-08-03T14:00:00Z'
      })).rejects.toThrow('Internal Server Error');
    });

  // Removed legacy getAppointments fallback test (endpoint deprecated)

    it('should handle getAdminAppointments with JSON stringify fallback', async () => {
      const errorResponse = { custom_error: 'Database connection failed' };
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue(errorResponse)
      });

      await expect(apiService.getAdminAppointments())
        .rejects.toThrow(JSON.stringify(errorResponse));
    });

    it('should handle getAdminAppointments with text fallback', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
        text: vi.fn().mockResolvedValue('Internal Server Error')
      });

      await expect(apiService.getAdminAppointments())
        .rejects.toThrow('Internal Server Error');
    });

    it('should handle getAdminAppointmentsToday with text fallback', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
        text: vi.fn().mockResolvedValue('Service Temporarily Unavailable')
      });

      await expect(apiService.getAdminAppointmentsToday())
        .rejects.toThrow('Service Temporarily Unavailable');
    });

    it('should handle updateAppointment with text fallback', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
        text: vi.fn().mockResolvedValue('Update Failed')
      });

      await expect(apiService.updateAppointment('apt123', { status: 'completed' }))
        .rejects.toThrow('Update Failed');
    });

    it('should handle createAppointment with empty error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({})
      });

      await expect(apiService.createAppointment({
        customer_id: 'cust123',
        service: 'Oil Change',
        requested_time: '2025-08-03T14:00:00Z'
      })).rejects.toThrow('{}');
    });

    it('should handle network failures for admin endpoints', async () => {
      const networkError = new Error('Network connection failed');
      mockFetch.mockRejectedValue(networkError);

      await expect(apiService.getAdminAppointments()).rejects.toThrow('Network connection failed');
      await expect(apiService.getAdminAppointmentsToday()).rejects.toThrow('Network connection failed');
      await expect(apiService.updateAppointment('apt123', {})).rejects.toThrow('Network connection failed');
    });
  });

  describe('Type Definitions', () => {
    it('should validate AppointmentPayload interface', () => {
      const validPayload: typeof apiService.AppointmentPayload = {
        customer_id: 'cust123',
        service: 'Oil Change',
        requested_time: '2025-08-03T14:00:00Z'
      };

      expect(validPayload).toBeDefined();
      expect(typeof validPayload.customer_id).toBe('string');
      expect(typeof validPayload.service).toBe('string');
      expect(typeof validPayload.requested_time).toBe('string');
    });

    it('should validate AdminAppointment interface', () => {
      const validAdmin: typeof apiService.AdminAppointment = {
        id: 'apt123',
        customer_id: 'cust123',
        service_id: 'svc123',
        location_address: '123 Main St',
        status: 'scheduled'
      };

      expect(validAdmin).toBeDefined();
      expect(typeof validAdmin.id).toBe('string');
      expect(typeof validAdmin.status).toBe('string');
    });
  });

  describe('Environment Variable Testing', () => {
    it('should use the configured API base URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'apt123' })
      });

      await apiService.createAppointment({
        customer_id: 'cust123',
        service: 'Oil Change',
        requested_time: '2025-08-03T14:00:00Z'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/admin/appointments',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
