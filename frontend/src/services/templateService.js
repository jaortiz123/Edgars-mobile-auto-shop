/**
 * Template Service for Quick Add Appointments
 *
 * Provides predefined appointment templates for common services
 * with robust error handling and type safety.
 *
 * Features:
 * - Memory Management: Cached templates, cleanup on module unload
 * - Error Handling: Graceful fallbacks, comprehensive error logging
 * - Performance: Cached results, lazy loading, memoization
 * - Type Safety: Runtime validation, comprehensive type checking
 * - Security: Input sanitization, template validation
 * - Maintainability: Comprehensive documentation, modular structure
 */

// Template cache for performance optimization
let templateCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Predefined appointment templates with comprehensive service definitions
 */
const DEFAULT_TEMPLATES = [
  {
    id: 'oil-change',
    name: 'Oil Change',
    description: 'Standard oil change with filter replacement',
    category: 'Maintenance',
    estimatedDuration: '30-45 minutes',
    estimatedPrice: 45.00,
    requiredInfo: ['Vehicle Year', 'Vehicle Make', 'Vehicle Model'],
    defaultNotes: 'Standard oil change - please ensure vehicle is accessible',
    services: [
      {
        name: 'Oil Change',
        category: 'Maintenance',
        estimated_hours: 0.75,
        estimated_price: 35.00,
        notes: 'Drain old oil, replace filter, add new oil'
      },
      {
        name: 'Multi-Point Inspection',
        category: 'Inspection',
        estimated_hours: 0.25,
        estimated_price: 10.00,
        notes: 'Check fluids, belts, hoses, and battery'
      }
    ],
    icon: '🛢️',
    priority: 1
  },
  {
    id: 'brake-service',
    name: 'Brake Service',
    description: 'Brake inspection and pad replacement',
    category: 'Safety',
    estimatedDuration: '1-2 hours',
    estimatedPrice: 180.00,
    requiredInfo: ['Vehicle Year', 'Vehicle Make', 'Vehicle Model', 'Brake Issues'],
    defaultNotes: 'Brake service - customer reports squeaking/grinding',
    services: [
      {
        name: 'Brake Inspection',
        category: 'Safety',
        estimated_hours: 0.5,
        estimated_price: 30.00,
        notes: 'Inspect brake pads, rotors, and fluid'
      },
      {
        name: 'Brake Pad Replacement',
        category: 'Safety',
        estimated_hours: 1.5,
        estimated_price: 150.00,
        notes: 'Replace front brake pads and resurface rotors if needed'
      }
    ],
    icon: '🔧',
    priority: 2
  },
  {
    id: 'diagnostic',
    name: 'Engine Diagnostics',
    description: 'Computer diagnostic scan and analysis',
    category: 'Diagnostics',
    estimatedDuration: '45-60 minutes',
    estimatedPrice: 95.00,
    requiredInfo: ['Vehicle Year', 'Vehicle Make', 'Vehicle Model', 'Symptoms'],
    defaultNotes: 'Engine diagnostic - check engine light or performance issues',
    services: [
      {
        name: 'OBD-II Diagnostic Scan',
        category: 'Diagnostics',
        estimated_hours: 0.5,
        estimated_price: 50.00,
        notes: 'Connect diagnostic scanner and retrieve error codes'
      },
      {
        name: 'Diagnostic Analysis',
        category: 'Diagnostics',
        estimated_hours: 0.5,
        estimated_price: 45.00,
        notes: 'Analyze codes and provide repair recommendations'
      }
    ],
    icon: '🔍',
    priority: 3
  },
  {
    id: 'tire-rotation',
    name: 'Tire Rotation',
    description: 'Rotate tires and check pressure',
    category: 'Maintenance',
    estimatedDuration: '30 minutes',
    estimatedPrice: 35.00,
    requiredInfo: ['Vehicle Year', 'Vehicle Make', 'Vehicle Model'],
    defaultNotes: 'Tire rotation - maintain even tire wear',
    services: [
      {
        name: 'Tire Rotation',
        category: 'Maintenance',
        estimated_hours: 0.5,
        estimated_price: 25.00,
        notes: 'Rotate tires according to manufacturer pattern'
      },
      {
        name: 'Tire Pressure Check',
        category: 'Maintenance',
        estimated_hours: 0.1,
        estimated_price: 10.00,
        notes: 'Check and adjust tire pressure to specification'
      }
    ],
    icon: '🔄',
    priority: 4
  },
  {
    id: 'emergency-repair',
    name: 'Emergency Repair',
    description: 'Urgent roadside assistance or emergency repair',
    category: 'Emergency',
    estimatedDuration: '1-3 hours',
    estimatedPrice: 150.00,
    requiredInfo: ['Current Location', 'Issue Description', 'Vehicle Accessibility'],
    defaultNotes: 'EMERGENCY: Customer needs immediate assistance',
    services: [
      {
        name: 'Emergency Diagnostic',
        category: 'Emergency',
        estimated_hours: 0.5,
        estimated_price: 75.00,
        notes: 'Emergency on-site diagnostic'
      },
      {
        name: 'Emergency Repair',
        category: 'Emergency',
        estimated_hours: 1.0,
        estimated_price: 75.00,
        notes: 'Emergency repair to get vehicle operational'
      }
    ],
    icon: '🚨',
    priority: 0,
    isEmergency: true
  },
  {
    id: 'battery-replacement',
    name: 'Battery Replacement',
    description: 'Battery testing and replacement',
    category: 'Electrical',
    estimatedDuration: '30-45 minutes',
    estimatedPrice: 125.00,
    requiredInfo: ['Vehicle Year', 'Vehicle Make', 'Vehicle Model'],
    defaultNotes: 'Battery replacement - customer reports starting issues',
    services: [
      {
        name: 'Battery Test',
        category: 'Electrical',
        estimated_hours: 0.25,
        estimated_price: 25.00,
        notes: 'Test battery voltage and load capacity'
      },
      {
        name: 'Battery Replacement',
        category: 'Electrical',
        estimated_hours: 0.5,
        estimated_price: 100.00,
        notes: 'Replace battery and clean terminals'
      }
    ],
    icon: '🔋',
    priority: 5
  }
];

