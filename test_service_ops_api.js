// Simple test to verify service operations API is working
const testServiceOperationsAPI = async () => {
  console.log('🧪 Testing Service Operations API...');

  try {
    const response = await fetch('http://localhost:3001/api/admin/service-operations', {
      headers: {
        'Authorization': 'Bearer dev-token',
        'X-Tenant-Id': '00000000-0000-0000-0000-000000000001',
        'Content-Type': 'application/json'
      }
    });

    console.log(`📡 Response Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS! Service operations API is working');
      console.log(`🔧 Found ${data.data ? data.data.length : 'unknown'} service operations`);

      if (data.data && data.data.length > 0) {
        console.log(`📋 Sample service: ${data.data[0].name} (ID: ${data.data[0].id})`);
      }
    } else {
      console.log('❌ FAILED! API returned error status');
      const text = await response.text();
      console.log('Error:', text);
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
};

// Run the test
testServiceOperationsAPI();
