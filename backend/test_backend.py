#!/usr/bin/env python3
"""
Test script to verify backend API endpoints
"""
import requests
import json

def test_backend_endpoints():
    """Test backend API endpoints"""
    base_url = "http://localhost:8000"
    
    print("🚀 Testing Backend API Endpoints")
    print("=" * 50)
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            print("✅ Health endpoint working")
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return
    
    # Test registration endpoint
    print("\n🧪 Testing Registration Endpoint...")
    try:
        registration_data = {
            "email": "test@example.com",
            "password": "TestPass123",
            "confirm_password": "TestPass123"
        }
        
        response = requests.post(
            f"{base_url}/auth/register",
            headers={"Content-Type": "application/json"},
            json=registration_data
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Registration endpoint working")
        else:
            print(f"❌ Registration failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Registration error: {e}")
    
    # Test password reset endpoint
    print("\n🧪 Testing Password Reset Endpoint...")
    try:
        reset_data = {
            "email": "test@example.com"
        }
        
        response = requests.post(
            f"{base_url}/auth/request-reset",
            headers={"Content-Type": "application/json"},
            json=reset_data
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Password reset endpoint working")
        else:
            print(f"❌ Password reset failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Password reset error: {e}")

if __name__ == "__main__":
    test_backend_endpoints()
