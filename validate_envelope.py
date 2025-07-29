#!/usr/bin/env python3
"""
Simple validation script for T-007 using Flask test client
This validates the envelope structure that the curl CI will test
"""

import json
import sys
import os
sys.path.append('/Users/jesusortiz/Edgars-mobile-auto-shop/backend')

from backend.local_server import app

def main():
    print("🧪 Testing T-007 envelope structure validation")
    
    # Set up test environment
    os.environ['FALLBACK_TO_MEMORY'] = 'true'
    os.environ['JWT_SECRET'] = 'test-secret'
    
    app.config['TESTING'] = True
    
    with app.test_client() as client:
        print("📡 Making request to /api/admin/appointments")
        response = client.get('/api/admin/appointments')
        
        if response.status_code != 200:
            print(f"❌ Request failed with status {response.status_code}")
            return 1
            
        data = response.get_json()
        print(f"📄 Response: {json.dumps(data, indent=2)}")
        
        # Validate envelope structure like the curl CI will do
        errors_field = data.get('errors')
        
        if errors_field is None:
            print("✅ SUCCESS: .errors field is null as expected")
        else:
            print(f"❌ FAILURE: .errors field is not null, got: {errors_field}")
            return 1
        
        # Additional validation  
        data_field = data.get('data')
        meta_field = data.get('meta')
        
        if data_field is not None and meta_field is not None:
            print("✅ SUCCESS: Envelope structure is valid (has data and meta fields)")
            
            # Check that appointments array exists
            if 'appointments' in data_field:
                print("✅ SUCCESS: appointments array found in data")
            else:
                print("❌ FAILURE: appointments array not found in data")
                return 1
                
        else:
            print("❌ FAILURE: Invalid envelope structure")
            print(f"data field: {data_field}")
            print(f"meta field: {meta_field}")
            return 1
            
        print("🎉 T-007 envelope validation completed successfully!")
        print("   The curl CI job will:")
        print("   1. Start Flask server in background")
        print("   2. Make curl request to /api/admin/appointments")
        print("   3. Use jq to assert .errors == null")
        print("   4. Validate envelope structure")
        return 0

if __name__ == "__main__":
    sys.exit(main())
