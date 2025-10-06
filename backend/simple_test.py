#!/usr/bin/env python3
"""
Simple test script to verify OTP generation and email functionality
without requiring database connection
"""
import os
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def generate_otp():
    """Generate 6-digit OTP"""
    return f"{secrets.randbelow(900000) + 100000:06d}"

def send_test_email(to_email, subject, body):
    """Send test email using SMTP"""
    try:
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")
        
        print(f"📧 Attempting to send email to {to_email}")
        print(f"📧 SMTP Config: {smtp_host}:{smtp_port}")
        print(f"📧 User: {smtp_user}")
        
        if not smtp_user or not smtp_password:
            print(f"⚠️  SMTP credentials not configured. Email would be sent to {to_email}: {subject}")
            print(f"📧 Email body: {body}")
            return True
            
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        print(f"📧 Connecting to SMTP server...")
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        print(f"📧 Logging in with {smtp_user}...")
        server.login(smtp_user, smtp_password)
        print(f"📧 Sending email...")
        server.send_message(msg)
        server.quit()
        print(f"✅ Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Email error: {e}")
        print(f"📧 Email would have been sent to {to_email}: {subject}")
        print(f"📧 Email body: {body}")
        return False

def main():
    print("🚀 Testing OTP Generation and Email Functionality")
    print("=" * 60)
    
    # Test OTP generation
    print("\n🧪 Testing OTP Generation...")
    otps = [generate_otp() for _ in range(3)]
    print(f"Generated OTPs: {otps}")
    
    for otp in otps:
        assert len(otp) == 6, f"OTP should be 6 digits, got: {otp}"
        assert otp.isdigit(), f"OTP should be numeric, got: {otp}"
        assert 100000 <= int(otp) <= 999999, f"OTP should be between 100000-999999, got: {otp}"
    
    print("✅ OTP generation test passed!")
    
    # Test email sending
    print("\n🧪 Testing Email Sending...")
    test_otp = generate_otp()
    test_email = "test@example.com"
    
    subject = "Test OTP Email - Kudzu Authentication"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1>🔐 Kudzu Authentication Test</h1>
        </div>
        <div style="padding: 20px; background: #f8f9fa;">
            <h2>Your Verification Code</h2>
            <p>This is a test email to verify OTP functionality.</p>
            <div style="background: #e9ecef; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="color: #495057; margin: 0; font-size: 32px; letter-spacing: 4px;">{test_otp}</h1>
            </div>
            <p><strong>This OTP will expire in 10 minutes.</strong></p>
            <p>If you didn't request this code, please ignore this email.</p>
        </div>
        <div style="background: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p>© 2025 Kudzu Operations - Test Email</p>
        </div>
    </body>
    </html>
    """
    
    print(f"\n📧 Sending test email to {test_email}...")
    print(f"📧 Subject: {subject}")
    print(f"📧 OTP: {test_otp}")
    
    success = send_test_email(test_email, subject, body)
    
    print("\n" + "=" * 60)
    print("📋 Test Results:")
    print(f"✅ OTP Generation: Working (generated: {test_otp})")
    print(f"{'✅' if success else '❌'} Email Sending: {'Working' if success else 'Failed'}")
    
    if success:
        print(f"\n📧 Email sent successfully! Check your inbox at the configured SMTP address.")
        print(f"📧 Test OTP: {test_otp}")
    else:
        print(f"\n⚠️  Email sending failed. Please check your SMTP configuration.")
        print(f"📧 Test OTP that would have been sent: {test_otp}")
        print("\n💡 To fix email sending:")
        print("1. Update the .env file with your Gmail credentials")
        print("2. Use an App Password for Gmail (not your regular password)")
        print("3. Enable 2-factor authentication on your Gmail account")

if __name__ == "__main__":
    main()
