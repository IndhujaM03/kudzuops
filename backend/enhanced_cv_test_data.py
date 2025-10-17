#!/usr/bin/env python3
"""
Enhanced test script to populate comprehensive CV data for testing the CV Received functionality
"""

import psycopg
import json
from datetime import datetime, date, timedelta
import random

# Database connection
DSN = "postgresql://postgres:indhuja@127.0.0.1:5432/kudzuops"

def create_enhanced_cv_data():
    """Create comprehensive CV data with multiple recruiters and demands"""
    
    # Enhanced CV data with more variety
    cv_data_sets = [
        {
            "recruiter_name": "Sarah Wilson",
            "client_name": "TechCorp Solutions",
            "skill": "Full Stack Developer",
            "demand_id": None,  # Will be created
            "cvs": [
                {
                    "candidate_name": "Alex Rodriguez",
                    "cv_url": "https://drive.google.com/file/d/1abc123/view?usp=sharing",
                    "upload_date": "2024-01-20",
                    "status": 0,  # Waiting for approval
                    "candidate_email": "alex.rodriguez@email.com",
                    "candidate_phone": "+1-555-0101",
                    "experience_years": 6,
                    "skills": ["React", "Node.js", "TypeScript", "AWS"]
                },
                {
                    "candidate_name": "Maria Garcia",
                    "cv_url": "https://drive.google.com/file/d/1def456/view?usp=sharing",
                    "upload_date": "2024-01-21",
                    "status": 0,  # Waiting for approval
                    "candidate_email": "maria.garcia@email.com",
                    "candidate_phone": "+1-555-0102",
                    "experience_years": 4,
                    "skills": ["Vue.js", "Python", "Django", "PostgreSQL"]
                }
            ]
        },
        {
            "recruiter_name": "David Chen",
            "client_name": "FinanceFlow Inc",
            "skill": "Java Developer",
            "demand_id": None,
            "cvs": [
                {
                    "candidate_name": "James Thompson",
                    "cv_url": "https://drive.google.com/file/d/1ghi789/view?usp=sharing",
                    "upload_date": "2024-01-22",
                    "status": 0,  # Waiting for approval
                    "candidate_email": "james.thompson@email.com",
                    "candidate_phone": "+1-555-0103",
                    "experience_years": 8,
                    "skills": ["Java", "Spring Boot", "Microservices", "Kubernetes"]
                },
                {
                    "candidate_name": "Lisa Wang",
                    "cv_url": "https://drive.google.com/file/d/1jkl012/view?usp=sharing",
                    "upload_date": "2024-01-23",
                    "status": 0,  # Waiting for approval
                    "candidate_email": "lisa.wang@email.com",
                    "candidate_phone": "+1-555-0104",
                    "experience_years": 5,
                    "skills": ["Java", "Spring Security", "Hibernate", "MySQL"]
                },
                {
                    "candidate_name": "Robert Kim",
                    "cv_url": "https://drive.google.com/file/d/1mno345/view?usp=sharing",
                    "upload_date": "2024-01-24",
                    "status": 1,  # Already approved
                    "candidate_email": "robert.kim@email.com",
                    "candidate_phone": "+1-555-0105",
                    "experience_years": 7,
                    "skills": ["Java", "Spring Cloud", "Docker", "Redis"]
                }
            ]
        },
        {
            "recruiter_name": "Emily Johnson",
            "client_name": "HealthTech Systems",
            "skill": "Python Developer",
            "demand_id": None,
            "cvs": [
                {
                    "candidate_name": "Michael Brown",
                    "cv_url": "https://drive.google.com/file/d/1pqr678/view?usp=sharing",
                    "upload_date": "2024-01-25",
                    "status": 0,  # Waiting for approval
                    "candidate_email": "michael.brown@email.com",
                    "candidate_phone": "+1-555-0106",
                    "experience_years": 9,
                    "skills": ["Python", "Django", "FastAPI", "PostgreSQL", "Docker"]
                },
                {
                    "candidate_name": "Jennifer Davis",
                    "cv_url": "https://drive.google.com/file/d/1stu901/view?usp=sharing",
                    "upload_date": "2024-01-26",
                    "status": 0,  # Waiting for approval
                    "candidate_email": "jennifer.davis@email.com",
                    "candidate_phone": "+1-555-0107",
                    "experience_years": 3,
                    "skills": ["Python", "Flask", "SQLAlchemy", "MongoDB"]
                }
            ]
        },
        {
            "recruiter_name": "Mark Anderson",
            "client_name": "E-Commerce Plus",
            "skill": "React Developer",
            "demand_id": None,
            "cvs": [
                {
                    "candidate_name": "Sarah Lee",
                    "cv_url": "https://drive.google.com/file/d/1vwx234/view?usp=sharing",
                    "upload_date": "2024-01-27",
                    "status": 0,  # Waiting for approval
                    "candidate_email": "sarah.lee@email.com",
                    "candidate_phone": "+1-555-0108",
                    "experience_years": 4,
                    "skills": ["React", "Redux", "TypeScript", "Jest", "Webpack"]
                }
            ]
        }
    ]
    
    try:
        with psycopg.connect(DSN) as conn:
            with conn.cursor() as cur:
                print("🚀 Creating enhanced CV test data...")
                
                # Clear existing test data
                cur.execute("DELETE FROM tbl_recruiter_activity WHERE cv_list IS NOT NULL")
                cur.execute("DELETE FROM tbl_demand_sheet WHERE id > 10")  # Keep original data
                conn.commit()
                
                # Create clients if they don't exist
                clients = [
                    ("TechCorp Solutions", "Technology", "San Francisco, CA"),
                    ("FinanceFlow Inc", "Finance", "New York, NY"),
                    ("HealthTech Systems", "Healthcare", "Boston, MA"),
                    ("E-Commerce Plus", "Retail", "Seattle, WA")
                ]
                
                client_ids = []
                for client_name, industry, location in clients:
                    cur.execute("""
                        INSERT INTO tbl_clients (client_name, industry, location, is_active)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (client_name) DO NOTHING
                        RETURNING id
                    """, (client_name, industry, location, True))
                    result = cur.fetchone()
                    if result:
                        client_ids.append(result[0])
                    else:
                        # Get existing client ID
                        cur.execute("SELECT id FROM tbl_clients WHERE client_name = %s", (client_name,))
                        client_ids.append(cur.fetchone()[0])
                
                # Create recruiters if they don't exist
                recruiters = [
                    ("Sarah", "Wilson", "sarah.wilson@company.com"),
                    ("David", "Chen", "david.chen@company.com"),
                    ("Emily", "Johnson", "emily.johnson@company.com"),
                    ("Mark", "Anderson", "mark.anderson@company.com")
                ]
                
                recruiter_ids = []
                for first_name, last_name, email in recruiters:
                    cur.execute("""
                        INSERT INTO tbl_users (first_name, last_name, email, role, is_active)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (email) DO NOTHING
                        RETURNING id
                    """, (first_name, last_name, email, "recruiter", True))
                    result = cur.fetchone()
                    if result:
                        recruiter_ids.append(result[0])
                    else:
                        # Get existing recruiter ID
                        cur.execute("SELECT id FROM tbl_users WHERE email = %s", (email,))
                        recruiter_ids.append(cur.fetchone()[0])
                
                # Create demands and recruiter activities
                for i, data_set in enumerate(cv_data_sets):
                    # Create demand
                    cur.execute("""
                        INSERT INTO tbl_demand_sheet (
                            demand_date, client_id, skill, no_of_positions, 
                            status, priority, required_cv_count, created_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        date.today() - timedelta(days=random.randint(1, 10)),
                        client_ids[i],
                        data_set["skill"],
                        len(data_set["cvs"]),
                        "open",
                        random.choice(["low", "medium", "high"]),
                        len(data_set["cvs"]),
                        datetime.now() - timedelta(days=random.randint(1, 10))
                    ))
                    demand_id = cur.fetchone()[0]
                    
                    # Count waiting CVs
                    waiting_cvs = [cv for cv in data_set["cvs"] if cv["status"] == 0]
                    approved_cvs = [cv for cv in data_set["cvs"] if cv["status"] == 1]
                    
                    # Create recruiter activity
                    cur.execute("""
                        INSERT INTO tbl_recruiter_activity (
                            recruiter_id, analysis_date, skill, cvs_sourced, 
                            calls_connected, recommended_profiles, client_id, 
                            demand_id, uploaded_cv_count, required_cv_count, 
                            cv_list, created_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        recruiter_ids[i],
                        date.today() - timedelta(days=random.randint(1, 5)),
                        data_set["skill"],
                        len(data_set["cvs"]),
                        random.randint(5, 15),
                        random.randint(2, 8),
                        client_ids[i],
                        demand_id,
                        len(data_set["cvs"]),
                        len(data_set["cvs"]),
                        json.dumps(data_set["cvs"]),
                        datetime.now() - timedelta(days=random.randint(1, 5))
                    ))
                    
                    print(f"✅ Created demand for {data_set['client_name']} - {data_set['skill']}")
                    print(f"   📊 {len(waiting_cvs)} CVs waiting for approval")
                    print(f"   📊 {len(approved_cvs)} CVs already approved")
                    print(f"   👤 Recruiter: {data_set['recruiter_name']}")
                    print()
                
                conn.commit()
                
                # Verify the data
                cur.execute("""
                    SELECT 
                        ra.id, ra.recruiter_id, ra.demand_id, ra.uploaded_cv_count, 
                        ra.required_cv_count, ra.cv_list, ra.created_at,
                        u.first_name || ' ' || u.last_name as recruiter_name,
                        ds.skill, c.client_name
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE ra.cv_list IS NOT NULL AND jsonb_array_length(ra.cv_list) > 0
                    ORDER BY ra.created_at DESC
                """)
                records = cur.fetchall()
                
                print(f"📊 Enhanced CV Test Data Summary:")
                print(f"   🎯 Total Recruiter Activities: {len(records)}")
                
                total_waiting = 0
                total_approved = 0
                for record in records:
                    activity_id, recruiter_id, demand_id, uploaded_count, required_count, cv_list, created_at, recruiter_name, skill, client_name = record
                    waiting_cvs = [cv for cv in cv_list if cv.get('status') == 0]
                    approved_cvs = [cv for cv in cv_list if cv.get('status') == 1]
                    total_waiting += len(waiting_cvs)
                    total_approved += len(approved_cvs)
                    
                    print(f"   📋 {client_name} - {skill}")
                    print(f"      👤 Recruiter: {recruiter_name}")
                    print(f"      ⏳ Waiting: {len(waiting_cvs)} CVs")
                    print(f"      ✅ Approved: {len(approved_cvs)} CVs")
                    print(f"      📅 Created: {created_at.strftime('%Y-%m-%d %H:%M')}")
                    print()
                
                print(f"🎯 Total CVs waiting for approval: {total_waiting}")
                print(f"🎯 Total CVs already approved: {total_approved}")
                print(f"🎯 Total CVs in system: {total_waiting + total_approved}")
                
    except Exception as e:
        print(f"❌ Error creating enhanced test data: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🧪 Creating enhanced CV test data for comprehensive testing...")
    success = create_enhanced_cv_data()
    if success:
        print("\n✅ Enhanced test data creation completed successfully!")
        print("🚀 You can now test the CV Received tab with realistic data!")
        print("📱 Access: http://localhost:4200/teamleader/demand-sheet")
    else:
        print("❌ Failed to create enhanced test data.")
