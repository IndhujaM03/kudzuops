#!/usr/bin/env python3
"""
Test script to create dummy records for multiple recruiter CV management testing.
This script creates test data with the new JSON structure including candidate_id and remark fields.
"""

import os
import json
import psycopg
from datetime import datetime

# Database connection
DATABASE_DSN = os.getenv(
    "DATABASE_URL",
    "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
)

def create_test_data():
    """Create test data for multiple recruiter CV management"""
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                print("🔧 Creating test data for multiple recruiter CV management...")
                
                # 1. Create a test demand
                print("📝 Creating test demand...")
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
                print(f"✅ Created demand with ID: {demand_id}")
                
                # 2. Create test recruiters (if they don't exist)
                print("👥 Creating test recruiters...")
                
                # Recruiter 1
                cur.execute("""
                    INSERT INTO tbl_users (first_name, last_name, email, role, created_at, updated_at)
                    VALUES ('John', 'Doe', 'john.doe@example.com', 'recruiter', NOW(), NOW())
                    ON CONFLICT (email) DO NOTHING
                    RETURNING id
                """)
                recruiter1_id = cur.fetchone()
                if recruiter1_id:
                    recruiter1_id = recruiter1_id[0]
                else:
                    cur.execute("SELECT id FROM tbl_users WHERE email = 'john.doe@example.com'")
                    recruiter1_id = cur.fetchone()[0]
                print(f"✅ Recruiter 1 ID: {recruiter1_id}")
                
                # Recruiter 2
                cur.execute("""
                    INSERT INTO tbl_users (first_name, last_name, email, role, created_at, updated_at)
                    VALUES ('Jane', 'Smith', 'jane.smith@example.com', 'recruiter', NOW(), NOW())
                    ON CONFLICT (email) DO NOTHING
                    RETURNING id
                """)
                recruiter2_id = cur.fetchone()
                if recruiter2_id:
                    recruiter2_id = recruiter2_id[0]
                else:
                    cur.execute("SELECT id FROM tbl_users WHERE email = 'jane.smith@example.com'")
                    recruiter2_id = cur.fetchone()[0]
                print(f"✅ Recruiter 2 ID: {recruiter2_id}")
                
                # 3. Create recruiter activity records with new JSON structure
                print("📊 Creating recruiter activity records with new JSON structure...")
                
                # Recruiter 1 activity with CVs
                cv_list_recruiter1 = [
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
                    }
                ]
                
                cur.execute("""
                    INSERT INTO tbl_recruiter_activity (
                        recruiter_id, demand_id, analysis_date, uploaded_cv_count, 
                        required_cv_count, cv_list, activity_status, created_at, updated_at
                    ) VALUES (
                        %s, %s, CURRENT_DATE, %s, %s, %s, 0, NOW(), NOW()
                    )
                """, (
                    recruiter1_id, demand_id, len(cv_list_recruiter1), 3,
                    json.dumps(cv_list_recruiter1)
                ))
                print(f"✅ Created recruiter 1 activity with {len(cv_list_recruiter1)} CVs")
                
                # Recruiter 2 activity with CVs
                cv_list_recruiter2 = [
                    {
                        "candidate_name": "Charlie Brown",
                        "cv_url": "src/assets/cv_uploads/3/1/Charlie_Brown_CV.pdf",
                        "upload_date": "2024-01-17",
                        "status": 0,  # Waiting for approval
                        "candidate_email": "charlie.brown@email.com",
                        "candidate_phone": "+1234567892",
                        "candidate_id": "CAND_003",
                        "remark": "Senior developer with expertise in enterprise applications",
                        "skills": ["Java", "Spring Security", "Docker", "Kubernetes"]
                    },
                    {
                        "candidate_name": "Diana Prince",
                        "cv_url": "src/assets/cv_uploads/3/1/Diana_Prince_CV.pdf",
                        "upload_date": "2024-01-18",
                        "status": 1,  # Already approved
                        "candidate_email": "diana.prince@email.com",
                        "candidate_phone": "+1234567893",
                        "candidate_id": "CAND_004",
                        "remark": "Outstanding technical skills and leadership qualities",
                        "skills": ["Java", "Spring Cloud", "AWS", "MongoDB"]
                    }
                ]
                
                cur.execute("""
                    INSERT INTO tbl_recruiter_activity (
                        recruiter_id, demand_id, analysis_date, uploaded_cv_count, 
                        required_cv_count, cv_list, activity_status, created_at, updated_at
                    ) VALUES (
                        %s, %s, CURRENT_DATE, %s, %s, %s, 1, NOW(), NOW()
                    )
                """, (
                    recruiter2_id, demand_id, len(cv_list_recruiter2), 3,
                    json.dumps(cv_list_recruiter2)
                ))
                print(f"✅ Created recruiter 2 activity with {len(cv_list_recruiter2)} CVs")
                
                # 4. Update demand with assigned recruiters
                print("🔗 Assigning recruiters to demand...")
                cur.execute("""
                    UPDATE tbl_demand_sheet 
                    SET assigned_to = %s, recruiter_id = %s, updated_at = NOW()
                    WHERE id = %s
                """, (f"{{{recruiter1_id},{recruiter2_id}}}", recruiter1_id, demand_id))
                print(f"✅ Assigned recruiters {recruiter1_id} and {recruiter2_id} to demand {demand_id}")
                
                # 5. Display the created data
                print("\n📋 Created Test Data Summary:")
                print("=" * 50)
                
                # Show demand details
                cur.execute("""
                    SELECT ds.id, ds.skill, ds.required_cv_count, ds.status, 
                           c.client_name, cs.spoc_name
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ds.id = %s
                """, (demand_id,))
                demand_data = cur.fetchone()
                print(f"Demand ID: {demand_data[0]}")
                print(f"Skill: {demand_data[1]}")
                print(f"Required CV Count: {demand_data[2]}")
                print(f"Status: {demand_data[3]}")
                print(f"Client: {demand_data[4]}")
                print(f"SPOC: {demand_data[5]}")
                
                # Show recruiter activities
                cur.execute("""
                    SELECT ra.id, ra.recruiter_id, ra.uploaded_cv_count, ra.activity_status,
                           u.first_name, u.last_name, u.email
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    WHERE ra.demand_id = %s
                    ORDER BY ra.recruiter_id
                """, (demand_id,))
                activities = cur.fetchall()
                
                print(f"\nRecruiter Activities ({len(activities)} records):")
                for activity in activities:
                    print(f"  Activity ID: {activity[0]}")
                    print(f"  Recruiter: {activity[4]} {activity[5]} ({activity[6]})")
                    print(f"  Uploaded CVs: {activity[2]}")
                    print(f"  Activity Status: {activity[3]}")
                    print()
                
                # Show CV details
                cur.execute("""
                    SELECT ra.recruiter_id, ra.cv_list, u.first_name, u.last_name
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    WHERE ra.demand_id = %s
                    ORDER BY ra.recruiter_id
                """, (demand_id,))
                cv_data = cur.fetchall()
                
                print("CV Details:")
                for recruiter_id, cv_list, first_name, last_name in cv_data:
                    print(f"\n  Recruiter: {first_name} {last_name} (ID: {recruiter_id})")
                    if cv_list:
                        cv_array = json.loads(cv_list) if isinstance(cv_list, str) else cv_list
                        for i, cv in enumerate(cv_array, 1):
                            print(f"    CV {i}:")
                            print(f"      Candidate: {cv.get('candidate_name', 'N/A')}")
                            print(f"      Candidate ID: {cv.get('candidate_id', 'N/A')}")
                            print(f"      Status: {cv.get('status', 'N/A')}")
                            print(f"      Remark: {cv.get('remark', 'N/A')}")
                            print(f"      Skills: {', '.join(cv.get('skills', []))}")
                            print(f"      Email: {cv.get('candidate_email', 'N/A')}")
                
                conn.commit()
                print(f"\n✅ Test data created successfully!")
                print(f"📊 Demand ID: {demand_id}")
                print(f"👥 Recruiters: {recruiter1_id}, {recruiter2_id}")
                print(f"📄 Total CVs: {len(cv_list_recruiter1) + len(cv_list_recruiter2)}")
                print(f"🎯 Ready for testing multiple recruiter CV management!")
                
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        raise

if __name__ == "__main__":
    create_test_data()

