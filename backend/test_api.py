#!/usr/bin/env python3
"""
Quick test to verify CV API endpoints
"""

import requests
import json

def test_cv_api():
    """Test the CV API endpoints"""
    
    base_url = "http://localhost:8000"
    
    # Test CV Received endpoint
    try:
        response = requests.get(f"{base_url}/cv-received")
        print(f"CV Received API Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"CV Received Data: {len(data)} records")
            for item in data:
                print(f"  - Activity ID: {item.get('id')}")
                print(f"  - Recruiter: {item.get('recruiter_name')}")
                print(f"  - Client: {item.get('client_name')}")
                print(f"  - CV List: {len(item.get('cv_list', []))} CVs")
                print()
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"CV Received API Error: {e}")
    
    # Test CV Submitted endpoint
    try:
        response = requests.get(f"{base_url}/cv-submitted")
        print(f"CV Submitted API Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"CV Submitted Data: {len(data)} records")
            for item in data:
                print(f"  - Activity ID: {item.get('id')}")
                print(f"  - Recruiter: {item.get('recruiter_name')}")
                print(f"  - Client: {item.get('client_name')}")
                print(f"  - CV List: {len(item.get('cv_list', []))} CVs")
                print()
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"CV Submitted API Error: {e}")

if __name__ == "__main__":
    print("🧪 Testing CV API endpoints...")
    test_cv_api()
