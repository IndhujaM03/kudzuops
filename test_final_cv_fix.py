#!/usr/bin/env python3
"""
Final test for CV URL fix
"""
import requests
import urllib.parse

def test_final_cv_fix():
    """Test the final CV URL fix"""
    base_url = "http://localhost:8000"
    
    print("🔧 Final CV URL Fix Test")
    print("=" * 40)
    
    # Test the working API endpoint
    recruiter_id = "3"
    demand_id = "1"
    filename = "Indhuja M - Exp Resume.pdf"
    
    # URL encode the filename
    encoded_filename = urllib.parse.quote(filename)
    api_url = f"{base_url}/cv-file/{recruiter_id}/{demand_id}/{encoded_filename}"
    
    print(f"Testing API URL: {api_url}")
    
    try:
        response = requests.get(api_url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ CV file serving works!")
            print(f"Content-Type: {response.headers.get('content-type')}")
            print(f"Content-Length: {response.headers.get('content-length')}")
            print("🎉 The CV URL fix is working correctly!")
        else:
            print(f"❌ API failed: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test the CV files list endpoint
    print(f"\nTesting CV files list: {base_url}/cv-files-list")
    try:
        response = requests.get(f"{base_url}/cv-files-list")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ CV files list works: {data.get('total_files', 0)} files found")
            for file_info in data.get('files', []):
                print(f"   📄 {file_info['path']}")
        else:
            print(f"❌ CV files list failed: {response.status_code}")
    except Exception as e:
        print(f"❌ CV files list error: {e}")

if __name__ == "__main__":
    test_final_cv_fix()

