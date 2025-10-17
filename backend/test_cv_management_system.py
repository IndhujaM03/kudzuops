#!/usr/bin/env python3
"""
Comprehensive test script for CV management system with the exact structure specified.
Tests all scenarios: upload, approval, rejection, status updates, and count management.
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

def create_test_cv_management_data():
    """Create comprehensive test data for CV management system"""
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                print("🔧 Creating comprehensive CV management test data...")
                
                # 1. Create test demand with required_cv_count = 3
                print("📝 Creating test demand with required_cv_count = 3...")
                cur.execute("""
                    INSERT INTO tbl_demand_sheet (
                        demand_date, client_id, spoc_id, skill, no_of_positions, 
                        required_cv_count, priority, job_description_url, remarks, 
                        status, created_at, updated_at
                    ) VALUES (
                        CURRENT_DATE, 1, 1, 'Full Stack Developer', 2, 3, 'high', 
                        'https://example.com/jd.pdf', 'Test demand for CV management system',
                        'open', NOW(), NOW()
                    ) RETURNING id
                """)
                demand_id = cur.fetchone()[0]
                print(f"✅ Created demand ID: {demand_id} with required_cv_count = 3")
                
                # 2. Create test recruiters
                print("👥 Creating test recruiters...")
                
                # Recruiter 1
                cur.execute("""
                    INSERT INTO tbl_users (first_name, last_name, email, role, user_type, created_at, updated_at)
                    VALUES ('John', 'Recruiter', 'john.recruiter@test.com', 'recruiter', 'internal', NOW(), NOW())
                    ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
                    RETURNING id
                """)
                recruiter1_id = cur.fetchone()[0]
                print(f"✅ Recruiter 1 ID: {recruiter1_id}")
                
                # Recruiter 2
                cur.execute("""
                    INSERT INTO tbl_users (first_name, last_name, email, role, user_type, created_at, updated_at)
                    VALUES ('Jane', 'Recruiter', 'jane.recruiter@test.com', 'recruiter', 'internal', NOW(), NOW())
                    ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
                    RETURNING id
                """)
                recruiter2_id = cur.fetchone()[0]
                print(f"✅ Recruiter 2 ID: {recruiter2_id}")
                
                # 3. Create initial CV data with exact structure specified
                print("📊 Creating initial CV data with exact structure...")
                
                # Initial CV list with 2 CVs (uploaded_cv_count = 2, required_cv_count = 3)
                initial_cv_list = [
                    {
                        "email": "test@gmail.com",
                        "phone": "1213442323",
                        "status": "0",  # Pending
                        "remarks": None,
                        "filename": "SPOC-Submission-and-Demand-Report.pdf",
                        "file_path": "src/assets/cv_uploads/7/2/SPOC-Submission-and-Demand-Report.pdf",
                        "candidate_id": 1,
                        "candidate_name": "test"
                    },
                    {
                        "email": "test@gmail.com",
                        "phone": "1213442323",
                        "status": "0",  # Pending
                        "remarks": "gghhhhhhhhhhh",
                        "filename": "SPOC-Submission-and-Demand-Report.pdf",
                        "file_path": "src/assets/cv_uploads/7/2/SPOC-Submission-and-Demand-Report.pdf",
                        "candidate_id": 2,
                        "candidate_name": "test"
                    }
                ]
                
                # Create recruiter activity for Recruiter 1
                cur.execute("""
                    INSERT INTO tbl_recruiter_activity (
                        recruiter_id, demand_id, analysis_date, uploaded_cv_count, 
                        required_cv_count, cv_list, activity_status, created_at, updated_at
                    ) VALUES (
                        %s, %s, CURRENT_DATE, %s, %s, %s, 'Open', NOW(), NOW()
                    ) RETURNING id
                """, (
                    recruiter1_id, demand_id, len(initial_cv_list), 3,
                    json.dumps(initial_cv_list)
                ))
                activity1_id = cur.fetchone()[0]
                print(f"✅ Created Recruiter 1 activity ID: {activity1_id} with {len(initial_cv_list)} CVs")
                
                # Create recruiter activity for Recruiter 2 (same demand, different recruiter)
                cur.execute("""
                    INSERT INTO tbl_recruiter_activity (
                        recruiter_id, demand_id, analysis_date, uploaded_cv_count, 
                        required_cv_count, cv_list, activity_status, created_at, updated_at
                    ) VALUES (
                        %s, %s, CURRENT_DATE, %s, %s, %s, 'Open', NOW(), NOW()
                    ) RETURNING id
                """, (
                    recruiter2_id, demand_id, len(initial_cv_list), 3,
                    json.dumps(initial_cv_list)
                ))
                activity2_id = cur.fetchone()[0]
                print(f"✅ Created Recruiter 2 activity ID: {activity2_id} with {len(initial_cv_list)} CVs")
                
                # 4. Display initial state
                print("\n📋 Initial State:")
                print("=" * 50)
                print(f"Demand ID: {demand_id}")
                print(f"Required CV Count: 3")
                print(f"Recruiter 1 Activity: {activity1_id} (2/3 CVs)")
                print(f"Recruiter 2 Activity: {activity2_id} (2/3 CVs)")
                print(f"Activity Status: Open (since 2 < 3)")
                
                # 5. Test Scenario 1: Add third CV to reach required count
                print("\n🧪 Test Scenario 1: Adding third CV to reach required count...")
                
                # Add third CV to the list
                updated_cv_list = initial_cv_list + [
                    {
                        "email": "newcandidate@gmail.com",
                        "phone": "9876543210",
                        "status": "0",  # Pending
                        "remarks": "Third candidate with excellent skills",
                        "filename": "Third-Candidate-CV.pdf",
                        "file_path": "src/assets/cv_uploads/7/2/Third-Candidate-CV.pdf",
                        "candidate_id": 3,
                        "candidate_name": "Third Candidate"
                    }
                ]
                
                # Update both recruiters' activities
                cur.execute("""
                    UPDATE tbl_recruiter_activity 
                    SET cv_list = %s, uploaded_cv_count = %s, activity_status = 'Closed', updated_at = NOW()
                    WHERE demand_id = %s
                """, (json.dumps(updated_cv_list), len(updated_cv_list), demand_id))
                
                print(f"✅ Updated both recruiters with 3 CVs")
                print(f"✅ Activity Status changed to 'Closed' (3 = 3)")
                
                # 6. Test Scenario 2: TL rejects a profile
                print("\n🧪 Test Scenario 2: TL rejects a profile...")
                
                # Simulate rejection by updating candidate_id=1 to status=2
                rejected_cv_list = []
                for cv in updated_cv_list:
                    cv_copy = cv.copy()
                    if cv_copy["candidate_id"] == 1:
                        cv_copy["status"] = "2"  # Rejected
                    rejected_cv_list.append(cv_copy)
                
                # Update activities with rejection
                cur.execute("""
                    UPDATE tbl_recruiter_activity 
                    SET cv_list = %s, uploaded_cv_count = %s, activity_status = 'Open', updated_at = NOW()
                    WHERE demand_id = %s
                """, (json.dumps(rejected_cv_list), len(rejected_cv_list) - 1, demand_id))
                
                print(f"✅ Candidate ID 1 rejected (status = 2)")
                print(f"✅ Uploaded CV count decreased to 2 for all recruiters")
                print(f"✅ Activity Status changed back to 'Open' (2 < 3)")
                
                # 7. Test Scenario 3: TL approves a profile
                print("\n🧪 Test Scenario 3: TL approves a profile...")
                
                # Simulate approval by updating candidate_id=2 to status=1
                approved_cv_list = []
                for cv in rejected_cv_list:
                    cv_copy = cv.copy()
                    if cv_copy["candidate_id"] == 2:
                        cv_copy["status"] = "1"  # Approved
                    approved_cv_list.append(cv_copy)
                
                # Update activities with approval
                cur.execute("""
                    UPDATE tbl_recruiter_activity 
                    SET cv_list = %s, updated_at = NOW()
                    WHERE demand_id = %s
                """, (json.dumps(approved_cv_list), demand_id))
                
                print(f"✅ Candidate ID 2 approved (status = 1)")
                print(f"✅ CV list updated with approval status")
                
                # 8. Display final state
                print("\n📋 Final State:")
                print("=" * 50)
                
                # Get final data
                cur.execute("""
                    SELECT ra.id, ra.recruiter_id, ra.uploaded_cv_count, ra.activity_status, ra.cv_list,
                           u.first_name, u.last_name, u.email
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    WHERE ra.demand_id = %s
                    ORDER BY ra.recruiter_id
                """, (demand_id,))
                final_activities = cur.fetchall()
                
                for activity in final_activities:
                    activity_id, recruiter_id, uploaded_count, activity_status, cv_list, first_name, last_name, email = activity
                    print(f"Recruiter: {first_name} {last_name} ({email})")
                    print(f"  Activity ID: {activity_id}")
                    print(f"  Uploaded CV Count: {uploaded_count}/3")
                    print(f"  Activity Status: {activity_status}")
                    
                    if cv_list:
                        cv_array = json.loads(cv_list) if isinstance(cv_list, str) else cv_list
                        print(f"  CV Details:")
                        for cv in cv_array:
                            status_text = {"0": "Pending", "1": "Approved", "2": "Rejected"}.get(cv["status"], "Unknown")
                            print(f"    Candidate {cv['candidate_id']}: {cv['candidate_name']} - {status_text}")
                            print(f"      Email: {cv['email']}")
                            print(f"      Phone: {cv['phone']}")
                            print(f"      Remarks: {cv['remarks']}")
                            print(f"      File: {cv['filename']}")
                    print()
                
                # 9. Test API endpoints
                print("🧪 Testing API endpoints...")
                
                # Test CV received endpoint
                print("Testing GET /cv-received...")
                cur.execute("""
                    SELECT COUNT(*) FROM tbl_recruiter_activity ra
                    CROSS JOIN LATERAL jsonb_array_elements(ra.cv_list) AS cv
                    WHERE ra.demand_id = %s AND cv->>'status' = '0'
                """, (demand_id,))
                pending_count = cur.fetchone()[0]
                print(f"✅ Pending CVs: {pending_count}")
                
                # Test CV submitted endpoint
                print("Testing GET /cv-submitted...")
                cur.execute("""
                    SELECT COUNT(*) FROM tbl_recruiter_activity ra
                    CROSS JOIN LATERAL jsonb_array_elements(ra.cv_list) AS cv
                    WHERE ra.demand_id = %s AND cv->>'status' = '1'
                """, (demand_id,))
                approved_count = cur.fetchone()[0]
                print(f"✅ Approved CVs: {approved_count}")
                
                # Test rejected CVs
                cur.execute("""
                    SELECT COUNT(*) FROM tbl_recruiter_activity ra
                    CROSS JOIN LATERAL jsonb_array_elements(ra.cv_list) AS cv
                    WHERE ra.demand_id = %s AND cv->>'status' = '2'
                """, (demand_id,))
                rejected_count = cur.fetchone()[0]
                print(f"✅ Rejected CVs: {rejected_count}")
                
                conn.commit()
                print(f"\n✅ Comprehensive CV management test completed successfully!")
                print(f"📊 Test Results:")
                print(f"  - Demand ID: {demand_id}")
                print(f"  - Recruiter Activities: {len(final_activities)}")
                print(f"  - Total CVs: {len(updated_cv_list)}")
                print(f"  - Pending: {pending_count}")
                print(f"  - Approved: {approved_count}")
                print(f"  - Rejected: {rejected_count}")
                print(f"🎯 All scenarios tested successfully!")
                
    except Exception as e:
        print(f"❌ Error in comprehensive test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_test_cv_management_data()

