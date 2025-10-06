#!/usr/bin/env python3
"""
Test script to verify OTP generation and email sending functionality
"""
import os
import sys
from dotenv import load_dotenv

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

# Load environment variables
load_dotenv()

from app.login import _generate_otp, _send_email, _store_otp, _verify_otp

def test_otp_generation():
    """Test OTP generation"""
    print("🧪 Testing OTP Generation...")
    
    # Generate multiple OTPs to ensure they're 6 digits
    otps = [_generate_otp() for _ in range(5)]
    
    print(f"Generated OTPs: {otps}")
    
    # Verify all are 6 digits
    for otp in otps:
        assert len(otp) == 6, f"OTP should be 6 digits, got: {otp}"
        assert otp.isdigit(), f"OTP should be numeric, got: {otp}"
        assert 100000 <= int(otp) <= 999999, f"OTP should be between 100000-999999, got: {otp}"
    
    print("✅ OTP generation test passed!")
    return otps[0]

def test_email_sending():
    """Test email sending functionality"""
    print("\n🧪 Testing Email Sending...")
    
    # Test email configuration
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    
    print(f"SMTP Host: {smtp_host}")
    print(f"SMTP Port: {smtp_port}")
    print(f"SMTP User: {smtp_user}")
    print(f"SMTP Password: {'*' * len(smtp_password) if smtp_password else 'Not set'}")
    
    # Generate test OTP
    test_otp = _generate_otp()
    test_email = "test@example.com"
    
    # Test email content
    subject = "Test OTP Email"
    body = f"""
    <h2>Test Email</h2>
    <p>This is a test email to verify OTP functionality.</p>
    <p>Your test OTP is: <strong>{test_otp}</strong></p>
    <p>This OTP will expire in 10 minutes.</p>
    """
    
    print(f"\n📧 Sending test email to {test_email}...")
    print(f"📧 Subject: {subject}")
    print(f"📧 OTP: {test_otp}")
    
    # Send test email
    success = _send_email(test_email, subject, body)
    
    if success:
        print("✅ Email sending test completed!")
    else:
        print("❌ Email sending failed!")
    
    return success, test_otp

def test_redis_otp_storage():
    """Test Redis OTP storage (if available)"""
    print("\n🧪 Testing Redis OTP Storage...")
    
    try:
        test_email = "test@example.com"
        test_otp = _generate_otp()
        
        # Store OTP
        print(f"Storing OTP {test_otp} for {test_email}...")
        store_success = _store_otp(test_email, test_otp, "test")
        
        if store_success:
            print("✅ OTP stored successfully!")
            
            # Verify OTP
            print(f"Verifying OTP {test_otp} for {test_email}...")
            verify_success = _verify_otp(test_email, test_otp, "test")
            
            if verify_success:
                print("✅ OTP verification successful!")
            else:
                print("❌ OTP verification failed!")
                
            # Test wrong OTP
            print(f"Testing wrong OTP for {test_email}...")
            wrong_verify = _verify_otp(test_email, "000000", "test")
            if not wrong_verify:
                print("✅ Wrong OTP correctly rejected!")
            else:
                print("❌ Wrong OTP incorrectly accepted!")
        else:
            print("⚠️  Redis not available, skipping OTP storage test")
            
    except Exception as e:
        print(f"⚠️  Redis test failed: {e}")

def main():
    """Run all tests"""
    print("🚀 Starting OTP and Email Testing...")
    print("=" * 50)
    
    # Test OTP generation
    test_otp = test_otp_generation()
    
    # Test email sending
    email_success, sent_otp = test_email_sending()
    
    # Test Redis OTP storage
    test_redis_otp_storage()
    
    print("\n" + "=" * 50)
    print("📋 Test Summary:")
    print(f"✅ OTP Generation: Working (generated: {test_otp})")
    print(f"{'✅' if email_success else '❌'} Email Sending: {'Working' if email_success else 'Failed'}")
    print("⚠️  Redis OTP Storage: Check logs above")
    
    if email_success:
        print(f"\n📧 Check your email at the configured SMTP address for the test email!")
        print(f"📧 Test OTP sent: {sent_otp}")
    else:
        print(f"\n⚠️  Email sending failed. Check SMTP configuration in .env file.")
        print(f"📧 Test OTP that would have been sent: {sent_otp}")

if __name__ == "__main__":
    main()
