#!/usr/bin/env python3
"""
Simple test script to create dummy CV data with the new JSON structure.
This script creates test data directly in the database for testing the multiple recruiter CV management.
"""

import os
import json
import psycopg
from datetime import datetime

# Use the same database connection as the main app
try:
    from app.config import settings
    DATABASE_DSN = settings.database_url
except Exception:
    # Fallback to environment variable
    DATABASE_DSN = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
    )

def create_test_cv_data():
    """Create test CV data with new JSON structure"""
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                print("🔧 Creating test CV data with new JSON structure...")
                
                # 1. Get or create a test demand
                print("📝 Getting/Creating test demand...")
                cur.execute("""
                    SELECT id FROM tbl_demand_sheet 
                    WHERE skill LIKE '%Java%' OR skill LIKE '%Developer%' 
                    ORDER BY id DESC LIMIT 1
                """)
                demand_result = cur.fetchone()
                
                if demand_result:
                    demand_id = demand_result[0]
                    print(f"✅ Using existing demand ID: {demand_id}")
                else:
                    # Create a new demand
                    cur.execute("""
                        INSERT INTO tbl_demand_sheet (
                            demand_date, client_id, spoc_id, skill, no_of_positions, 
                            required_cv_count, priority, job_description_url, remarks, 
                            status, created_at, updated_at
                        ) VALUES (
                            CURRENT_DATE, 1, 1, 'Java Developer', 2, 3, 'high', 
                            'https://example.com/jd.pdf', 'Test demand for multiple recruiters',
                            'open', NOW(), NOW()
                        ) RETURNING id
                    """)
                    demand_id = cur.fetchone()[0]
                    print(f"✅ Created new demand with ID: {demand_id}")
                
                # 2. Get or create test recruiters
                print("👥 Getting/Creating test recruiters...")
                
                # Recruiter 1
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE email = 'john.doe@example.com' OR first_name = 'John'
                    LIMIT 1
                """)
                recruiter1_result = cur.fetchone()
                if recruiter1_result:
                    recruiter1_id = recruiter1_result[0]
                else:
                    cur.execute("""
                        INSERT INTO tbl_users (first_name, last_name, email, role, created_at, updated_at)
                        VALUES ('John', 'Doe', 'john.doe@example.com', 'recruiter', NOW(), NOW())
                        RETURNING id
                    """)
                    recruiter1_id = cur.fetchone()[0]
                print(f"✅ Recruiter 1 ID: {recruiter1_id}")
                
                # Recruiter 2
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE email = 'jane.smith@example.com' OR first_name = 'Jane'
                    LIMIT 1
                """)
                recruiter2_result = cur.fetchone()
                if recruiter2_result:
                    recruiter2_id = recruiter2_result[0]
                else:
                    cur.execute("""
                        INSERT INTO tbl_users (first_name, last_name, email, role, created_at, updated_at)
                        VALUES ('Jane', 'Smith', 'jane.smith@example.com', 'recruiter', NOW(), NOW())
                        RETURNING id
                    """)
                    recruiter2_id = cur.fetchone()[0]
                print(f"✅ Recruiter 2 ID: {recruiter2_id}")
                
                # 3. Create test CV data with new JSON structure
                print("📊 Creating test CV data with new JSON structure...")
                
                # Test CV data with new structure
                test_cv_data = [
                    {
                        "candidate_name": "Alice Johnson",
                        "cv_url": "src/assets/cv_uploads/3/1/Alice_Johnson_CV.pdf",
                        "upload_date": "2024-01-15",
                        "status": 0,  # Waiting for approval
                        "candidate_email": "alice.johnson@email.com",
                        "candidate_phone": "+1234567890",
                        "candidate_id": "CAND_001",
                        "remark": "Strong Java background with 5+ years experience in Spring Boot",
                        "skills": ["Java", "Spring Boot", "Microservices", "MySQL"]
                    },
                    {
                        "candidate_name": "Bob Wilson",
                        "cv_url": "src/assets/cv_uploads/3/1/Bob_Wilson_CV.pdf",
                        "upload_date": "2024-01-16",
                        "status": 0,  # Waiting for approval
                        "candidate_email": "bob.wilson@email.com",
                        "candidate_phone": "+1234567891",
                        "candidate_id": "CAND_002",
                        "remark": "Excellent problem-solving skills and team player",
                        "skills": ["Java", "React", "JavaScript", "PostgreSQL"]
                    },
                    {
                        "candidate_name": "Charlie Brown",
                        "cv_url": "src/assets/cv_uploads/3/1/Charlie_Brown_CV.pdf",
                        "upload_date": "2024-01-17",
                        "status": 1,  # Already approved
                        "candidate_email": "charlie.brown@email.com",
                        "candidate_phone": "+1234567892",
                        "candidate_id": "CAND_003",
                        "remark": "Senior developer with expertise in enterprise applications",
                        "skills": ["Java", "Spring Security", "Docker", "Kubernetes"]
                    }
                ]
                
                # 4. Create or update recruiter activity with new JSON structure
                print("📋 Creating/updating recruiter activity with new JSON structure...")
                
                # Check if activity already exists
                cur.execute("""
                    SELECT id, cv_list FROM tbl_recruiter_activity 
                    WHERE recruiter_id = %s AND demand_id = %s
                """, (recruiter1_id, demand_id))
                existing_activity = cur.fetchone()
                
                if existing_activity:
                    activity_id, existing_cv_list = existing_activity
                    # Update existing activity with new JSON structure
                    cur.execute("""
                        UPDATE tbl_recruiter_activity 
                        SET cv_list = %s, uploaded_cv_count = %s, updated_at = NOW()
                        WHERE id = %s
                    """, (json.dumps(test_cv_data), len(test_cv_data), activity_id))
                    print(f"✅ Updated existing activity ID: {activity_id}")
                else:
                    # Create new activity
                    cur.execute("""
                        INSERT INTO tbl_recruiter_activity (
                            recruiter_id, demand_id, analysis_date, uploaded_cv_count, 
                            required_cv_count, cv_list, activity_status, created_at, updated_at
                        ) VALUES (
                            %s, %s, CURRENT_DATE, %s, %s, %s, 0, NOW(), NOW()
                        ) RETURNING id
                    """, (
                        recruiter1_id, demand_id, len(test_cv_data), 3,
                        json.dumps(test_cv_data)
                    ))
                    activity_id = cur.fetchone()[0]
                    print(f"✅ Created new activity ID: {activity_id}")
                
                # 5. Display the created data
                print("\n📋 Test Data Summary:")
                print("=" * 50)
                print(f"Demand ID: {demand_id}")
                print(f"Recruiter ID: {recruiter1_id}")
                print(f"Activity ID: {activity_id}")
                print(f"Total CVs: {len(test_cv_data)}")
                
                print("\n📄 CV Details:")
                for i, cv in enumerate(test_cv_data, 1):
                    print(f"  CV {i}:")
                    print(f"    Candidate: {cv['candidate_name']}")
                    print(f"    Candidate ID: {cv['candidate_id']}")
                    print(f"    Status: {cv['status']} ({'Waiting' if cv['status'] == 0 else 'Approved' if cv['status'] == 1 else 'Rejected'})")
                    print(f"    Remark: {cv['remark']}")
                    print(f"    Skills: {', '.join(cv['skills'])}")
                    print(f"    Email: {cv['candidate_email']}")
                    print()
                
                # 6. Test the new API endpoints
                print("🧪 Testing new JSON structure...")
                
                # Test query to verify the data
                cur.execute("""
                    SELECT cv_list FROM tbl_recruiter_activity 
                    WHERE id = %s
                """, (activity_id,))
                stored_cv_list = cur.fetchone()[0]
                
                if stored_cv_list:
                    parsed_cv_list = json.loads(stored_cv_list) if isinstance(stored_cv_list, str) else stored_cv_list
                    print(f"✅ JSON data stored successfully with {len(parsed_cv_list)} CVs")
                    
                    # Verify candidate_id and remark fields
                    for cv in parsed_cv_list:
                        if 'candidate_id' in cv and 'remark' in cv:
                            print(f"  ✅ CV {cv['candidate_id']}: {cv['candidate_name']} - {cv['remark']}")
                        else:
                            print(f"  ❌ Missing candidate_id or remark in CV")
                
                conn.commit()
                print(f"\n✅ Test data created successfully!")
                print(f"🎯 Ready for testing multiple recruiter CV management!")
                print(f"📊 You can now test the CV approval/rejection APIs with candidate_id")
                
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_test_cv_data()

