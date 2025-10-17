#!/usr/bin/env python3
"""
Simple script to add test CV data with new JSON structure to existing records.
This script updates existing recruiter activity records with the new JSON format.
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

def add_test_cv_json():
    """Add test CV data with new JSON structure to existing records"""
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                print("🔧 Adding test CV data with new JSON structure...")
                
                # 1. Get existing demand and recruiter activity
                print("📝 Getting existing demand and activity records...")
                cur.execute("""
                    SELECT ra.id, ra.recruiter_id, ra.demand_id, ra.cv_list, ra.uploaded_cv_count,
                           ds.skill, ds.required_cv_count,
                           u.first_name, u.last_name, u.email
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    WHERE ra.cv_list IS NOT NULL
                    ORDER BY ra.id DESC
                    LIMIT 1
                """)
                existing_activity = cur.fetchone()
                
                if not existing_activity:
                    print("❌ No existing recruiter activity found. Please create some data first.")
                    return
                
                activity_id, recruiter_id, demand_id, existing_cv_list, uploaded_count, skill, required_count, first_name, last_name, email = existing_activity
                print(f"✅ Found activity ID: {activity_id}")
                print(f"   Recruiter: {first_name} {last_name} ({email})")
                print(f"   Demand: {skill} (Required: {required_count})")
                print(f"   Current CVs: {uploaded_count}")
                
                # 2. Create test CV data with new JSON structure
                print("📊 Creating test CV data with new JSON structure...")
                
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
                
                # 3. Update the existing activity with new JSON structure
                print("📋 Updating activity with new JSON structure...")
                
                cur.execute("""
                    UPDATE tbl_recruiter_activity 
                    SET cv_list = %s, uploaded_cv_count = %s, updated_at = NOW()
                    WHERE id = %s
                """, (json.dumps(test_cv_data), len(test_cv_data), activity_id))
                
                print(f"✅ Updated activity ID: {activity_id} with {len(test_cv_data)} CVs")
                
                # 4. Display the updated data
                print("\n📋 Updated Test Data Summary:")
                print("=" * 50)
                print(f"Activity ID: {activity_id}")
                print(f"Recruiter: {first_name} {last_name} ({email})")
                print(f"Demand: {skill}")
                print(f"Total CVs: {len(test_cv_data)}")
                
                print("\n📄 CV Details with New Structure:")
                for i, cv in enumerate(test_cv_data, 1):
                    print(f"  CV {i}:")
                    print(f"    Candidate: {cv['candidate_name']}")
                    print(f"    Candidate ID: {cv['candidate_id']}")
                    print(f"    Status: {cv['status']} ({'Waiting' if cv['status'] == 0 else 'Approved' if cv['status'] == 1 else 'Rejected'})")
                    print(f"    Remark: {cv['remark']}")
                    print(f"    Skills: {', '.join(cv['skills'])}")
                    print(f"    Email: {cv['candidate_email']}")
                    print(f"    Phone: {cv['candidate_phone']}")
                    print()
                
                # 5. Verify the data was stored correctly
                print("🧪 Verifying stored data...")
                cur.execute("""
                    SELECT cv_list FROM tbl_recruiter_activity 
                    WHERE id = %s
                """, (activity_id,))
                stored_cv_list = cur.fetchone()[0]
                
                if stored_cv_list:
                    parsed_cv_list = json.loads(stored_cv_list) if isinstance(stored_cv_list, str) else stored_cv_list
                    print(f"✅ JSON data stored successfully with {len(parsed_cv_list)} CVs")
                    
                    # Verify new fields
                    for cv in parsed_cv_list:
                        if 'candidate_id' in cv and 'remark' in cv:
                            print(f"  ✅ CV {cv['candidate_id']}: {cv['candidate_name']} - {cv['remark']}")
                        else:
                            print(f"  ❌ Missing candidate_id or remark in CV")
                
                # 6. Test the new API structure
                print("\n🔍 Testing API structure...")
                print("You can now test these API endpoints:")
                print(f"  GET /cv-received - Should show CVs with status=0")
                print(f"  GET /cv-submitted - Should show CVs with status=1")
                print(f"  POST /cv-approve/{activity_id}?cv_id=CAND_001 - Approve CV by candidate_id")
                print(f"  POST /cv-reject/{activity_id}?cv_id=CAND_002 - Reject CV by candidate_id")
                
                conn.commit()
                print(f"\n✅ Test data added successfully!")
                print(f"🎯 Ready for testing multiple recruiter CV management!")
                print(f"📊 Activity ID {activity_id} now has {len(test_cv_data)} CVs with new JSON structure")
                
    except Exception as e:
        print(f"❌ Error adding test data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    add_test_cv_json()

