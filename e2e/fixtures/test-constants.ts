/**
 * Test Constants - Deterministic data for all E2E tests
 * Provides consistent IDs, names, prices, and data structures across all 95 tests
 */

export const TEST_CONSTANTS = {
  // Test Customers with predictable IDs
  CUSTOMERS: {
    CUSTOMER_001: {
      id: 'test-customer-001',
      name: 'John Smith',
      email: 'john.smith@test.com',
      phone: '555-0101',
      address: '123 Main St, Test City, TC 12345'
    },
    CUSTOMER_002: {
      id: 'test-customer-002',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@test.com',
      phone: '555-0102',
      address: '456 Oak Ave, Test City, TC 12346'
    },
    CUSTOMER_003: {
      id: 'test-customer-003',
      name: 'Mike Davis',
      email: 'mike.davis@test.com',
      phone: '555-0103',
      address: '789 Pine St, Test City, TC 12347'
    }
  },

  // Test Vehicles with predictable VINs
  VEHICLES: {
    JOHN_HONDA: {
      id: 'test-vehicle-001',
      customer_id: 'test-customer-001',
      vin: 'TEST001HONDA2020001',
      year: 2020,
      make: 'Honda',
      model: 'Civic',
      license_plate: 'TEST001',
      color: 'Blue',
      mileage: 45000
    },
    JOHN_TOYOTA: {
      id: 'test-vehicle-002',
      customer_id: 'test-customer-001',
      vin: 'TEST002TOYOTA2019001',
      year: 2019,
      make: 'Toyota',
      model: 'Camry',
      license_plate: 'TEST002',
      color: 'Silver',
      mileage: 52000
    },
    SARAH_FORD: {
      id: 'test-vehicle-003',
      customer_id: 'test-customer-002',
      vin: 'TEST003FORD2021001',
      year: 2021,
      make: 'Ford',
      model: 'F-150',
      license_plate: 'TEST003',
      color: 'Red',
      mileage: 28000
    },
    SARAH_NISSAN: {
      id: 'test-vehicle-004',
      customer_id: 'test-customer-002',
      vin: 'TEST004NISSAN2018001',
      year: 2018,
      make: 'Nissan',
      model: 'Altima',
      license_plate: 'TEST004',
      color: 'White',
      mileage: 65000
    },
    MIKE_CHEVY: {
      id: 'test-vehicle-005',
      customer_id: 'test-customer-003',
      vin: 'TEST005CHEVY2022001',
      year: 2022,
      make: 'Chevrolet',
      model: 'Silverado',
      license_plate: 'TEST005',
      color: 'Black',
      mileage: 15000
    },
    MIKE_BMW: {
      id: 'test-vehicle-006',
      customer_id: 'test-customer-003',
      vin: 'TEST006BMW2020001',
      year: 2020,
      make: 'BMW',
      model: '3 Series',
      license_plate: 'TEST006',
      color: 'Gray',
      mileage: 38000
    }
  },

  // Standard Service Catalog with consistent pricing
  SERVICES: {
    OIL_CHANGE: {
      id: 'service-oil-change',
      name: 'Oil Change',
      description: 'Standard oil change with filter replacement',
      base_price: 45.00,
      estimated_duration: 30
    },
    BRAKE_INSPECTION: {
      id: 'service-brake-inspection',
      name: 'Brake Inspection',
      description: 'Complete brake system inspection',
      base_price: 85.00,
      estimated_duration: 45
    },
    TIRE_ROTATION: {
      id: 'service-tire-rotation',
      name: 'Tire Rotation',
      description: 'Four-wheel tire rotation and inspection',
      base_price: 35.00,
      estimated_duration: 25
    },
    TRANSMISSION_SERVICE: {
      id: 'service-transmission',
      name: 'Transmission Service',
      description: 'Transmission fluid change and inspection',
      base_price: 120.00,
      estimated_duration: 60
    },
    AIR_FILTER: {
      id: 'service-air-filter',
      name: 'Air Filter Replacement',
      description: 'Engine air filter replacement',
      base_price: 25.00,
      estimated_duration: 15
    },
    BATTERY_TEST: {
      id: 'service-battery-test',
      name: 'Battery Test',
      description: 'Battery load test and terminal cleaning',
      base_price: 40.00,
      estimated_duration: 20
    },
    COOLANT_FLUSH: {
      id: 'service-coolant-flush',
      name: 'Coolant Flush',
      description: 'Complete cooling system flush and refill',
      base_price: 95.00,
      estimated_duration: 75
    },
    SPARK_PLUGS: {
      id: 'service-spark-plugs',
      name: 'Spark Plug Replacement',
      description: 'Replace spark plugs and inspect ignition system',
      base_price: 110.00,
      estimated_duration: 90
    },
    ALIGNMENT: {
      id: 'service-alignment',
      name: 'Wheel Alignment',
      description: 'Four-wheel alignment check and adjustment',
      base_price: 75.00,
      estimated_duration: 60
    },
    DIAGNOSTIC: {
      id: 'service-diagnostic',
      name: 'Computer Diagnostic',
      description: 'Full vehicle computer diagnostic scan',
      base_price: 125.00,
      estimated_duration: 45
    }
  },

  // Appointment Status Constants
  APPOINTMENT_STATUS: {
    SCHEDULED: 'Scheduled',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No Show'
  },

  // Test Timeframes for appointments
  DATES: {
    YESTERDAY: () => {
      const date = new Date()
      date.setDate(date.getDate() - 1)
      return date.toISOString().split('T')[0]
    },
    TODAY: () => {
      return new Date().toISOString().split('T')[0]
    },
    TOMORROW: () => {
      const date = new Date()
      date.setDate(date.getDate() + 1)
      return date.toISOString().split('T')[0]
    },
    NEXT_WEEK: () => {
      const date = new Date()
      date.setDate(date.getDate() + 7)
      return date.toISOString().split('T')[0]
    },
    LAST_MONTH: () => {
      const date = new Date()
      date.setMonth(date.getMonth() - 1)
      return date.toISOString().split('T')[0]
    }
  },

  // Common test selectors for consistent element targeting
  SELECTORS: {
    CUSTOMER_SEARCH: '[data-testid="customer-search"]',
    VEHICLE_DROPDOWN: '[data-testid="vehicle-dropdown"]',
    SERVICE_CHECKBOX: '[data-testid="service-checkbox"]',
    APPOINTMENT_CARD: '[data-testid="appointment-card"]',
    BOARD_COLUMN: '[data-testid="board-column"]',
    SAVE_BUTTON: '[data-testid="save-button"]',
    CANCEL_BUTTON: '[data-testid="cancel-button"]',
    MODAL_OVERLAY: '[data-testid="modal-overlay"]',
    LOADING_SPINNER: '[data-testid="loading-spinner"]'
  },

  // Test environment configuration
  CONFIG: {
    DEFAULT_TIMEOUT: 15000,
    LONG_TIMEOUT: 30000,
    SHORT_TIMEOUT: 5000,
    STABILIZATION_DELAY: 2000,
    RETRY_ATTEMPTS: 3,
    TENANT_ID: 'tenant-test-001'
  }
}

// Helper functions for test data generation
export const generateAppointmentId = (customerId: string, index: number): string => {
  return `test-appointment-${customerId.split('-')[2]}-${index.toString().padStart(3, '0')}`
}

export const generateInvoiceId = (appointmentId: string): string => {
  return `test-invoice-${appointmentId.split('-').slice(-2).join('-')}`
}

export const getRandomService = (): any => {
  const services = Object.values(TEST_CONSTANTS.SERVICES)
  return services[Math.floor(Math.random() * services.length)]
}

export const getMultipleServices = (count: number): any[] => {
  const services = Object.values(TEST_CONSTANTS.SERVICES)
  const shuffled = [...services].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(count, services.length))
}