/**
 * Validate template structure for security and data integrity
 * @param {Object} template - Template to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateTemplate(template) {
  if (!template || typeof template !== 'object') {
    console.warn('Invalid template: not an object');
    return false;
  }

  const requiredFields = ['id', 'name', 'description', 'category', 'estimatedPrice', 'services'];

  for (const field of requiredFields) {
    if (!template[field]) {
      console.warn(`Invalid template: missing required field '${field}'`);
      return false;
    }
  }

  // Validate services array
  if (!Array.isArray(template.services) || template.services.length === 0) {
    console.warn('Invalid template: services must be a non-empty array');
    return false;
  }

  // Validate each service
  for (const service of template.services) {
    if (!service.name || typeof service.estimated_price !== 'number') {
      console.warn('Invalid service in template:', service);
      return false;
    }
  }

  return true;
}

/**
 * Sanitize template data for security
 * @param {Object} template - Template to sanitize
 * @returns {Object} - Sanitized template
 */
function sanitizeTemplate(template) {
  try {
    // Create deep copy to avoid mutations
    const sanitized = JSON.parse(JSON.stringify(template));

    // Sanitize string fields
    if (sanitized.name) sanitized.name = sanitized.name.toString().trim();
    if (sanitized.description) sanitized.description = sanitized.description.toString().trim();
    if (sanitized.defaultNotes) sanitized.defaultNotes = sanitized.defaultNotes.toString().trim();

    // Ensure numeric fields are valid numbers
    if (typeof sanitized.estimatedPrice === 'string') {
      sanitized.estimatedPrice = parseFloat(sanitized.estimatedPrice) || 0;
    }

    // Sanitize services
    if (Array.isArray(sanitized.services)) {
      sanitized.services = sanitized.services.map(service => ({
        ...service,
        name: service.name ? service.name.toString().trim() : '',
        notes: service.notes ? service.notes.toString().trim() : '',
        estimated_price: typeof service.estimated_price === 'string'
          ? parseFloat(service.estimated_price) || 0
          : service.estimated_price || 0,
        estimated_hours: typeof service.estimated_hours === 'string'
          ? parseFloat(service.estimated_hours) || 0
          : service.estimated_hours || 0
      }));
    }

    return sanitized;
  } catch (error) {
    console.error('Error sanitizing template:', error);
    return template; // Return original if sanitization fails
  }
}

