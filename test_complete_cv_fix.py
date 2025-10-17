#!/usr/bin/env python3
"""
Complete test for CV URL fix
"""
import requests
import urllib.parse
import os

def test_complete_cv_fix():
    """Test the complete CV URL fix"""
    base_url = "http://localhost:8000"
    
    print("🔧 Complete CV URL Fix Test")
    print("=" * 50)
    
    # Test 1: Check if backend is running
    print("\n1. Testing backend connection...")
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            print("✅ Backend is running")
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Make sure it's running on localhost:8000")
        return
    
    # Test 2: Check CV data endpoints
    print("\n2. Testing CV data endpoints...")
    try:
        response = requests.get(f"{base_url}/cv-received")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ CV Received endpoint works: {len(data)} records")
            
            # Check if any CVs have URLs
            for record in data:
                if record.get('cv_list'):
                    cv_list = record['cv_list']
                    if isinstance(cv_list, list):
                        for cv in cv_list:
                            if cv.get('cv_url'):
                                print(f"   📄 Found CV URL: {cv['cv_url']}")
                                break
        else:
            print(f"❌ CV Received endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing CV Received: {e}")
    
    # Test 3: Test CV file serving
    print("\n3. Testing CV file serving...")
    test_cases = [
        ("3", "1", "Indhuja M - Exp Resume.pdf"),
        ("3", "1", "test.pdf"),
    ]
    
    for recruiter_id, demand_id, filename in test_cases:
        print(f"\n   Testing: {recruiter_id}/{demand_id}/{filename}")
        
        # Test API endpoint
        api_url = f"{base_url}/cv-file/{recruiter_id}/{demand_id}/{filename}"
        print(f"   API URL: {api_url}")
        
        try:
            response = requests.get(api_url)
            print(f"   API Status: {response.status_code}")
            
            if response.status_code == 200:
                print("   ✅ API endpoint works!")
                print(f"   Content-Type: {response.headers.get('content-type')}")
            elif response.status_code == 404:
                print("   ⚠️  File not found (expected for test.pdf)")
            else:
                print(f"   ❌ Unexpected status: {response.status_code}")
                print(f"   Response: {response.text}")
        except Exception as e:
            print(f"   ❌ API Error: {e}")
        
        # Test static file serving
        static_url = f"{base_url}/cv-files/{recruiter_id}/{demand_id}/{filename}"
        print(f"   Static URL: {static_url}")
        
        try:
            response = requests.get(static_url)
            print(f"   Static Status: {response.status_code}")
            
            if response.status_code == 200:
                print("   ✅ Static file serving works!")
            elif response.status_code == 404:
                print("   ⚠️  Static file not found")
            else:
                print(f"   ❌ Static unexpected status: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Static Error: {e}")
    
    # Test 4: Check file structure
    print("\n4. Checking file structure...")
    cv_uploads_path = os.path.join("backend", "src", "assets", "cv_uploads")
    if os.path.exists(cv_uploads_path):
        print(f"✅ CV uploads directory exists: {cv_uploads_path}")
        
        # List contents
        for root, dirs, files in os.walk(cv_uploads_path):
            level = root.replace(cv_uploads_path, '').count(os.sep)
            indent = ' ' * 2 * level
            print(f"{indent}{os.path.basename(root)}/")
            subindent = ' ' * 2 * (level + 1)
            for file in files:
                print(f"{subindent}{file}")
    else:
        print(f"❌ CV uploads directory not found: {cv_uploads_path}")
    
    print("\n" + "=" * 50)
    print("🎉 CV URL Fix Test Complete!")

if __name__ == "__main__":
    test_complete_cv_fix()

