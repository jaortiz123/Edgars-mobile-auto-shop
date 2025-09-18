// Quick test script to verify customer search functionality
import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function testCustomerSearch() {
  try {
    console.log('🔍 Testing customer search API...');

    // First, try to login or get auth token
    console.log('🔑 Attempting to authenticate...');

    // Method 1: Try the login endpoint
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'jesus@example.com',
        password: 'password123'
      });
      console.log('✅ Login successful');
      const authToken = loginResponse.data.token;

      // Now test customer search with token
      console.log('🔍 Testing customer search with auth...');
      const searchResponse = await axios.get(`${BASE_URL}/api/admin/customers/search?q=Jesus`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      console.log('✅ Customer search successful!');
      console.log('Response:', searchResponse.data);
      return;

    } catch (loginError) {
      console.log('❌ Login failed:', loginError.response?.status, loginError.response?.data?.message || loginError.message);
    }

    // Method 2: Try without auth (maybe it's not required)
    console.log('🔍 Testing customer search without auth...');
    const response = await axios.get(`${BASE_URL}/api/admin/customers/search?q=Jesus`);

    console.log('✅ Success without auth!');
    console.log('Response data:', response.data);

    const items = response.data?.data?.items || response.data?.items || [];
    console.log(`Found ${items.length} customers`);

    if (items.length > 0) {
      console.log('Sample customer:', items[0]);
    }

  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
    console.log('Full error details:', error.response?.data);
  }
}

testCustomerSearch();
