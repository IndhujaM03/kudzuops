#!/usr/bin/env python3
"""
Complete test for the CV URL path duplication fix
"""
import requests
import urllib.parse
import os

def test_complete_fix():
    """Test the complete CV URL fix"""
    base_url = "http://localhost:8000"
    
    print("🔧 Complete CV URL Path Fix Test")
    print("=" * 50)
    
    # Test 1: Check if backend is running
    print("\n1. Backend Health Check...")
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
    
    # Test 2: Test CV file serving with just filename
    print("\n2. Testing CV file serving (filename only)...")
    recruiter_id = "3"
    demand_id = "1"
    filename = "Indhuja M - Exp Resume.pdf"
    encoded_filename = urllib.parse.quote(filename)
    
    test_url = f"{base_url}/cv-file/{recruiter_id}/{demand_id}/{encoded_filename}"
    print(f"URL: {test_url}")
    
    try:
        response = requests.get(test_url)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ CV file serving works!")
            print(f"Content-Type: {response.headers.get('content-type')}")
            print(f"Content-Length: {response.headers.get('content-length')}")
        else:
            print(f"❌ Failed: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 3: Test with full path (should be handled correctly)
    print("\n3. Testing with full path (path duplication fix)...")
    full_path = "src/assets/cv_uploads/3/1/Indhuja M - Exp Resume.pdf"
    encoded_full_path = urllib.parse.quote(full_path)
    
    test_url_full = f"{base_url}/cv-file/{recruiter_id}/{demand_id}/{encoded_full_path}"
    print(f"URL: {test_url_full}")
    
    try:
        response = requests.get(test_url_full)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Full path handling works!")
            print(f"Content-Type: {response.headers.get('content-type')}")
        else:
            print(f"❌ Full path failed: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 4: Check file structure
    print("\n4. File Structure Check...")
    cv_uploads_path = os.path.join("backend", "src", "assets", "cv_uploads")
    test_file_path = os.path.join(cv_uploads_path, "3", "1", "Indhuja M - Exp Resume.pdf")
    
    print(f"CV uploads path: {cv_uploads_path}")
    print(f"CV uploads exists: {os.path.exists(cv_uploads_path)}")
    print(f"Test file path: {test_file_path}")
    print(f"Test file exists: {os.path.exists(test_file_path)}")
    
    if os.path.exists(test_file_path):
        file_size = os.path.getsize(test_file_path)
        print(f"File size: {file_size} bytes")
    
    # Test 5: Test CV files list endpoint
    print("\n5. Testing CV files list...")
    try:
        response = requests.get(f"{base_url}/cv-files-list")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ CV files list works: {data.get('total_files', 0)} files")
            for file_info in data.get('files', []):
                print(f"   📄 {file_info['path']}")
        else:
            print(f"❌ CV files list failed: {response.status_code}")
    except Exception as e:
        print(f"❌ CV files list error: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Complete CV URL Path Fix Test Complete!")

if __name__ == "__main__":
    test_complete_fix()

