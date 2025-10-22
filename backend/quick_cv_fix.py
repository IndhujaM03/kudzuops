#!/usr/bin/env python3
"""
Quick fix to add proper CV data for testing CV Received and Submitted tabs
"""

import psycopg
import json
from datetime import datetime, date

# Database connection
DSN = "postgresql://postgres:indhuja@127.0.0.1:5432/kudzuops"

def add_quick_cv_data():
    """Add quick CV data for testing"""
    
    # CV data for CV Received tab (status = 0)
    cv_received_data = [
        {
            "candidate_name": "John Smith",
            "cv_url": "https://drive.google.com/file/d/1abc123/view",
            "upload_date": "2024-01-20",
            "status": 0,  # Waiting for approval
            "candidate_email": "john.smith@email.com",
            "candidate_phone": "+1-555-0101",
            "experience_years": 5,
            "skills": ["React", "Node.js", "MongoDB"]
        },
        {
            "candidate_name": "Sarah Johnson",
            "cv_url": "https://drive.google.com/file/d/1def456/view",
            "upload_date": "2024-01-21",
            "status": 0,  # Waiting for approval
            "candidate_email": "sarah.johnson@email.com",
            "candidate_phone": "+1-555-0102",
            "experience_years": 7,
            "skills": ["Java", "Spring Boot", "PostgreSQL"]
        }
    ]
    
    # CV data for Submitted tab (status = 1)
    cv_submitted_data = [
        {
            "candidate_name": "Mike Wilson",
            "cv_url": "https://drive.google.com/file/d/1ghi789/view",
            "upload_date": "2024-01-18",
            "status": 1,  # Already approved
            "candidate_email": "mike.wilson@email.com",
            "candidate_phone": "+1-555-0103",
            "experience_years": 6,
            "skills": ["Python", "Django", "AWS"]
        },
        {
            "candidate_name": "Lisa Brown",
            "cv_url": "https://drive.google.com/file/d/1jkl012/view",
            "upload_date": "2024-01-19",
            "status": 1,  # Already approved
            "candidate_email": "lisa.brown@email.com",
            "candidate_phone": "+1-555-0104",
            "experience_years": 4,
            "skills": ["Vue.js", "Express.js", "MySQL"]
        }
    ]
    
    try:
        with psycopg.connect(DSN) as conn:
            with conn.cursor() as cur:
                print("🚀 Adding quick CV test data...")
                
                # Clear existing test data
                cur.execute("DELETE FROM tbl_recruiter_activity WHERE cv_list IS NOT NULL")
                conn.commit()
                
                # Create demand for CV Received (status = 0)
                cur.execute("""
                    INSERT INTO tbl_demand_sheet (
                        demand_date, client_id, skill, no_of_positions, 
                        status, priority, required_cv_count, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    date.today(),
                    1,  # Use existing client
                    "Full Stack Developer",
                    2,
                    "open",
                    "medium",
                    2,
                    datetime.now()
                ))
                demand_id_1 = cur.fetchone()[0]
                
                # Create demand for Submitted (status = 1)
                cur.execute("""
                    INSERT INTO tbl_demand_sheet (
                        demand_date, client_id, skill, no_of_positions, 
                        status, priority, required_cv_count, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    date.today() - timedelta(days=1),
                    1,  # Use existing client
                    "Backend Developer",
                    2,
                    "closed",  # Closed because all CVs approved
                    "high",
                    2,
                    datetime.now() - timedelta(days=1)
                ))
                demand_id_2 = cur.fetchone()[0]
                
                # Create recruiter activity for CV Received
                cur.execute("""
                    INSERT INTO tbl_recruiter_activity (
                        recruiter_id, analysis_date, skill, cvs_sourced, 
                        calls_connected, recommended_profiles, client_id, 
                        demand_id, uploaded_cv_count, required_cv_count, 
                        cv_list, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    1,  # Use existing recruiter
                    date.today(),
                    "Full Stack Developer",
                    2,
                    5,
                    3,
                    1,
                    demand_id_1,
                    2,  # uploaded_cv_count
                    2,  # required_cv_count
                    json.dumps(cv_received_data),
                    datetime.now()
                ))
                
                # Create recruiter activity for Submitted
                cur.execute("""
                    INSERT INTO tbl_recruiter_activity (
                        recruiter_id, analysis_date, skill, cvs_sourced, 
                        calls_connected, recommended_profiles, client_id, 
                        demand_id, uploaded_cv_count, required_cv_count, 
                        cv_list, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    1,  # Use existing recruiter
                    date.today() - timedelta(days=1),
                    "Backend Developer",
                    2,
                    8,
                    4,
                    1,
                    demand_id_2,
                    2,  # uploaded_cv_count
                    2,  # required_cv_count
                    json.dumps(cv_submitted_data),
                    datetime.now() - timedelta(days=1)
                ))
                
                conn.commit()
                
                print("✅ Created CV Received data:")
                print(f"   📊 {len(cv_received_data)} CVs waiting for approval (status = 0)")
                for cv in cv_received_data:
                    print(f"   👤 {cv['candidate_name']} - {cv['skills']}")
                
                print("\n✅ Created Submitted data:")
                print(f"   📊 {len(cv_submitted_data)} CVs already approved (status = 1)")
                for cv in cv_submitted_data:
                    print(f"   👤 {cv['candidate_name']} - {cv['skills']}")
                
                # Verify the data
                cur.execute("""
                    SELECT 
                        ra.id, ra.demand_id, ra.uploaded_cv_count, ra.required_cv_count, 
                        ra.cv_list, ds.status as demand_status, ds.skill
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    WHERE ra.cv_list IS NOT NULL AND jsonb_array_length(ra.cv_list) > 0
                    ORDER BY ra.created_at DESC
                """)
                records = cur.fetchall()
                
                print(f"\n📊 Database Summary:")
                for record in records:
                    activity_id, demand_id, uploaded_count, required_count, cv_list, demand_status, skill = record
                    waiting_cvs = [cv for cv in cv_list if cv.get('status') == 0]
                    approved_cvs = [cv for cv in cv_list if cv.get('status') == 1]
                    
                    print(f"   📋 Activity ID: {activity_id}")
                    print(f"   📋 Demand ID: {demand_id}")
                    print(f"   📋 Skill: {skill}")
                    print(f"   📋 Demand Status: {demand_status}")
                    print(f"   📋 Uploaded: {uploaded_count}, Required: {required_count}")
                    print(f"   ⏳ Waiting CVs: {len(waiting_cvs)}")
                    print(f"   ✅ Approved CVs: {len(approved_cvs)}")
                    print()
                
    except Exception as e:
        print(f"❌ Error creating quick test data: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🧪 Creating quick CV test data...")
    success = add_quick_cv_data()
    if success:
        print("\n✅ Quick test data creation completed!")
        print("🚀 Now test the CV Received and Submitted tabs!")
        print("📱 Access: http://localhost:4200/teamleader/demand-sheet")
    else:
        print("❌ Failed to create quick test data.")


