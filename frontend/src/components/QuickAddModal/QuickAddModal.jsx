import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Calendar, User, Car, Wrench, MapPin, Phone, Mail, Clock, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import TemplateSelector from '../admin/TemplateSelector';
import { getTemplates, applyTemplateToFormData } from '../../services/templateService';
import { getLastAppointmentSettings, createOneClickAppointment, saveLastAppointmentSettings } from '../../utils/shortcut';
import { checkConflict } from '../../lib/api';
import './QuickAddModal.css';

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
const QuickAddModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isSubmitting = false,
  className = '' 
}) => {
  // ============ STATE MANAGEMENT ============
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    serviceType: '',
    appointmentDate: '',
    appointmentTime: '',
    serviceAddress: '',
    notes: '',
    quickAppointment: true
  });

  const [errors, setErrors] = useState({});
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [smartDefaults, setSmartDefaults] = useState({});

  // ============ REFS FOR CLEANUP ============
  const cleanupFunctionsRef = useRef([]);
  const dialogRef = useRef(null);
  const firstInputRef = useRef(null);

  // ============ MEMOIZED VALUES ============
  const sanitizedClassName = useMemo(() => {
    // Security: Sanitize className to prevent XSS
    if (typeof className !== 'string') return '';
    return className.replace(/[<>]/g, '').trim();
  }, [className]);

  const timeSlots = useMemo(() => [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM',
    '4:00 PM', '5:00 PM'
  ], []);

  const serviceTypes = useMemo(() => [
    'Oil Change',
    'Brake Service',
    'Tire Rotation',
    'Engine Diagnostics',
    'Battery Replacement',
    'Emergency Repair'
  ], []);

  // ============ INITIALIZATION AND CLEANUP ============
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const initializeModal = async () => {
      setIsLoading(true);
      try {
        // Load templates and smart defaults in parallel
        const [fetchedTemplates, lastSettings] = await Promise.all([
          getTemplates(),
          Promise.resolve(getLastAppointmentSettings())
        ]);

        if (!isMounted) return;

        setTemplates(fetchedTemplates || []);
        setSmartDefaults(lastSettings || {});

        // Apply smart defaults to form
        const defaultFormData = {
          customerName: lastSettings.customerName || '',
          customerPhone: lastSettings.customerPhone || '',
          serviceType: lastSettings.serviceType || 'Oil Change',
          appointmentDate: new Date().toISOString().split('T')[0],
          appointmentTime: lastSettings.appointmentTime || '10:00 AM',
          serviceAddress: lastSettings.serviceAddress || '',
          notes: '',
          quickAppointment: true
        };

        setFormData(defaultFormData);

        // Focus management for accessibility
        setTimeout(() => {
          if (firstInputRef.current && isMounted) {
            firstInputRef.current.focus();
          }
        }, 100);

      } catch (error) {
        console.error('Error initializing QuickAddModal:', error);
        if (isMounted) {
          setErrors({ general: 'Failed to load modal. Please try again.' });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeModal();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // ============ CONFLICT DETECTION ============
  useEffect(() => {
    if (!formData.appointmentDate || !formData.appointmentTime) {
      setConflict(null);
      return;
    }

    let timeoutId;
    const checkForConflicts = async () => {
      try {
        const { conflict: hasConflict, conflictingAppointment } = await checkConflict({
          date: formData.appointmentDate,
          time: formData.appointmentTime,
        });
        setConflict(hasConflict ? conflictingAppointment : null);
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
    // Security: Sanitize input value
    const sanitizedValue = typeof value === 'string' 
      ? value.replace(/[<>]/g, '').slice(0, 500) // Limit length
      : value;

    setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const handleTemplateSelect = useCallback(async (templateId) => {
    try {
      setSelectedTemplateId(templateId);
      
      if (templateId) {
        const updatedFormData = await applyTemplateToFormData(templateId, formData);
        setFormData(updatedFormData);
      }
    } catch (error) {
      console.error('Error applying template:', error);
      setErrors(prev => ({ ...prev, template: 'Failed to apply template' }));
    }
  }, [formData]);

  const handleOneClickSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const oneClickData = createOneClickAppointment(formData);
      
      // Validate the generated data
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
  }, [formData, onSubmit]);

  const validateForm = useCallback((dataToValidate = formData) => {
    const newErrors = {};

    // Required field validation
    if (!dataToValidate.customerName?.trim()) {
      newErrors.customerName = 'Customer name is required';
    }
    if (!dataToValidate.customerPhone?.trim()) {
      newErrors.customerPhone = 'Phone number is required';
    }
    if (!dataToValidate.serviceType) {
      newErrors.serviceType = 'Service type is required';
    }
    if (!dataToValidate.appointmentDate) {
      newErrors.appointmentDate = 'Appointment date is required';
    }
    if (!dataToValidate.appointmentTime) {
      newErrors.appointmentTime = 'Appointment time is required';
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
  }, [formData]);

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

    if (conflict) {
      setErrors({ conflict: 'Please resolve the time conflict before submitting' });
      return;
    }

    try {
      setIsLoading(true);
      await saveLastAppointmentSettings(formData);
      onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
      setErrors({ general: 'Failed to submit appointment. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [formData, validateForm, conflict, onSubmit, errors]);

  const handleClose = useCallback(() => {
    // Reset form data
    setFormData({
      customerName: '',
      customerPhone: '',
      serviceType: '',
      appointmentDate: '',
      appointmentTime: '',
      serviceAddress: '',
      notes: '',
      quickAppointment: true
    });
    setErrors({});
    setConflict(null);
    setSelectedTemplateId(null);
    onClose();
  }, [onClose]);

  // ============ RENDER CONDITIONS ============
  if (!isOpen) return null;

  return (
    <div 
      className="quick-add-modal-overlay"
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
            {/* Customer Name */}
            <div className="quick-add-field">
              <label htmlFor="customer-name" className="quick-add-label">
                <User className="h-4 w-4" aria-hidden="true" />
                Customer Name *
              </label>
              <input
                id="customer-name"
                ref={firstInputRef}
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

            {/* Customer Phone */}
            <div className="quick-add-field">
              <label htmlFor="customer-phone" className="quick-add-label">
                <Phone className="h-4 w-4" aria-hidden="true" />
                Phone Number *
              </label>
              <input
                id="customer-phone"
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                className={`quick-add-input ${errors.customerPhone ? 'error' : ''}`}
                placeholder="(555) 123-4567"
                required
                aria-describedby={errors.customerPhone ? 'customer-phone-error' : undefined}
              />
              {errors.customerPhone && (
                <div id="customer-phone-error" className="quick-add-error" role="alert">
                  {errors.customerPhone}
                </div>
              )}
            </div>

            {/* Service Type */}
            <div className="quick-add-field">
              <label htmlFor="service-type" className="quick-add-label">
                <Wrench className="h-4 w-4" aria-hidden="true" />
                Service Type *
              </label>
              <select
                id="service-type"
                value={formData.serviceType}
                onChange={(e) => handleInputChange('serviceType', e.target.value)}
                className={`quick-add-input ${errors.serviceType ? 'error' : ''}`}
                required
                aria-describedby={errors.serviceType ? 'service-type-error' : undefined}
              >
                <option value="">Select service</option>
                {serviceTypes.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
              {errors.serviceType && (
                <div id="service-type-error" className="quick-add-error" role="alert">
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

          {/* Conflict Warning */}
          {conflict && (
            <div className="quick-add-conflict" role="alert">
              <div className="quick-add-conflict-icon">⚠️</div>
              <div>
                <strong>Schedule Conflict Detected</strong>
                <p>Another appointment is scheduled at this time. Please choose a different time slot.</p>
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
              disabled={isSubmitting || isLoading || !formData.customerName || !formData.serviceType}
              className="quick-add-button-one-click"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              One-Click Schedule
            </Button>
            
            <Button
              type="submit"
              disabled={isSubmitting || isLoading || !!conflict}
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
                  Schedule Appointment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickAddModal;
