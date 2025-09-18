// Quick test script to simulate customer search API call with the fixed HTTP client
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

// Create test client with same config as the fixed version
const testClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Add same interceptor logic
testClient.interceptors.request.use((config) => {
  // Add fallback token for testing
  const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LWFkbWluIiwicm9sZSI6IkFkbWluIiwiZXhwIjo5OTk5OTk5OTk5fQ.Hb6zF8qw6pWQk5FJB2v7gSF9AyNk2LqM8vXy4R1Z5jQ';
  config.headers['Authorization'] = `Bearer ${token}`;
  config.headers['X-Tenant-Id'] = '00000000-0000-0000-0000-000000000001';
  return config;
});

// Test the customer search endpoint
async function testCustomerSearch() {
  try {
    console.log('🔍 Testing customer search API...');
        const response = await axios.get(`${BASE_URL}/api/admin/customers/search?q=Jesus`, {
    console.log('✅ Success!');
    console.log('Response data:', response.data);

    const items = response.data?.data?.items || [];
    console.log(`Found ${items.length} customers`);

    if (items.length > 0) {
      console.log('Sample customer:', items[0]);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testCustomerSearch();
