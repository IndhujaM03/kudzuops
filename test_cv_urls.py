#!/usr/bin/env python3
"""
Test script to verify CV URL functionality
"""
import requests
import json

def test_cv_urls():
    """Test the CV URL endpoints"""
    base_url = "http://localhost:8000"
    
    print("🧪 Testing CV URL functionality...")
    
    try:
        # Test CV Received endpoint
        print("\n1. Testing CV Received endpoint...")
        response = requests.get(f"{base_url}/cv-received")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ CV Received: {len(data)} records found")
            
            # Check if CV URLs are properly formatted
            for record in data:
                if record.get('cv_list'):
                    cv_list = record['cv_list']
                    if isinstance(cv_list, list):
                        for cv in cv_list:
                            if cv.get('cv_url'):
                                print(f"   📄 CV URL: {cv['cv_url']}")
                                # Check if URL starts with http
                                if cv['cv_url'].startswith('http'):
                                    print(f"   ✅ Proper URL format")
                                else:
                                    print(f"   ⚠️  URL not properly formatted")
        else:
            print(f"❌ CV Received failed: {response.status_code}")
            
        # Test CV Submitted endpoint
        print("\n2. Testing CV Submitted endpoint...")
        response = requests.get(f"{base_url}/cv-submitted")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ CV Submitted: {len(data)} records found")
            
            # Check if CV URLs are properly formatted
            for record in data:
                if record.get('cv_list'):
                    cv_list = record['cv_list']
                    if isinstance(cv_list, list):
                        for cv in cv_list:
                            if cv.get('cv_url'):
                                print(f"   📄 CV URL: {cv['cv_url']}")
                                # Check if URL starts with http
                                if cv['cv_url'].startswith('http'):
                                    print(f"   ✅ Proper URL format")
                                else:
                                    print(f"   ⚠️  URL not properly formatted")
        else:
            print(f"❌ CV Submitted failed: {response.status_code}")
            
        # Test CV file serving endpoint
        print("\n3. Testing CV file serving endpoint...")
        test_url = f"{base_url}/cv-file/3/1/Indhuja M - Exp Resume.pdf"
        response = requests.head(test_url)
        if response.status_code == 200:
            print(f"✅ CV file serving works: {test_url}")
        elif response.status_code == 404:
            print(f"⚠️  CV file not found (expected if file doesn't exist): {test_url}")
        else:
            print(f"❌ CV file serving failed: {response.status_code}")
            
        # Test non-existent file
        print("\n4. Testing non-existent file handling...")
        test_url = f"{base_url}/cv-file/999/999/nonexistent.pdf"
        response = requests.head(test_url)
        if response.status_code == 404:
            print(f"✅ Proper 404 handling for non-existent files")
        else:
            print(f"❌ Expected 404 but got: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server. Make sure it's running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_cv_urls()
