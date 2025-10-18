#!/usr/bin/env python3
"""
Test script to verify profile submission logic implementation
This script tests the enhanced profile submission functionality for Recruiters.
"""

import requests
import json
import sys
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8000"  # Adjust if your backend runs on different port
TEST_RECRUITER_ID = 1  # Adjust based on your test data
TEST_DEMAND_ID = 1  # Adjust based on your test data

def test_profile_submission():
    """Test the profile submission endpoint with enhanced logic"""
    
    print("🧪 Testing Profile Submission Logic")
    print("=" * 50)
    
    # Test data for profile submission
    test_data = {
        "recruiter_id": TEST_RECRUITER_ID,
        "demandId": TEST_DEMAND_ID,
        "candidateName": "Test Candidate",
        "email": "test.candidate@example.com",
        "phone": "+1-555-123-4567",
        "notes": "Test profile submission for validation",
        "cvIds": [1, 2]  # Adjust based on your test data
    }
    
    try:
        # Make the submission request
        url = f"{BASE_URL}/recruiter/submission/submit"
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
            print("✅ Profile Submission Successful!")
            print(f"📋 Response: {json.dumps(result, indent=2)}")
            
            # Verify the response structure
            expected_fields = ["message", "submission_id"]
            missing_fields = [field for field in expected_fields if field not in result]
            
            if missing_fields:
                print(f"⚠️  Missing fields in response: {missing_fields}")
            else:
                print("✅ All expected fields present in response")
                
            # Check if submission was created
            submission_id = result.get("submission_id")
            if submission_id:
                print(f"✅ Submission created with ID: {submission_id}")
            else:
                print("⚠️  No submission ID returned")
                
        else:
            print(f"❌ Request failed with status {response.status_code}")
            print(f"📋 Error response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed. Make sure the backend server is running on the correct port.")
        print("💡 Try: cd backend && python -m uvicorn app.main:app --reload")
    except Exception as e:
        print(f"❌ Test failed with error: {e}")

def test_database_status_updates():
    """Test database status updates after profile submission"""
    print("\n🔍 Testing Database Status Updates")
    print("=" * 50)
    
    try:
        # Get demand details to check status
        url = f"{BASE_URL}/demand/{TEST_DEMAND_ID}"
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            print(f"📊 Demand Status: {data.get('status', 'unknown')}")
            print(f"📊 Demand Details: {json.dumps(data, indent=2)}")
            
            # Check if status was updated to 'closed' if counts match
            if data.get('status') == 'closed':
                print("✅ Demand status correctly updated to 'closed'")
            else:
                print(f"ℹ️  Demand status: {data.get('status')} (may not be closed if counts don't match)")
                
        else:
            print(f"❌ Failed to get demand data: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Database status test failed: {e}")

def test_recruiter_activity_status():
    """Test recruiter activity status updates"""
    print("\n🔍 Testing Recruiter Activity Status")
    print("=" * 50)
    
    try:
        # Get recruiter activity for the demand
        url = f"{BASE_URL}/recruiter/{TEST_RECRUITER_ID}/activity/{TEST_DEMAND_ID}"
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            print(f"📊 Activity Status: {data.get('activity_status', 'unknown')}")
            print(f"📊 Uploaded CV Count: {data.get('uploaded_cv_count', 'unknown')}")
            print(f"📊 Required CV Count: {data.get('required_cv_count', 'unknown')}")
            
            # Check if activity status was updated to 'closed' if counts match
            if data.get('activity_status') == 'closed':
                print("✅ Activity status correctly updated to 'closed'")
            else:
                print(f"ℹ️  Activity status: {data.get('activity_status')} (may not be closed if counts don't match)")
                
        else:
            print(f"❌ Failed to get activity data: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Activity status test failed: {e}")

if __name__ == "__main__":
    print("🚀 Profile Submission Logic Test Suite")
    print("=" * 60)
    
    # Test the submission logic
    test_profile_submission()
    
    # Test database status updates
    test_database_status_updates()
    
    # Test recruiter activity status
    test_recruiter_activity_status()
    
    print("\n✅ Test suite completed!")
    print("\n💡 To run this test:")
    print("   1. Make sure your backend is running")
    print("   2. Update TEST_RECRUITER_ID and TEST_DEMAND_ID with real values")
    print("   3. Ensure you have test CVs with IDs 1 and 2")
    print("   4. Run: python test_profile_submission_logic.py")


