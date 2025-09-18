import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
/**
 * @typedef {Object} QuickAddModalProps
 * @property {boolean} isOpen
 * @property {() => void} onClose
 * @property {(data: any) => void} onSubmit
 * @property {boolean} [isSubmitting]
 * @property {string} [className]
 * @property {boolean} [_test_suppressAsyncEffects] - test-only flag to short-circuit async side effects
 */
// Import component only (TS interfaces are type-only and not emitted; avoid named import in .jsx)
// Legacy single ServiceOperationSelect removed; using ServiceCatalogModal for multi-select
import { ServiceCatalogModal } from '@/components/appointments/ServiceCatalogModal';
import { X, Calendar, User, Users, Car, Wrench, MapPin, Phone, Mail, Clock, Zap, ChevronRight, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import TemplateSelector from '../admin/TemplateSelector';
import ConflictWarning from '../admin/ConflictWarning';
import { getTemplates, applyTemplateToFormData } from '../../services/templateService';
import { getLastAppointmentSettings, createOneClickAppointment, saveLastAppointmentSettings } from '../../utils/shortcut';
import { buildQuickAddPayload } from './buildQuickAddPayload';
// Remove static import to fix bundle splitting - will use dynamic import for all api calls
import { getAvailableSlots, clearAvailabilityCache } from '../../services/availabilityService';
import { formatDate, getRelativeDate } from '../../utils/dateUtils';
import './QuickAddModal.css';
// Inventory catalog (shared with full scheduler)
// Using TS modules from JS is fine in Vite
import buildCatalogFromRaw from '@/data/vehicleCatalogFromRaw';

/**
 * QuickAddModal Component - Streamlined appointment creation
 * Implements T2 of Sprint 3A with comprehensive robustness framework
 *
 * Features:
 * - Smart defaults from last-used settings
 * - Template integration for quick service selection
 * - One-click scheduling with conflict detection
 * - Streamlined form with essential fields only
 * - Performance optimizations and accessibility
 */
/**
 * QuickAddModal
 * Test seam: `_test_suppressAsyncEffects` disables conflict + availability async effects
 * to allow deterministic, fast unit/integration tests without hanging on network/mock races.
 * This prop MUST NOT be used in production code paths.
 */
const QuickAddModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  className = '',
  _test_suppressAsyncEffects = false,
}) => {
  // ============ RENDER TRACKING ============
  console.log('🔄 QuickAddModal RENDER');

  // ============ STATE MANAGEMENT ============
  const emptyFormData = useCallback(() => ({
    // Customer
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    // Services (serviceType mirrors first selected service for legacy compatibility)
    serviceType: '',
    // Scheduling
    appointmentDate: '',
    appointmentTime: '',
    // Location / meta
    serviceAddress: '',
    notes: '',
    // Vehicle
    licensePlate: '',
    vehicleYear: '',
    vehicleMake: '',
    vehicleModel: '',
    // Flags
    quickAppointment: true
  }), []);

  const [formData, setFormData] = useState(emptyFormData());

  const [errors, setErrors] = useState({});
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [smartDefaults, setSmartDefaults] = useState({});
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isSlotLoading, setIsSlotLoading] = useState(false);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const firstInputRef = useRef(null);

  // ===== Derived data (vehicle catalog & times) =====
  const vehicleCatalog = useMemo(() => {
    try {
      const rawCatalog = buildCatalogFromRaw();
      // Transform array of makes into the expected structure
      const years = new Set();
      const makes = {};
      const models = {};

      rawCatalog.forEach(make => {
        makes[make.name] = true;
        models[make.name] = [];

        make.models.forEach(model => {
          models[make.name].push(model.name);

          // Add years to the set based on the model's range
          const startYear = model.startYear || 1990;
          const endYear = model.endYear || new Date().getFullYear();

          for (let year = startYear; year <= endYear; year++) {
            years.add(year);
          }
        });

        // Remove duplicates from models
        models[make.name] = [...new Set(models[make.name])];
      });

      return {
        years: Array.from(years).sort((a, b) => b - a), // Sort descending (newest first)
        makes: Object.keys(makes).sort(),
        models
      };
    } catch (error) {
      console.error('Error building vehicle catalog:', error);
      return { years: [], makes: [], models: {} };
    }
  }, []);
  const vehicleYears = vehicleCatalog.years || [];
  const makeOptions = vehicleCatalog.makes || [];
  const filteredModels = useMemo(() => vehicleCatalog.models?.[formData.vehicleMake] || [], [vehicleCatalog, formData.vehicleMake]);
  const timeSlots = useMemo(() => [
    '8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM',
    '11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM',
    '2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM'
  ], []);

  // Compute sanitizedClassName (prevent invalid characters)
  const sanitizedClassName = useMemo(() => (className || '').replace(/[^a-zA-Z0-9_\-\s]/g, ''), [className]);

  // ============ CUSTOMER LOOKUP (Phase 2 & 3) ============
  const [lookupStatus, setLookupStatus] = useState('idle'); // idle | loading | found | not_found | error | disambiguation
  const [lookupError, setLookupError] = useState('');
  const [lookupVehicles, setLookupVehicles] = useState([]); // Vehicles returned from lookup
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  // Phase 3: Customer disambiguation
  const [disambiguationCustomers, setDisambiguationCustomers] = useState([]); // Multiple customers found
  const [selectedCustomerId, setSelectedCustomerId] = useState(''); // Selected customer from disambiguation

  const lastLookupAppliedRef = useRef({ phone: '', name: '', email: '' });
  const userEditedRef = useRef({ name: false, email: false, vehicle: false });
  const activeLookupRef = useRef({ controller: null, requestId: 0 });

  const multiVehicleMode = lookupVehicles.length > 1;

  // ============ REFS FOR CLEANUP ============
  const cleanupFunctionsRef = useRef([]);
  const dialogRef = useRef(null);

  // ============ CONFLICT DETECTION ============
  // Conflict detection (skipped when test seam active)
  useEffect(() => {
    if (_test_suppressAsyncEffects) return; // test seam
    if (!formData.appointmentDate || !formData.appointmentTime) {
      setConflict(null);
      setOverrideConflict(false);
      return;
    }

    let timeoutId;
    const checkForConflicts = async () => {
      try {
        // Use dynamic import to prevent bundle splitting issues
        const { checkConflict } = await import('../../lib/api');
        const { conflict: hasConflict, conflictingAppointment } = await checkConflict({
          date: formData.appointmentDate,
          time: formData.appointmentTime,
        });
        setConflict(hasConflict ? conflictingAppointment : null);
        // Reset override when time changes
        if (hasConflict && !overrideConflict) {
          setOverrideConflict(false);
        }
      } catch (error) {
        console.warn('Error checking conflicts:', error);
        // Non-blocking error - don't prevent submission
      }
    };

    // Debounce conflict checking
    timeoutId = setTimeout(checkForConflicts, 500);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [formData.appointmentDate, formData.appointmentTime]);

  // ============ AVAILABILITY CHECK (Sprint 3B T1) ============
  // Availability fetch (skipped when test seam active)
  useEffect(() => {
    if (_test_suppressAsyncEffects) return; // test seam
    if (!isOpen || !formData.serviceType) return;

    let isMounted = true;

    const fetchAvailableSlots = async () => {
      setIsSlotLoading(true);
      try {
        const targetDate = formData.appointmentDate || new Date();
        const slots = await getAvailableSlots(formData.serviceType, targetDate, { maxSlots: 5 });

        if (isMounted) {
          setAvailableSlots(slots || []);
          setShowSlotPicker(slots && slots.length > 0);
        }
      } catch (error) {
        console.error('Error fetching available slots:', error);
        if (isMounted) {
          setErrors(prev => ({ ...prev, slots: 'Failed to load available slots' }));
        }
      } finally {
        if (isMounted) {
          setIsSlotLoading(false);
        }
      }
    };

    // Debounce slot fetching to avoid excessive API calls
    const timeoutId = setTimeout(fetchAvailableSlots, 300);

    return () => {
      clearTimeout(timeoutId);
      isMounted = false;
    };
  }, [isOpen, formData.serviceType, formData.appointmentDate]);

  // ============ SYNC SERVICE TYPE WITH SELECTED SERVICES ============
  useEffect(() => {
    // Keep formData.serviceType in sync with the first selected service
    const primaryService = selectedServices[0]?.name || '';
    if (formData.serviceType !== primaryService) {
      setFormData(prev => ({
        ...prev,
        serviceType: primaryService
      }));
    }
  }, [selectedServices, formData.serviceType]);

  // ============ KEYBOARD NAVIGATION ============
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // ============ EVENT HANDLERS ============
  const handleInputChange = useCallback((field, value) => {
    console.log('📝 handleInputChange called:', { field, value });

    // Security: Sanitize input value
    const sanitizedValue = typeof value === 'string'
      ? value.replace(/[<>]/g, '').slice(0, 500) // Limit length
      : value;

    console.log('📝 Setting formData:', { field, sanitizedValue });
    setFormData(prev => {
      const newFormData = { ...prev, [field]: sanitizedValue };
      console.log('📝 New formData state:', newFormData);
      return newFormData;
    });
    // Track user overrides after auto population so we don't clobber edits
    if (field === 'customerName') {
      if (sanitizedValue && sanitizedValue !== lastLookupAppliedRef.current.name) {
        userEditedRef.current.name = true;
      }
    }
    if (field === 'customerEmail') {
      if (sanitizedValue && sanitizedValue !== lastLookupAppliedRef.current.email) {
        userEditedRef.current.email = true;
      }
    }
    if (field === 'vehicleYear' || field === 'vehicleMake' || field === 'vehicleModel') {
      userEditedRef.current.vehicle = true;
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Phone specific: reset lookup states on change
    if (field === 'customerPhone') {
      console.log('📞 PHONE FIELD CHANGED! Resetting lookup states...');
      console.log('  📞 New phone value:', sanitizedValue);
      setLookupStatus('idle');
      setLookupError('');
      setLookupVehicles([]);
      setSelectedVehicleId('');
      if (activeLookupRef.current.controller) {
        try { activeLookupRef.current.controller.abort(); } catch (_) { /* noop */ }
      }
      // Clear auto-populated values ONLY if they came from previous lookup (avoid clearing manual input mid-typing)
      if (lastLookupAppliedRef.current.phone && !userEditedRef.current.name) {
        setFormData(prev => ({ ...prev, customerName: '' }));
      }
      if (lastLookupAppliedRef.current.phone && !userEditedRef.current.email) {
        setFormData(prev => ({ ...prev, customerEmail: '' }));
      }
      if (lastLookupAppliedRef.current.phone && !userEditedRef.current.vehicle) {
        setFormData(prev => ({
          ...prev,
          vehicleYear: '',
          vehicleMake: '',
          vehicleModel: '',
          // Phase 2: Clear vehicle IDs when phone changes
          selectedVehicleId: '',
          vehicleId: ''
        }));
      }
      lastLookupAppliedRef.current = { ...lastLookupAppliedRef.current, phone: '', name: '', email: '' };
    }
  }, [errors]);

  // Now that handleInputChange exists, finalize handleOperationChange
  // (Removed) handleOperationChange – no longer needed

  const handleTemplateSelect = useCallback(async (templateId) => {
    try {
      setSelectedTemplateId(templateId);

      if (templateId) {
  const updatedFormData = await applyTemplateToFormData(templateId, formData) || {};
  // Merge to preserve controlled fields (avoid undefined -> value warnings)
  setFormData(prev => ({ ...prev, ...updatedFormData }));
      }
    } catch (error) {
      console.error('Error applying template:', error);
      setErrors(prev => ({ ...prev, template: 'Failed to apply template' }));
    }
  }, [formData]);

  // Phase 3: Customer disambiguation handler
  const handleCustomerSelect = useCallback((customerId) => {
    console.log('🎯 handleCustomerSelect called:', { customerId, customerIdType: typeof customerId });
    console.log('👥 Available customers:', disambiguationCustomers);
    disambiguationCustomers.forEach((c, idx) => {
      console.log(`👤 Customer ${idx}:`, { id: c.id, type: typeof c.id, name: c.name, email: c.email });
    });

    console.log('🔍 Looking for customer ID:', { customerId, customerIdType: typeof customerId });

    // Compare as strings since customer IDs from API are strings
    const selectedCustomer = disambiguationCustomers.find(c => String(c.id) === String(customerId));
    console.log('👤 Found customer:', selectedCustomer);

    if (!selectedCustomer) {
      console.log('❌ Customer not found in disambiguation list');
      return;
    }

    console.log('✅ Customer selected, updating state...');
    setSelectedCustomerId(customerId);
    setLookupStatus('found');
    setDisambiguationCustomers([]);

    // Auto-populate fields from selected customer
    console.log('📝 Auto-populating fields from selected customer...');
    if (selectedCustomer.name && (!formData.customerName || !userEditedRef.current.name)) {
      console.log('📝 Setting customer name:', selectedCustomer.name);
      setFormData(prev => ({ ...prev, customerName: selectedCustomer.name }));
      lastLookupAppliedRef.current.name = selectedCustomer.name;
    }

    if (selectedCustomer.email && (!formData.customerEmail || !userEditedRef.current.email)) {
      console.log('📝 Setting customer email:', selectedCustomer.email);
      setFormData(prev => ({ ...prev, customerEmail: selectedCustomer.email }));
      lastLookupAppliedRef.current.email = selectedCustomer.email;
    }

    // Handle vehicles from selected customer
    const vehicles = selectedCustomer.vehicles || [];
    setLookupVehicles(vehicles);

    // Auto-populate vehicle if customer has exactly one vehicle and user hasn't edited
    if (vehicles.length === 1 && !userEditedRef.current.vehicle) {
      const vehicle = vehicles[0];
      setFormData(prev => ({
        ...prev,
        vehicleYear: String(vehicle.year || ''),
        vehicleMake: vehicle.make || '',
        vehicleModel: vehicle.model || '',
        licensePlate: vehicle.license_plate || prev.licensePlate,
        // Phase 2: Include vehicle ID for backend linkage
        selectedVehicleId: vehicle.id,
        vehicleId: vehicle.id
      }));
      setSelectedVehicleId(vehicle.id);
      userEditedRef.current.vehicle = false;
    } else if (vehicles.length > 1) {
      // Multiple vehicles - clear for user selection
      if (!userEditedRef.current.vehicle) {
        setFormData(prev => ({
          ...prev,
          vehicleYear: '',
          vehicleMake: '',
          vehicleModel: '',
          licensePlate: prev.licensePlate,
          // Clear vehicle IDs for multi-vehicle selection
          selectedVehicleId: '',
          vehicleId: ''
        }));
      }
      setSelectedVehicleId(''); // Reset selection for multi-vehicle dropdown
    }

    lastLookupAppliedRef.current.phone = formData.customerPhone;
  }, [disambiguationCustomers, formData.customerName, formData.customerEmail, formData.customerPhone]);

  // Manual search button handler - triggers customer lookup independently of useEffect
  const handleManualSearch = useCallback(async () => {
    console.log('🔍 Manual search triggered');

    const phoneValue = formData.customerPhone?.trim();
    if (!phoneValue) {
      console.log('❌ No phone number to search for');
      return;
    }

    // Extract digits from phone number for validation
    const digits = phoneValue.replace(/\D/g, '');
    if (digits.length < 7) {
      console.log('❌ Phone number too short for manual search:', digits.length, 'digits');
      setLookupError('Please enter a valid phone number (at least 7 digits)');
      return;
    }

    console.log('✅ Manual search: phone validation passed, starting lookup for:', phoneValue);

    // Clear previous states
    setLookupError('');
    setDisambiguationCustomers([]);
    setSelectedCustomerId('');
    setLookupVehicles([]);
    setLookupStatus('loading');

    try {
      console.log('🌐 Manual search API call params:', { phone: phoneValue });

      const response = await import('../../lib/api').then(m => m.http.get(`/customers/lookup`, {
        params: { phone: phoneValue }
      }));
      console.log('✅ Manual search API response:', response.status, response.data);

      if (response.status < 200 || response.status >= 300) {
        throw new Error('Lookup failed');
      }

      const apiResponse = response.data;
      console.log('🔍 Full manual search API response:', apiResponse);

      // Extract the actual customer data from nested structure
      const data = apiResponse.data || apiResponse;
      console.log('🔍 Extracted manual search customer data:', data);

      // Phase 3 API contract: { found: boolean, multiple_matches: boolean, customer: {...} | null, customers: [...] | undefined }
      const { found, multiple_matches, customer, customers } = data || {};

      console.log('🔍 Manual search destructured values:', { found, multiple_matches, customer, customers });

      if (found && multiple_matches && customers?.length > 0) {
        console.log('🔀 Manual search: Multiple customers found, showing disambiguation');
        setDisambiguationCustomers(customers);
        setLookupStatus('disambiguation');
      } else if (found && customer) {
        console.log('✅ Manual search: Single customer found');
        // Auto-populate with single customer (reuse existing logic from useEffect)
        setSelectedCustomerId(customer.id);
        setLookupStatus('found');

        if (customer.name && (!formData.customerName || !userEditedRef.current.name)) {
          setFormData(prev => ({ ...prev, customerName: customer.name }));
          lastLookupAppliedRef.current.name = customer.name;
        }
        if (customer.email && (!formData.customerEmail || !userEditedRef.current.email)) {
          setFormData(prev => ({ ...prev, customerEmail: customer.email }));
          lastLookupAppliedRef.current.email = customer.email;
        }

        const vehicles = customer.vehicles || [];
        setLookupVehicles(vehicles);
        if (vehicles.length === 1 && !userEditedRef.current.vehicle) {
          const vehicle = vehicles[0];
          setFormData(prev => ({
            ...prev,
            vehicleYear: String(vehicle.year || ''),
            vehicleMake: vehicle.make || '',
            vehicleModel: vehicle.model || '',
            licensePlate: vehicle.license_plate || prev.licensePlate,
            // Phase 2: Include vehicle ID for backend linkage
            selectedVehicleId: vehicle.id,
            vehicleId: vehicle.id
          }));
          setSelectedVehicleId(vehicle.id);
        }

        lastLookupAppliedRef.current.phone = phoneValue;
      } else {
        console.log('❌ Manual search: No customer found');
        setLookupStatus('not_found');
      }
    } catch (error) {
      console.error('❌ Manual search error:', error);
      setLookupError(error.message || 'Failed to search for customer. Please try again.');
      setLookupStatus('error');
    }
  }, [formData.customerPhone, formData.customerName, formData.customerEmail]);

  // Define validateForm before any callbacks that depend on it to avoid TDZ issues
  const validateForm = useCallback((dataToValidate = formData) => {
    const newErrors = {};

    // Required field validation
    if (!dataToValidate.customerName?.trim()) {
      newErrors.customerName = 'Customer name is required';
    }
    if (!dataToValidate.customerPhone?.trim()) {
      newErrors.customerPhone = 'Phone number is required';
    }
    if (!selectedServices.length) {
      newErrors.serviceType = 'At least one service is required';
    }
    if (!dataToValidate.appointmentDate) {
      newErrors.appointmentDate = 'Appointment date is required';
    }
    if (!dataToValidate.appointmentTime) {
      newErrors.appointmentTime = 'Appointment time is required';
    }

    // Basic vehicle validation (optional but recommended)
  // License plate no longer required (optional)
    if (!dataToValidate.vehicleMake?.trim()) {
      newErrors.vehicleMake = 'Vehicle make is required';
    }
    if (!dataToValidate.vehicleModel?.trim()) {
      newErrors.vehicleModel = 'Vehicle model is required';
    }
    if (!dataToValidate.vehicleYear?.trim()) {
      newErrors.vehicleYear = 'Vehicle year is required';
    }

    // Phone validation
    if (dataToValidate.customerPhone && !/^\+?[\d\s\-()]+$/.test(dataToValidate.customerPhone)) {
      newErrors.customerPhone = 'Please enter a valid phone number';
    }

    // Date validation (must be today or future)
    if (dataToValidate.appointmentDate) {
      const selectedDate = new Date(dataToValidate.appointmentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.appointmentDate = 'Appointment date must be today or in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, selectedServices]);

  const handleOneClickSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const base = createOneClickAppointment(formData);
      const oneClickData = buildQuickAddPayload(base, selectedServices);
      if (validateForm(oneClickData)) {
        await saveLastAppointmentSettings(oneClickData);
        onSubmit(oneClickData);
      } else {
        setErrors({ general: 'Unable to create quick appointment. Please fill required fields.' });
      }
    } catch (error) {
      console.error('Error creating one-click appointment:', error);
      setErrors({ general: 'Failed to create quick appointment' });
    } finally {
      setIsLoading(false);
    }
  }, [formData, onSubmit, selectedServices, validateForm]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      // Announce validation errors to screen readers
      const errorMessages = Object.values(errors).join('. ');
      if (errorMessages) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'assertive');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.textContent = `Form validation failed: ${errorMessages}`;
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }
      return;
    }

    if (conflict && !overrideConflict) {
      setErrors({ conflict: 'Please resolve the time conflict or click "Proceed Anyway" before submitting' });
      return;
    }

    try {
      setIsLoading(true);
      const payload = buildQuickAddPayload(formData, selectedServices);
      await saveLastAppointmentSettings(payload);
      onSubmit(payload);
    } catch (error) {
      console.error('Error submitting form:', error);
      setErrors({ general: 'Failed to submit appointment. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [formData, validateForm, conflict, onSubmit, errors]);

  const handleClose = useCallback(() => {
    // Reset full form (keep structure intact)
    setFormData(emptyFormData());
    setSelectedServices([]);
    setErrors({});
    setConflict(null);
    setSelectedTemplateId(null);
    onClose();
  // Reset lookup state
  setLookupStatus('idle');
  setLookupError('');
  setLookupVehicles([]);
  setSelectedVehicleId('');
  lastLookupAppliedRef.current = { phone: '', name: '' };
  userEditedRef.current = { name: false, vehicle: false };
  }, [onClose, emptyFormData]);

  // Focus trap to keep keyboard navigation within modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const list = Array.from(focusable).filter(el => !el.hasAttribute('disabled'));
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    dialogRef.current?.addEventListener('keydown', handleKeyDown);
    return () => dialogRef.current?.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Sprint 3B T1: Handle slot selection from suggested slots
  const handleSlotSelect = useCallback((slot) => {
    try {
      // Update both date and time from the selected slot
      const slotDate = new Date(slot.time);
      const dateString = slotDate.toISOString().split('T')[0];
      const timeString = slot.formatted;

      setFormData(prev => ({
        ...prev,
        appointmentDate: dateString,
        appointmentTime: timeString
      }));

      // Clear any existing errors
      setErrors(prev => ({
        ...prev,
        appointmentDate: '',
        appointmentTime: '',
        slots: ''
      }));

      // Hide slot picker after selection
      setShowSlotPicker(false);

    } catch (error) {
      console.error('Error selecting slot:', error);
      setErrors(prev => ({ ...prev, slots: 'Failed to select time slot' }));
    }
  }, []);

  // ============ RENDER CONDITIONS ============

  // ============ CUSTOMER LOOKUP EFFECT ============
  useEffect(() => {
    console.log('🔍 CUSTOMER LOOKUP useEffect TRIGGERED');
    console.log('  📞 formData.customerPhone:', formData.customerPhone);
    console.log('  📋 Full formData:', formData);

    const rawPhone = formData.customerPhone || '';
    const digits = rawPhone.replace(/[^0-9]/g, '');

    console.log('  🔢 Raw phone:', rawPhone);
    console.log('  🔢 Digits only:', digits);
    console.log('  📏 Digits length:', digits.length);

    if (!rawPhone || digits.length < 7) { // avoid spamming short or empty inputs
      console.log('  ❌ EARLY RETURN: Phone too short or empty');
      return; // status already reset in change handler
    }

    console.log('  ✅ Phone validation passed, starting lookup...');
    setLookupStatus('loading');
    setLookupError('');
    const controller = new AbortController();
    const requestId = (activeLookupRef.current.requestId || 0) + 1;
    activeLookupRef.current = { controller, requestId };
    const debounceTimer = setTimeout(async () => {
      try {
        console.log('  ⏱️ Debounce timer fired, making API call...');
        console.log('  🌐 API call params:', { phone: rawPhone });

        const resp = await import('../../lib/api').then(m => m.http.get(`/customers/lookup`, {
          params: { phone: rawPhone },
          signal: controller.signal
        }));

        console.log('  ✅ API response received:', resp.status, resp.data);

        if (activeLookupRef.current.requestId !== requestId) {
          return; // stale request
        }

        if (resp.status < 200 || resp.status >= 300) {
          setLookupStatus('error');
          setLookupError('Lookup failed');
          return;
        }

        const apiResponse = resp.data;
        console.log('  🔍 Full API response:', apiResponse);

        // Extract the actual customer data from nested structure
        const data = apiResponse.data || apiResponse;
        console.log('  🔍 Extracted customer data:', data);

        // Phase 3 API contract: { found: boolean, multiple_matches: boolean, customer: {...} | null, customers: [...] | undefined }
        const { found, multiple_matches, customer, customers } = data || {};

        console.log('  🔍 Destructured values:', { found, multiple_matches, customer, customers });

        if (!found) {
          console.log('  ❌ No customer found for phone number');

          setLookupStatus('not_found');
          setLookupVehicles([]);
          setDisambiguationCustomers([]);
          // Clear auto fields if they were populated by a previous lookup and user hasn't edited
          if (!userEditedRef.current.name) {
            setFormData(prev => ({ ...prev, customerName: '' }));
          }
          if (!userEditedRef.current.email) {
            setFormData(prev => ({ ...prev, customerEmail: '' }));
          }
          if (!userEditedRef.current.vehicle) {
            setFormData(prev => ({ ...prev, vehicleYear: '', vehicleMake: '', vehicleModel: '' }));
          }
          lastLookupAppliedRef.current = { phone: rawPhone, name: '', email: '' };
          return;
        }

        // Phase 3: Handle multiple customers (disambiguation)
        if (multiple_matches && customers && customers.length > 1) {
          console.log('  🔀 Multiple customers found, showing disambiguation UI');
          console.log('  👥 Customers for disambiguation:', customers);
          setLookupStatus('disambiguation');
          setDisambiguationCustomers(customers);
          setLookupVehicles([]);
          setSelectedCustomerId('');
          // Clear auto fields during disambiguation
          if (!userEditedRef.current.name) {
            setFormData(prev => ({ ...prev, customerName: '' }));
          }
          if (!userEditedRef.current.email) {
            setFormData(prev => ({ ...prev, customerEmail: '' }));
          }
          if (!userEditedRef.current.vehicle) {
            setFormData(prev => ({ ...prev, vehicleYear: '', vehicleMake: '', vehicleModel: '' }));
          }
          lastLookupAppliedRef.current = { phone: rawPhone, name: '', email: '' };
          return;
        }

        // Single customer found - auto-populate fields
        console.log('  ✅ Single customer found, auto-populating fields');
        console.log('  👤 Customer data:', customer);
        setLookupStatus('found');
        setDisambiguationCustomers([]);

        // Auto-populate name if blank or previously auto-populated (not user edited)
        if (customer?.name && (!formData.customerName || !userEditedRef.current.name)) {
          console.log('  📝 Auto-populating customer name:', customer.name);
          setFormData(prev => ({ ...prev, customerName: customer.name }));
          lastLookupAppliedRef.current.name = customer.name;
        }

        // Auto-populate email if blank or previously auto-populated (not user edited)
        if (customer?.email && (!formData.customerEmail || !userEditedRef.current.email)) {
          setFormData(prev => ({ ...prev, customerEmail: customer.email }));
          lastLookupAppliedRef.current.email = customer.email;
        }

        lastLookupAppliedRef.current.phone = rawPhone;

        // Phase 2: Handle vehicles from enhanced API
        const vehicles = customer?.vehicles || [];
        setLookupVehicles(vehicles);

        // Auto-populate vehicle if customer has exactly one vehicle and user hasn't edited
        if (vehicles.length === 1 && !userEditedRef.current.vehicle) {
          const vehicle = vehicles[0];
          setFormData(prev => ({
            ...prev,
            vehicleYear: String(vehicle.year || ''),
            vehicleMake: vehicle.make || '',
            vehicleModel: vehicle.model || '',
            licensePlate: vehicle.license_plate || prev.licensePlate,
            // Phase 2: Include vehicle ID for backend linkage
            selectedVehicleId: vehicle.id,
            vehicleId: vehicle.id
          }));
          setSelectedVehicleId(vehicle.id);
          // Mark as auto-populated, not user-edited
          userEditedRef.current.vehicle = false;
        } else if (vehicles.length > 1) {
          // Multiple vehicles - user will select from dropdown
          // Clear any existing auto-populated vehicle data unless user has edited
          if (!userEditedRef.current.vehicle) {
            setFormData(prev => ({
              ...prev,
              vehicleYear: '',
              vehicleMake: '',
              vehicleModel: '',
              licensePlate: prev.licensePlate, // Keep license plate as it might be manually entered
              // Clear vehicle IDs for multi-vehicle selection
              selectedVehicleId: '',
              vehicleId: ''
            }));
          }
          setSelectedVehicleId(''); // Reset selection for multi-vehicle dropdown
        }

      } catch (err) {
        if (err?.name === 'AbortError') return;
        setLookupStatus('error');
        setLookupError('Lookup failed');
      }
    }, 500); // debounce 500ms as per PRD

    return () => {
      clearTimeout(debounceTimer);
      try { controller.abort(); } catch (_) { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.customerPhone]);

  // ============ VEHICLE SELECTION FROM MULTI ============
  const handleSelectLookupVehicle = useCallback((vehicleId) => {
    setSelectedVehicleId(vehicleId);
    const v = lookupVehicles.find(vv => vv.id === vehicleId);
    if (v) {
      setFormData(prev => ({
        ...prev,
        vehicleYear: String(v.year || ''),
        vehicleMake: v.make || '',
        vehicleModel: v.model || '',
        licensePlate: v.license_plate || prev.licensePlate,
        // Phase 2: Include vehicle ID for backend linkage
        selectedVehicleId: vehicleId,
        vehicleId: vehicleId // Alternative field name for compatibility
      }));
      userEditedRef.current.vehicle = false;
    } else if (!vehicleId) {
      // Clear vehicle ID when "Choose from vehicles..." option is selected
      setFormData(prev => ({
        ...prev,
        selectedVehicleId: '',
        vehicleId: ''
      }));
    }
  }, [lookupVehicles]);

  const renderVehicleSection = () => {
    if (multiVehicleMode) {
      return (
        <div className="quick-add-field" data-testid="lookup-multi-vehicle">
          <label htmlFor="lookup-vehicle-select" className="quick-add-label flex items-center gap-2">
            <Car className="h-4 w-4" aria-hidden="true" />
            Vehicle *
          </label>
          <select
            id="lookup-vehicle-select"
            value={selectedVehicleId}
            onChange={(e) => handleSelectLookupVehicle(e.target.value)}
            className="quick-add-input"
            required
          >
            <option value="">Choose from {lookupVehicles.length} vehicles...</option>
            {lookupVehicles.map(v => (
              <option key={v.id} value={v.id}>
                {`${v.year || ''} ${v.make || ''} ${v.model || ''}${v.license_plate ? ' • ' + v.license_plate : ''}${v.vin ? ' • VIN: ' + v.vin.slice(-6) : ''}`.trim()}
              </option>
            ))}
          </select>
          <div className="quick-add-hint text-blue-600 flex items-center gap-1">
            <Users className="h-4 w-4" aria-hidden="true" />
            Multiple vehicles found. Select the one for this appointment.
          </div>
          {selectedVehicleId && (
            <div className="quick-add-hint text-green-600 flex items-center gap-1">
              <Check className="h-4 w-4" aria-hidden="true" />
              Vehicle selected from customer records
            </div>
          )}
        </div>
      );
    }
    // Fallback to original trio selects
    return (
      <div className="quick-add-field-group" data-testid="vehicle-trio">
        <div className="quick-add-field">
          <label htmlFor="vehicle-year" className="quick-add-label">Year *</label>
          <select
            id="vehicle-year"
            value={formData.vehicleYear}
            onChange={(e) => handleInputChange('vehicleYear', e.target.value)}
            className={`quick-add-input ${errors.vehicleYear ? 'error' : ''}`}
            required
          >
            <option value="">Select year</option>
            {vehicleYears.map((y) => (<option key={y} value={y}>{y}</option>))}
            {/* Ensure auto-populated year is selectable even if not in static catalog */}
            {!vehicleYears.includes(formData.vehicleYear) && formData.vehicleYear && (
              <option value={formData.vehicleYear}>{formData.vehicleYear}</option>
            )}
          </select>
          {errors.vehicleYear && (<div className="quick-add-error" role="alert">{errors.vehicleYear}</div>)}
        </div>
        <div className="quick-add-field">
          <label htmlFor="vehicle-make" className="quick-add-label">Make *</label>
          <select
            id="vehicle-make"
            value={formData.vehicleMake}
            onChange={(e) => { handleInputChange('vehicleMake', e.target.value); handleInputChange('vehicleModel', ''); }}
            className={`quick-add-input ${errors.vehicleMake ? 'error' : ''}`}
            required
          >
            <option value="">Select make</option>
            {makeOptions.map((m) => (<option key={m} value={m}>{m}</option>))}
            {/* Fallback option for auto-populated make not present in static catalog */}
            {formData.vehicleMake && !makeOptions.includes(formData.vehicleMake) && (
              <option value={formData.vehicleMake}>{formData.vehicleMake}</option>
            )}
          </select>
          {errors.vehicleMake && (<div className="quick-add-error" role="alert">{errors.vehicleMake}</div>)}
        </div>
        <div className="quick-add-field">
          <label htmlFor="vehicle-model" className="quick-add-label">Model *</label>
          <select
            id="vehicle-model"
            value={formData.vehicleModel}
            onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
            className={`quick-add-input ${errors.vehicleModel ? 'error' : ''}`}
            required
            disabled={!formData.vehicleMake}
          >
            <option value="">{formData.vehicleMake ? 'Select model' : 'Select make first'}</option>
            {filteredModels.map((m) => (<option key={m} value={m}>{m}</option>))}
            {/* Fallback option for auto-populated model if not in filteredModels */}
            {formData.vehicleModel && !filteredModels.includes(formData.vehicleModel) && (
              <option value={formData.vehicleModel}>{formData.vehicleModel}</option>
            )}
          </select>
          {errors.vehicleModel && (<div className="quick-add-error" role="alert">{errors.vehicleModel}</div>)}
        </div>
        {/* Show hint when single vehicle was auto-populated */}
        {lookupStatus === 'found' && lookupVehicles.length === 1 && !multiVehicleMode && (
          <div className="quick-add-hint text-green-600 flex items-center gap-1" data-testid="single-vehicle-auto-populated">
            <Check className="h-4 w-4" aria-hidden="true" />
            Vehicle auto-populated from customer records
          </div>
        )}
        {/* Show hint for new customer/no vehicles scenario */}
        {lookupStatus === 'not_found' && (
          <div className="quick-add-hint text-blue-600 flex items-center gap-1" data-testid="new-customer-manual-entry">
            <Car className="h-4 w-4" aria-hidden="true" />
            New customer - enter vehicle details manually
          </div>
        )}
        {/* Show hint when customer found but no vehicles */}
        {lookupStatus === 'found' && lookupVehicles.length === 0 && (
          <div className="quick-add-hint text-orange-600 flex items-center gap-1" data-testid="customer-no-vehicles">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Customer found - no vehicles on record, enter details manually
          </div>
        )}
      </div>
    );
  };
  if (!isOpen) return null;

  return (
    <div
      className="quick-add-modal-overlay"
      data-testid="quick-add-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`quick-add-modal-content ${sanitizedClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============ HEADER ============ */}
        <div className="quick-add-modal-header">
          <h2 id="quick-add-title" className="quick-add-modal-title">
            <Zap className="h-6 w-6" aria-hidden="true" />
            Quick Add Appointment
          </h2>
          <button
            onClick={handleClose}
            className="quick-add-modal-close"
            aria-label="Close quick add modal"
            disabled={isSubmitting}
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* ============ LOADING STATE ============ */}
        {isLoading && (
          <div className="quick-add-modal-loading" aria-live="polite">
            <div className="quick-add-spinner" aria-hidden="true"></div>
            <span>Loading...</span>
          </div>
        )}

        {/* ============ FORM CONTENT ============ */}
        <form onSubmit={handleSubmit} className="quick-add-modal-form">
          {/* Template Selector */}
          <div className="quick-add-section">
            <h3 className="quick-add-section-title">
              <Wrench className="h-5 w-5" aria-hidden="true" />
              Quick Templates
            </h3>
            <TemplateSelector
              templates={templates}
              onSelect={handleTemplateSelect}
              selectedTemplateId={selectedTemplateId}
              compact={true}
            />
          </div>

          {/* Essential Fields */}
          <div className="quick-add-fields">
            {/* Customer Phone - PHONE-FIRST: Primary field at the top */}
            <div className="quick-add-field">
              <label htmlFor="customer-phone" className="quick-add-label flex items-center gap-2">
                <span className="flex items-center gap-1"><Phone className="h-4 w-4" aria-hidden="true" /> Phone Number *</span>
                {lookupStatus === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" aria-label="Looking up" />}
              </label>
              <div className="flex gap-2 items-center">
                <input
                  id="customer-phone"
                  ref={firstInputRef}
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                  className={`quick-add-input flex-1 ${
                    errors.customerPhone ? 'error' :
                    lookupStatus === 'loading' ? 'border-blue-400 ring-blue-200' :
                    lookupStatus === 'found' ? 'border-green-500 ring-green-200' :
                    lookupStatus === 'not_found' ? 'border-yellow-500 ring-yellow-200' :
                    lookupStatus === 'error' ? 'border-red-500 ring-red-200' :
                    lookupStatus === 'disambiguation' ? 'border-blue-400 ring-blue-200' :
                    ''
                  }`}
                  placeholder="(555) 123-4567"
                  required
                  aria-describedby={errors.customerPhone ? 'customer-phone-error' : undefined}
                  data-testid="customer-phone-input"
                />
                <button
                  type="button"
                  onClick={handleManualSearch}
                  disabled={lookupStatus === 'loading' || !formData.customerPhone?.trim()}
                  className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors duration-200 ${
                    lookupStatus === 'loading' || !formData.customerPhone?.trim()
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
                  }`}
                  title={
                    !formData.customerPhone?.trim()
                      ? 'Enter a phone number first'
                      : lookupStatus === 'loading'
                        ? 'Lookup in progress...'
                        : 'Search for customer manually'
                  }
                  data-testid="manual-search-button"
                >
                  {lookupStatus === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      Search
                    </span>
                  )}
                </button>
              </div>

              {/* Lookup Status Messages */}
              {lookupStatus === 'loading' && (
                <div className="text-blue-600 text-sm mt-1 flex items-center gap-1" role="status" aria-live="polite">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Searching for customer...
                </div>
              )}
              {lookupStatus === 'found' && (
                <div className="text-green-600 text-sm mt-1 flex items-center gap-1" role="status" aria-live="polite">
                  <Check className="h-3 w-3" />
                  Customer found! Information loaded.
                </div>
              )}
              {lookupStatus === 'not_found' && (
                <div className="text-yellow-600 text-sm mt-1 flex items-center gap-1" role="status" aria-live="polite">
                  <AlertTriangle className="h-3 w-3" />
                  No customer found. Creating new customer.
                </div>
              )}
              {lookupStatus === 'disambiguation' && (
                <div className="text-blue-600 text-sm mt-1 flex items-center gap-1" role="status" aria-live="polite">
                  <Users className="h-3 w-3" />
                  Multiple customers found. Please select one below.
                </div>
              )}

              {errors.customerPhone && (
                <div id="customer-phone-error" className="quick-add-error" role="alert">
                  {errors.customerPhone}
                </div>
              )}
              {lookupError && <div className="quick-add-error" role="alert">{lookupError}</div>}
            </div>

            {/* Customer Name */}
            <div className="quick-add-field">
              <label htmlFor="customer-name" className="quick-add-label">
                <User className="h-4 w-4" aria-hidden="true" />
                Customer Name *
              </label>
              <input
                id="customer-name"
                type="text"
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                className={`quick-add-input ${errors.customerName ? 'error' : ''}`}
                placeholder="Enter customer name"
                required
                aria-describedby={errors.customerName ? 'customer-name-error' : undefined}
              />
              {errors.customerName && (
                <div id="customer-name-error" className="quick-add-error" role="alert">
                  {errors.customerName}
                </div>
              )}
            </div>

            {/* Customer Email */}
            <div className="quick-add-field">
              <label htmlFor="customer-email" className="quick-add-label flex items-center gap-2">
                <span className="flex items-center gap-1"><Mail className="h-4 w-4" aria-hidden="true" /> Email</span>
                {lookupStatus === 'found' && <span className="text-green-600 text-xs bg-green-100 px-2 py-0.5 rounded-full" data-testid="returning-customer">Returning Customer</span>}
              </label>
              <input
                id="customer-email"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                className={`quick-add-input ${errors.customerEmail ? 'error' : ''}`}
                placeholder="Enter customer email"
                aria-describedby={errors.customerEmail ? 'customer-email-error' : undefined}
              />
              {errors.customerEmail && (
                <div id="customer-email-error" className="quick-add-error" role="alert">
                  {errors.customerEmail}
                </div>
              )}
            </div>

            {/* License Plate - moved after customer fields */}
            <div className="quick-add-field">
              <label htmlFor="license-plate" className="quick-add-label">
                <Car className="h-4 w-4" aria-hidden="true" />
                License Plate (optional)
              </label>
              <input
                id="license-plate"
                type="text"
                value={formData.licensePlate}
                onChange={(e) => handleInputChange('licensePlate', e.target.value.toUpperCase())}
                className={`quick-add-input`}
                placeholder="ABC1234"
              />
            </div>

            {/* Vehicle Section - moved after license plate */}
            {renderVehicleSection()}

            {/* Phase 3: Customer Disambiguation */}
            {lookupStatus === 'disambiguation' && disambiguationCustomers.length > 0 && (
              <div className="quick-add-field">
                <label className="quick-add-label flex items-center gap-2">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Multiple Customers Found *
                </label>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  We found {disambiguationCustomers.length} customers with this phone number. Please select one:
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {disambiguationCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleCustomerSelect(customer.id)}
                      className={`w-full text-left p-3 border rounded-lg transition-colors
                        ${selectedCustomerId === customer.id.toString()
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 bg-white dark:bg-slate-800'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {customer.name}
                          </div>
                          {customer.email && (
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {customer.email}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                          {customer.vehicle_count > 0 ? (
                            <div>{customer.vehicle_count} vehicle{customer.vehicle_count !== 1 ? 's' : ''}</div>
                          ) : (
                            <div>No vehicles</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Services Multi-Select (ServiceCatalogModal integration) */}
            <div className="quick-add-field">
              <div className="flex items-center gap-1 mb-2">
                <Wrench className="h-4 w-4" aria-hidden="true" />
                <span className="quick-add-label">Services *</span>
              </div>
              {selectedServices.length > 0 && (
                <ul className="mb-3 flex flex-wrap gap-2" data-testid="quickadd-selected-services">
                  {selectedServices.map(s => (
                    <li
                      key={s.id}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs border
                                 bg-blue-50 border-blue-200 text-slate-800
                                 dark:bg-slate-600/40 dark:border-slate-500 dark:text-slate-100
                                 shadow-sm"
                    >
                      <span className="font-medium truncate max-w-[12rem]" title={s.name}>{s.name}</span>
                      {s.defaultPrice != null && (
                        <span className="text-slate-600 dark:text-slate-300">${s.defaultPrice.toFixed(2)}</span>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${s.name}`}
                        className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full
                                   text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300
                                   focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 focus:ring-offset-white dark:focus:ring-offset-slate-800"
                        onClick={() => setSelectedServices(prev => prev.filter(p => p.id !== s.id))}
                      >
                        <span className="leading-none text-[11px]">×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowServiceModal(true)}
                disabled={isLoading || isSubmitting}
                data-testid="quickadd-add-service-btn"
              >
                {selectedServices.length ? 'Add / Edit Services' : 'Add Services'}
              </Button>
              {errors.serviceType && (
                <div id="service-type-error" className="quick-add-error mt-2" role="alert">
                  {errors.serviceType}
                </div>
              )}
            </div>

            {/* Date and Time */}
            <div className="quick-add-field-group">
              <div className="quick-add-field">
                <label htmlFor="appointment-date" className="quick-add-label">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  Date *
                </label>
                <input
                  id="appointment-date"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.appointmentDate}
                  onChange={(e) => handleInputChange('appointmentDate', e.target.value)}
                  className={`quick-add-input ${errors.appointmentDate ? 'error' : ''}`}
                  required
                  aria-describedby={errors.appointmentDate ? 'appointment-date-error' : undefined}
                />
                {errors.appointmentDate && (
                  <div id="appointment-date-error" className="quick-add-error" role="alert">
                    {errors.appointmentDate}
                  </div>
                )}
              </div>

              <div className="quick-add-field">
                <label htmlFor="appointment-time" className="quick-add-label">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Time *
                </label>
                <div className="relative">
                  <select
                    id="appointment-time"
                    value={formData.appointmentTime}
                    onChange={(e) => handleInputChange('appointmentTime', e.target.value)}
                    className={`quick-add-input ${errors.appointmentTime ? 'error' : ''}`}
                    required
                    aria-describedby={errors.appointmentTime ? 'appointment-time-error' : undefined}
                  >
                    <option value="">Select time</option>
                    {timeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  {isSlotLoading && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    </div>
                  )}
                </div>
                {errors.appointmentTime && (
                  <div id="appointment-time-error" className="quick-add-error" role="alert">
                    {errors.appointmentTime}
                  </div>
                )}
              </div>
            </div>

            {/* Service Address */}
            <div className="quick-add-field">
              <label htmlFor="service-address" className="quick-add-label">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Service Address
              </label>
              <input
                id="service-address"
                type="text"
                value={formData.serviceAddress}
                onChange={(e) => handleInputChange('serviceAddress', e.target.value)}
                className="quick-add-input"
                placeholder="Customer location (optional)"
              />
            </div>

            {/* Notes */}
            <div className="quick-add-field">
              <label htmlFor="notes" className="quick-add-label">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="quick-add-input quick-add-textarea"
                placeholder="Additional notes (optional)"
                rows={2}
              />
            </div>
          </div>

          {/* Available Time Slots - Sprint 3B T1 */}
          {selectedServices.length > 0 && (
            <div className="quick-add-section">
              <h3 className="quick-add-section-title">
                <Clock className="h-5 w-5" aria-hidden="true" />
                Available Time Slots
                {isSlotLoading && <div className="quick-add-spinner-small" aria-hidden="true"></div>}
              </h3>

      {isSlotLoading ? (
                <div className="quick-add-slots-loading">
                  <span>Finding available slots...</span>
                </div>
              ) : availableSlots.length > 0 ? (
                <div className="quick-add-slots-container">
                  <p className="quick-add-slots-description">
        Select from available time slots for {formData.serviceType || selectedServices[0]?.name}:
                  </p>
                  <div className="quick-add-slots-grid">
                    {availableSlots.map((slot, index) => (
                      <button
                        key={index}
                        onClick={() => handleSlotSelect(slot)}
                        className={`quick-add-slot-button ${
                          formData.appointmentTime === slot.formatted ? 'selected' : ''
                        } ${!slot.available ? 'disabled' : ''}`}
                        type="button"
                        disabled={!slot.available}
                        aria-pressed={formData.appointmentTime === slot.formatted}
                        title={slot.available ? `Available at ${slot.formatted}` : slot.conflictReason}
                      >
                        <div className="quick-add-slot-time">{slot.formatted}</div>
                        <div className="quick-add-slot-date">{formatDate(slot.time, 'short')}</div>
                        {!slot.available && (
                          <div className="quick-add-slot-conflict">Unavailable</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
        ) : selectedServices.length ? (
                <div className="quick-add-slots-empty">
          <p>No available slots found for {formData.serviceType || selectedServices[0]?.name}</p>
                  <p className="quick-add-slots-empty-hint">
                    Try selecting a different date or service type
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* Conflict Warning - Sprint 3B T2 */}
          {conflict && !overrideConflict && (
            <ConflictWarning
              conflictingAppointment={conflict}
              onOverride={() => setOverrideConflict(true)}
            />
          )}

          {/* Override Confirmation */}
          {conflict && overrideConflict && (
            <div className="quick-add-override-notice" role="alert">
              <div className="quick-add-override-icon">✓</div>
              <div>
                <strong>Conflict Override Enabled</strong>
                <p>This appointment will be scheduled despite the time conflict.</p>
                <button
                  type="button"
                  onClick={() => setOverrideConflict(false)}
                  className="quick-add-override-cancel"
                >
                  Cancel Override
                </button>
              </div>
            </div>
          )}

          {/* General Errors */}
          {errors.general && (
            <div className="quick-add-error quick-add-error-general" role="alert">
              {errors.general}
            </div>
          )}

          {/* Action Buttons */}
          <div className="quick-add-actions">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting || isLoading}
              className="quick-add-button-secondary"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleOneClickSchedule}
              disabled={isSubmitting || isLoading || !formData.customerName || !selectedServices.length}
              className="quick-add-button-one-click"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              One-Click Schedule
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || isLoading || (conflict && !overrideConflict)}
              className="quick-add-button-primary"
            >
              {isSubmitting ? (
                <>
                  <div className="quick-add-spinner-small" aria-hidden="true"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {conflict && overrideConflict ? 'Schedule Anyway' : 'Schedule Appointment'}
                </>
              )}
            </Button>
          </div>
        </form>
        {/* Service Catalog Modal */}
        <ServiceCatalogModal
          open={showServiceModal}
          defaultExpandAll
          onAdd={(op) => {
            // immediate chip add for legacy behavior while still allowing batch confirm
            setSelectedServices(prev => prev.find(s=>s.id===op.id)? prev : [...prev, { id: op.id, name: op.name, defaultPrice: op.base_labor_rate }]);
          }}
          onConfirm={(list) => {
            setSelectedServices(prev => {
              const map = new Map(prev.map(s=>[s.id,s]));
              list.forEach(s=>{ if(!map.has(s.id)) map.set(s.id, { id: s.id, name: s.name, defaultPrice: s.base_labor_rate }); });
              return Array.from(map.values());
            });
          }}
          onClose={() => setShowServiceModal(false)}
        />
      </div>
    </div>
  );
};

export default QuickAddModal;
