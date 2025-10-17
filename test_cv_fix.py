#!/usr/bin/env python3
"""
Test CV file serving fix
"""
import requests
import urllib.parse

def test_cv_file_serving():
    """Test the CV file serving functionality"""
    base_url = "http://localhost:8000"
    
    print("🧪 Testing CV File Serving Fix")
    print("=" * 40)
    
    try:
        # Test the CV file endpoint
        recruiter_id = "3"
        demand_id = "1"
        filename = "Indhuja M - Exp Resume.pdf"
        
        # URL encode the filename to handle spaces
        encoded_filename = urllib.parse.quote(filename)
        
        test_url = f"{base_url}/cv-file/{recruiter_id}/{demand_id}/{encoded_filename}"
        print(f"Testing URL: {test_url}")
        
        response = requests.get(test_url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ CV file serving works!")
            print(f"Content-Type: {response.headers.get('content-type')}")
            print(f"Content-Length: {response.headers.get('content-length')}")
        elif response.status_code == 404:
            print("❌ File not found")
            print(f"Response: {response.text}")
        else:
            print(f"❌ Unexpected status: {response.status_code}")
            print(f"Response: {response.text}")
            
        # Test static file serving
        static_url = f"{base_url}/cv-files/{recruiter_id}/{demand_id}/{encoded_filename}"
        print(f"\nTesting static URL: {static_url}")
        
        response = requests.get(static_url)
        print(f"Static Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Static file serving works!")
        else:
            print(f"❌ Static file serving failed: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server. Make sure it's running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_cv_file_serving()

