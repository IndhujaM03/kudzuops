#!/usr/bin/env python3
"""
Test script to verify CV rejection logic implementation
This script tests the enhanced CV rejection functionality for Team Leaders.
"""

import requests
import json
import sys
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8000"  # Adjust if your backend runs on different port
TEST_ACTIVITY_ID = 1  # Adjust based on your test data
TEST_CV_INDEX = 0

def test_cv_rejection():
    """Test the CV rejection endpoint with enhanced logic"""
    
    print("🧪 Testing CV Rejection Logic")
    print("=" * 50)
    
    # Test data
    test_data = {
        "cv_index": TEST_CV_INDEX
    }
    
    try:
        # Make the rejection request
        url = f"{BASE_URL}/cv-reject/{TEST_ACTIVITY_ID}"
        print(f"📡 Making request to: {url}")
        print(f"📋 Test data: {json.dumps(test_data, indent=2)}")
        
        response = requests.post(
            url,
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ CV Rejection Successful!")
            print(f"📋 Response: {json.dumps(result, indent=2)}")
            
            # Verify the response structure
            expected_fields = ["message", "uploaded_count", "required_count", "demand_status"]
            missing_fields = [field for field in expected_fields if field not in result]
            
            if missing_fields:
                print(f"⚠️  Missing fields in response: {missing_fields}")
            else:
                print("✅ All expected fields present in response")
                
            # Check if the logic worked correctly
            uploaded_count = result.get("uploaded_count", 0)
            required_count = result.get("required_count", 0)
            demand_status = result.get("demand_status", "unknown")
            
            print(f"\n📊 Analysis:")
            print(f"   • Uploaded CV Count: {uploaded_count}")
            print(f"   • Required CV Count: {required_count}")
            print(f"   • Demand Status: {demand_status}")
            
            if uploaded_count == required_count and required_count > 0:
                if demand_status == "open":
                    print("✅ Logic working correctly: Counts equal, status updated to 'open'")
                else:
                    print("⚠️  Logic issue: Counts equal but status not updated to 'open'")
            else:
                if demand_status == "unchanged":
                    print("✅ Logic working correctly: Counts not equal, status unchanged")
                else:
                    print("⚠️  Logic issue: Counts not equal but status was changed")
                    
        else:
            print(f"❌ Request failed with status {response.status_code}")
            print(f"📋 Error response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed. Make sure the backend server is running on the correct port.")
        print("💡 Try: cd backend && python -m uvicorn app.main:app --reload")
    except Exception as e:
        print(f"❌ Test failed with error: {e}")

def test_database_consistency():
    """Test database consistency after CV rejection"""
    print("\n🔍 Testing Database Consistency")
    print("=" * 50)
    
    try:
        # Get CV received data to check consistency
        url = f"{BASE_URL}/cv-received"
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            print(f"📊 CV Received Data: {len(data)} records")
            
            # Check for any inconsistencies
            for record in data:
                demand_id = record.get("demand_id")
                uploaded_count = record.get("uploaded_cv_count", 0)
                required_count = record.get("required_cv_count", 0)
                
                print(f"   • Demand {demand_id}: {uploaded_count}/{required_count}")
                
        else:
            print(f"❌ Failed to get CV data: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Database consistency test failed: {e}")

if __name__ == "__main__":
    print("🚀 CV Rejection Logic Test Suite")
    print("=" * 60)
    
    # Test the rejection logic
    test_cv_rejection()
    
    # Test database consistency
    test_database_consistency()
    
    print("\n✅ Test suite completed!")
    print("\n💡 To run this test:")
    print("   1. Make sure your backend is running")
    print("   2. Update TEST_ACTIVITY_ID and TEST_CV_INDEX with real values")
    print("   3. Run: python test_cv_rejection_logic.py")



