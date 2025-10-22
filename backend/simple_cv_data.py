#!/usr/bin/env python3
import psycopg
import json
from datetime import datetime, date

DSN = "postgresql://postgres:indhuja@127.0.0.1:5432/kudzuops"

def add_simple_data():
    # CV Received data (status = 0)
    cv_received = [
        {
            "candidate_name": "John Doe",
            "cv_url": "https://example.com/cv1.pdf",
            "upload_date": "2024-01-20",
            "status": 0,
            "candidate_email": "john@email.com",
            "candidate_phone": "+1234567890",
            "experience_years": 5,
            "skills": ["React", "Node.js"]
        }
    ]
    
    # Submitted data (status = 1)
    cv_submitted = [
        {
            "candidate_name": "Jane Smith",
            "cv_url": "https://example.com/cv2.pdf",
            "upload_date": "2024-01-19",
            "status": 1,
            "candidate_email": "jane@email.com",
            "candidate_phone": "+1234567891",
            "experience_years": 7,
            "skills": ["Java", "Spring"]
        }
    ]
    
    try:
        with psycopg.connect(DSN) as conn:
            with conn.cursor() as cur:
                # Clear existing
                cur.execute("DELETE FROM tbl_recruiter_activity WHERE cv_list IS NOT NULL")
                
                # Add CV Received data
                cur.execute("""
                    INSERT INTO tbl_recruiter_activity (
                        recruiter_id, analysis_date, skill, cvs_sourced, 
                        calls_connected, recommended_profiles, client_id, 
                        demand_id, uploaded_cv_count, required_cv_count, cv_list
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    1, date.today(), "Full Stack", 1, 3, 1, 1, 1, 1, 1, json.dumps(cv_received)
                ))
                
                # Add Submitted data
                cur.execute("""
                    INSERT INTO tbl_recruiter_activity (
                        recruiter_id, analysis_date, skill, cvs_sourced, 
                        calls_connected, recommended_profiles, client_id, 
                        demand_id, uploaded_cv_count, required_cv_count, cv_list
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    1, date.today(), "Backend", 1, 5, 2, 1, 1, 1, 1, json.dumps(cv_submitted)
                ))
                
                conn.commit()
                print("✅ Added 2 CV records:")
                print("   📊 1 CV waiting for approval (status = 0)")
                print("   📊 1 CV already approved (status = 1)")
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    add_simple_data()
