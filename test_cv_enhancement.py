#!/usr/bin/env python3
"""
Comprehensive test for CV URL enhancement functionality
"""
import requests
import json
import os

def test_cv_enhancement():
    """Test the complete CV URL enhancement functionality"""
    base_url = "http://localhost:8000"
    
    print("🧪 Testing CV URL Enhancement Functionality")
    print("=" * 50)
    
    try:
        # Test 1: CV Received endpoint with URL generation
        print("\n1. Testing CV Received endpoint...")
        response = requests.get(f"{base_url}/cv-received")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ CV Received: {len(data)} records found")
            
            for i, record in enumerate(data):
                print(f"   Record {i+1}:")
                print(f"     - Recruiter ID: {record.get('recruiter_id')}")
                print(f"     - Demand ID: {record.get('demand_id')}")
                
                if record.get('cv_list'):
                    cv_list = record['cv_list']
                    if isinstance(cv_list, list):
                        for j, cv in enumerate(cv_list):
                            print(f"     - CV {j+1}: {cv.get('candidate_name', 'Unknown')}")
                            print(f"       URL: {cv.get('cv_url', 'None')}")
                            print(f"       Available: {cv.get('cv_available', 'Unknown')}")
        else:
            print(f"❌ CV Received failed: {response.status_code}")
            
        # Test 2: CV Submitted endpoint with URL generation
        print("\n2. Testing CV Submitted endpoint...")
        response = requests.get(f"{base_url}/cv-submitted")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ CV Submitted: {len(data)} records found")
            
            for i, record in enumerate(data):
                print(f"   Record {i+1}:")
                print(f"     - Recruiter ID: {record.get('recruiter_id')}")
                print(f"     - Demand ID: {record.get('demand_id')}")
                
                if record.get('cv_list'):
                    cv_list = record['cv_list']
                    if isinstance(cv_list, list):
                        for j, cv in enumerate(cv_list):
                            print(f"     - CV {j+1}: {cv.get('candidate_name', 'Unknown')}")
                            print(f"       URL: {cv.get('cv_url', 'None')}")
                            print(f"       Available: {cv.get('cv_available', 'Unknown')}")
        else:
            print(f"❌ CV Submitted failed: {response.status_code}")
            
        # Test 3: CV File serving endpoint
        print("\n3. Testing CV File serving endpoint...")
        test_cases = [
            ("3", "1", "Indhuja M - Exp Resume.pdf", "Existing file"),
            ("999", "999", "nonexistent.pdf", "Non-existent file"),
            ("3", "1", "", "Empty filename"),
        ]
        
        for recruiter_id, demand_id, filename, description in test_cases:
            if filename:
                test_url = f"{base_url}/cv-file/{recruiter_id}/{demand_id}/{filename}"
            else:
                test_url = f"{base_url}/cv-file/{recruiter_id}/{demand_id}/"
                
            response = requests.head(test_url)
            print(f"   {description}:")
            print(f"     URL: {test_url}")
            print(f"     Status: {response.status_code}")
            
            if response.status_code == 200:
                print(f"     ✅ File accessible")
            elif response.status_code == 404:
                print(f"     ⚠️  File not found (expected for non-existent files)")
            else:
                print(f"     ❌ Unexpected status: {response.status_code}")
                
        # Test 4: File path structure validation
        print("\n4. Testing file path structure...")
        cv_uploads_path = os.path.join("backend", "src", "assets", "cv_uploads")
        if os.path.exists(cv_uploads_path):
            print(f"✅ CV uploads directory exists: {cv_uploads_path}")
            
            # Check for recruiter directories
            for item in os.listdir(cv_uploads_path):
                item_path = os.path.join(cv_uploads_path, item)
                if os.path.isdir(item_path):
                    print(f"   📁 Recruiter directory: {item}")
                    
                    # Check for demand directories
                    for demand_item in os.listdir(item_path):
                        demand_path = os.path.join(item_path, demand_item)
                        if os.path.isdir(demand_path):
                            print(f"     📁 Demand directory: {demand_item}")
                            
                            # Check for CV files
                            for file_item in os.listdir(demand_path):
                                file_path = os.path.join(demand_path, file_item)
                                if os.path.isfile(file_path):
                                    print(f"       📄 CV file: {file_item}")
        else:
            print(f"❌ CV uploads directory not found: {cv_uploads_path}")
            
        # Test 5: URL format validation
        print("\n5. Testing URL format validation...")
        response = requests.get(f"{base_url}/cv-received")
        if response.status_code == 200:
            data = response.json()
            for record in data:
                if record.get('cv_list'):
                    cv_list = record['cv_list']
                    if isinstance(cv_list, list):
                        for cv in cv_list:
                            if cv.get('cv_url'):
                                url = cv['cv_url']
                                expected_pattern = f"http://localhost:8000/cv-file/{record['recruiter_id']}/{record['demand_id']}/"
                                if url.startswith(expected_pattern):
                                    print(f"   ✅ URL format correct: {url}")
                                else:
                                    print(f"   ❌ URL format incorrect: {url}")
                                    print(f"       Expected to start with: {expected_pattern}")
                                    
        print("\n" + "=" * 50)
        print("🎉 CV URL Enhancement Test Complete!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server. Make sure it's running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_cv_enhancement()

