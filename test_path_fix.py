#!/usr/bin/env python3
"""
Test the path duplication fix
"""
import requests
import urllib.parse

def test_path_fix():
    """Test the path duplication fix"""
    base_url = "http://localhost:8000"
    
    print("🔧 Testing Path Duplication Fix")
    print("=" * 40)
    
    # Test 1: Check CV data to see what URLs are being generated
    print("\n1. Checking CV data URLs...")
    try:
        response = requests.get(f"{base_url}/cv-received")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ CV Received: {len(data)} records")
            
            for record in data:
                if record.get('cv_list'):
                    cv_list = record['cv_list']
                    if isinstance(cv_list, list):
                        for cv in cv_list:
                            if cv.get('cv_url'):
                                print(f"   📄 CV URL: {cv['cv_url']}")
                                break
        else:
            print(f"❌ CV Received failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 2: Test the CV file endpoint with just filename
    print("\n2. Testing CV file endpoint...")
    recruiter_id = "3"
    demand_id = "1"
    filename = "Indhuja M - Exp Resume.pdf"
    encoded_filename = urllib.parse.quote(filename)
    
    test_url = f"{base_url}/cv-file/{recruiter_id}/{demand_id}/{encoded_filename}"
    print(f"Testing URL: {test_url}")
    
    try:
        response = requests.get(test_url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ CV file serving works!")
            print(f"Content-Type: {response.headers.get('content-type')}")
        else:
            print(f"❌ Failed: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 3: Test with full path (should be handled correctly now)
    print("\n3. Testing with full path...")
    full_path = "src/assets/cv_uploads/3/1/Indhuja M - Exp Resume.pdf"
    encoded_full_path = urllib.parse.quote(full_path)
    
    test_url_full = f"{base_url}/cv-file/{recruiter_id}/{demand_id}/{encoded_full_path}"
    print(f"Testing with full path: {test_url_full}")
    
    try:
        response = requests.get(test_url_full)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Full path handling works!")
        else:
            print(f"❌ Full path failed: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_path_fix()