/**
 * Get all available appointment templates
 * @returns {Promise<Array>} - Array of appointment templates
 */
export async function getTemplates() {
  try {
    // Check cache first for performance
    const now = Date.now();
    if (templateCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      return templateCache;
    }

    // In a real application, this would fetch from an API
    // For now, return validated and sanitized default templates
    const templates = DEFAULT_TEMPLATES
      .filter(validateTemplate)
      .map(sanitizeTemplate)
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));

    // Update cache
    templateCache = templates;
    cacheTimestamp = now;

    return templates;
  } catch (error) {
    console.error('Error fetching templates:', error);

    // Graceful fallback - return basic templates
    return [
      {
        id: 'basic-service',
        name: 'Basic Service',
        description: 'Standard automotive service',
        category: 'General',
        estimatedDuration: '1 hour',
        estimatedPrice: 100.00,
        requiredInfo: ['Vehicle Information'],
        defaultNotes: 'Standard automotive service',
        services: [
          {
            name: 'Basic Service',
            category: 'General',
            estimated_hours: 1.0,
            estimated_price: 100.00,
            notes: 'Standard service'
          }
        ],
        icon: '🔧',
        priority: 999
      }
    ];
  }
}

/**
 * Get template by ID
 * @param {string} templateId - Template ID to retrieve
 * @returns {Promise<Object|null>} - Template object or null if not found
 */
export async function getTemplateById(templateId) {
  if (!templateId || typeof templateId !== 'string') {
    console.warn('Invalid template ID provided');
    return null;
  }

  try {
    const templates = await getTemplates();
    const template = templates.find(t => t.id === templateId.trim());

    if (!template) {
      console.warn(`Template not found: ${templateId}`);
      return null;
    }

    return template;
  } catch (error) {
    console.error('Error getting template by ID:', error);
    return null;
  }
}

/**
 * Get templates by category
 * @param {string} category - Category to filter by
 * @returns {Promise<Array>} - Array of templates in the category
 */
export async function getTemplatesByCategory(category) {
  if (!category || typeof category !== 'string') {
    return await getTemplates();
  }

  try {
    const templates = await getTemplates();
    return templates.filter(t =>
      t.category && t.category.toLowerCase() === category.toLowerCase().trim()
    );
  } catch (error) {
    console.error('Error filtering templates by category:', error);
    return [];
  }
}

/**
 * Apply template to form data
 * @param {Object} template - Template to apply
 * @param {Object} existingData - Existing form data to merge with
 * @returns {Object} - Merged form data with template values
 */
export function applyTemplateToFormData(template, existingData = {}) {
  if (!template || !validateTemplate(template)) {
    console.warn('Cannot apply invalid template');
    return existingData;
  }

  try {
    const sanitizedTemplate = sanitizeTemplate(template);

    return {
      ...existingData,
      serviceType: sanitizedTemplate.name,
      estimatedDuration: sanitizedTemplate.estimatedDuration || '1 hour',
      notes: sanitizedTemplate.defaultNotes || '',
      appointmentType: sanitizedTemplate.isEmergency ? 'emergency' : 'regular',
      // Don't override customer data or dates - only service-related fields
      ...(existingData.customerName ? {} : {
        // Only set defaults if no customer data exists
        templateId: sanitizedTemplate.id,
        category: sanitizedTemplate.category
      })
    };
  } catch (error) {
    console.error('Error applying template to form data:', error);
    return existingData;
  }
}

/**
 * Clear template cache (useful for testing or when templates are updated)
 */
export function clearTemplateCache() {
  templateCache = null;
  cacheTimestamp = null;
}

/**
 * Get quick access templates (most commonly used)
 * @returns {Promise<Array>} - Array of quick access templates
 */
export async function getQuickAccessTemplates() {
  try {
    const templates = await getTemplates();
    return templates
      .filter(t => t.priority <= 3) // Top priority templates
      .slice(0, 4); // Limit to 4 for UI performance
  } catch (error) {
    console.error('Error getting quick access templates:', error);
    return [];
  }
}

// Cleanup function for memory management
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clearTemplateCache();
  });
}

export default {
  getTemplates,
  getTemplateById,
  getTemplatesByCategory,
  applyTemplateToFormData,
  clearTemplateCache,
  getQuickAccessTemplates
};
