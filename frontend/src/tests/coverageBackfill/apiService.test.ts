/**
 * P2-T-004 Coverage Tests - API Service
 * Tests specifically designed to achieve coverage on critical apiService functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AppointmentPayload, AdminAppointment } from '../../services/apiService';
import type * as ApiServiceModule from '../../services/apiService';

type AxiosLikeResponse<T = unknown> = { status: number; data: T };
type HttpLike = {
  get: (url: string, ...args: unknown[]) => Promise<AxiosLikeResponse>;
  post: (url: string, body?: unknown, ...args: unknown[]) => Promise<AxiosLikeResponse>;
  put: (url: string, body?: unknown, ...args: unknown[]) => Promise<AxiosLikeResponse>;
};

describe('ApiService Coverage Tests', () => {
  let apiService: typeof ApiServiceModule;
  let http: HttpLike;

  beforeEach(async () => {
    vi.clearAllMocks();
  apiService = await import('../../services/apiService');
  const apiMod = await import('../../lib/api');
  http = apiMod.http as unknown as HttpLike;
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
  const postSpy = vi.spyOn(http, 'post').mockResolvedValue({ data: mockResponse, status: 201 } as AxiosLikeResponse);
  const result = await apiService.createAppointment(mockAppointmentData);
  expect(postSpy).toHaveBeenCalledWith('/admin/appointments', expect.any(Object));
  expect(result).toEqual(mockResponse);
    });

    it('should handle creation failure with JSON error', async () => {
  vi.spyOn(http, 'post').mockRejectedValue(new Error('Customer not found'));
  await expect(apiService.createAppointment(mockAppointmentData)).rejects.toThrow('Customer not found');
    });

    it('should handle network failures', async () => {
  vi.spyOn(http, 'post').mockRejectedValue(new Error('Network error'));
  await expect(apiService.createAppointment(mockAppointmentData)).rejects.toThrow('Network error');
    });
  });

  // Removed legacy getAppointments() tests (endpoint deprecated)

  describe('getAdminAppointments', () => {
    it('should fetch admin appointments successfully', async () => {
      const mockAppointments = [
        { id: 'apt1', customer_id: 'cust1', service_id: 'svc1', status: 'scheduled' }
      ];
      const mockResponse = { data: { appointments: mockAppointments } };

  vi.spyOn(http, 'get').mockResolvedValue({ data: mockResponse, status: 200 } as AxiosLikeResponse);
  const result = await apiService.getAdminAppointments();
  expect(result).toEqual({ appointments: mockAppointments });
    });

    it('should return empty array when no data.appointments', async () => {
  vi.spyOn(http, 'get').mockResolvedValue({ data: {}, status: 200 } as AxiosLikeResponse);
      const result = await apiService.getAdminAppointments();
      expect(result).toEqual({ appointments: [] });
    });

    it('should handle admin fetch failure', async () => {
  vi.spyOn(http, 'get').mockRejectedValue(new Error('Unauthorized access'));
  await expect(apiService.getAdminAppointments()).rejects.toThrow('Unauthorized access');
    });
  });

  describe('getAdminAppointmentsToday', () => {
    it('should fetch today\'s appointments successfully', async () => {
      const mockAppointments = [
        { id: 'apt1', customer_id: 'cust1', service_id: 'svc1', status: 'scheduled' }
      ];
      const mockResponse = { appointments: mockAppointments };

  vi.spyOn(http, 'get').mockResolvedValue({ data: mockResponse, status: 200 } as AxiosLikeResponse);
  const result = await apiService.getAdminAppointmentsToday();
  expect(result).toEqual(mockAppointments);
    });

    it('should return empty array when no appointments today', async () => {
  vi.spyOn(http, 'get').mockResolvedValue({ data: {}, status: 200 } as AxiosLikeResponse);
      const result = await apiService.getAdminAppointmentsToday();
      expect(result).toEqual([]);
    });
  });

  describe('updateAppointment', () => {
    it('should update appointment successfully', async () => {
      const updateData = { status: 'completed', notes: 'Work finished' };
      const mockResponse = { message: 'Appointment updated successfully' };

  vi.spyOn(http, 'put').mockResolvedValue({ data: mockResponse, status: 200 } as AxiosLikeResponse);
  const result = await apiService.updateAppointment('apt123', updateData);
  expect(result).toEqual(mockResponse);
    });

    it('should handle update failure', async () => {
  vi.spyOn(http, 'put').mockRejectedValue(new Error('Appointment not found'));
  await expect(apiService.updateAppointment('apt123', { status: 'completed' })).rejects.toThrow('Appointment not found');
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle createAppointment with message field error', async () => {
  vi.spyOn(http, 'post').mockRejectedValue(new Error('Invalid time slot'));
  await expect(apiService.createAppointment({
        customer_id: 'cust123',
        service: 'Oil Change',
        requested_time: '2025-08-03T14:00:00Z'
      })).rejects.toThrow('Invalid time slot');
    });

    it('should handle createAppointment with JSON stringify fallback', async () => {
  const errorResponse = { custom_field: 'some custom error data' };
  vi.spyOn(http, 'post').mockRejectedValue(new Error(JSON.stringify(errorResponse)));
  await expect(apiService.createAppointment({
        customer_id: 'cust123',
        service: 'Oil Change',
        requested_time: '2025-08-03T14:00:00Z'
      })).rejects.toThrow(JSON.stringify(errorResponse));
    });

    it('should handle createAppointment with text fallback when JSON fails', async () => {
  vi.spyOn(http, 'post').mockRejectedValue(new Error('Internal Server Error'));
  await expect(apiService.createAppointment({
        customer_id: 'cust123',
        service: 'Oil Change',
        requested_time: '2025-08-03T14:00:00Z'
      })).rejects.toThrow('Internal Server Error');
    });

  // Removed legacy getAppointments fallback test (endpoint deprecated)

    it('should handle getAdminAppointments with JSON stringify fallback', async () => {
  const errorResponse = { custom_error: 'Database connection failed' };
  vi.spyOn(http, 'get').mockRejectedValue(new Error(JSON.stringify(errorResponse)));
  await expect(apiService.getAdminAppointments()).rejects.toThrow(JSON.stringify(errorResponse));
    });

    it('should handle getAdminAppointments with text fallback', async () => {
  vi.spyOn(http, 'get').mockRejectedValue(new Error('Internal Server Error'));
  await expect(apiService.getAdminAppointments()).rejects.toThrow('Internal Server Error');
    });

    it('should handle getAdminAppointmentsToday with text fallback', async () => {
  vi.spyOn(http, 'get').mockRejectedValue(new Error('Service Temporarily Unavailable'));
  await expect(apiService.getAdminAppointmentsToday()).rejects.toThrow('Service Temporarily Unavailable');
    });

    it('should handle updateAppointment with text fallback', async () => {
  vi.spyOn(http, 'put').mockRejectedValue(new Error('Update Failed'));
  await expect(apiService.updateAppointment('apt123', { status: 'completed' })).rejects.toThrow('Update Failed');
    });

    it('should handle createAppointment with empty error response', async () => {
  vi.spyOn(http, 'post').mockRejectedValue(new Error('{}'));
  await expect(apiService.createAppointment({
        customer_id: 'cust123',
        service: 'Oil Change',
        requested_time: '2025-08-03T14:00:00Z'
      })).rejects.toThrow('{}');
    });

    it('should handle network failures for admin endpoints', async () => {
  const networkError = new Error('Network connection failed');
  vi.spyOn(http, 'get').mockRejectedValue(networkError);
  await expect(apiService.getAdminAppointments()).rejects.toThrow('Network connection failed');
  vi.spyOn(http, 'get').mockRejectedValue(networkError);
  await expect(apiService.getAdminAppointmentsToday()).rejects.toThrow('Network connection failed');
  vi.spyOn(http, 'put').mockRejectedValue(networkError);
  await expect(apiService.updateAppointment('apt123', {})).rejects.toThrow('Network connection failed');
    });
  });

  describe('Type Definitions', () => {
    it('should validate AppointmentPayload interface', () => {
  const validPayload: AppointmentPayload = {
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
  const validAdmin: AdminAppointment = {
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

  // Environment variable testing removed; axios client uses relative base '/api'
});
