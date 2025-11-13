#!/usr/bin/env python3
"""
Database setup script for Kudzu Operations
Creates all necessary tables and inserts initial data
"""

import os
import psycopg
from dotenv import load_dotenv, find_dotenv

# Load environment variables
load_dotenv(find_dotenv(), override=False)

# Database connection
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:indhuja@127.0.0.1:5432/kudzuops",
)

def setup_database():
    """Set up the complete database schema"""
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                print("Setting up database schema...")
                
                # Create enums
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type_enum') THEN
                            CREATE TYPE user_type_enum AS ENUM ('candidate', 'recruiter', 'hiring_manager', 'admin');
                        END IF;
                    END $$;
                """)
                
                # Create roles table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_roles (
                        id BIGSERIAL PRIMARY KEY,
                        role_name TEXT NOT NULL,
                        role_key TEXT NOT NULL UNIQUE,
                        description TEXT,
                        permissions JSONB,
                        is_default BOOLEAN NOT NULL DEFAULT FALSE,
                        is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """)
                
                # Create users table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_users (
                        id BIGSERIAL PRIMARY KEY,
                        first_name TEXT,
                        last_name TEXT,
                        email TEXT UNIQUE,
                        phone_number TEXT,
                        password_hash TEXT,
                        user_type TEXT NOT NULL DEFAULT 'candidate',
                        role VARCHAR(50) NOT NULL DEFAULT 'candidate',
                        approval_status BOOLEAN NOT NULL DEFAULT FALSE,
                        approved_by BIGINT,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """)
                
                # Create clients table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_clients (
                        id SERIAL PRIMARY KEY,
                        client_name VARCHAR(255) NOT NULL,
                        client_code VARCHAR(50),
                        industry VARCHAR(100),
                        email VARCHAR(255),
                        contact_person VARCHAR(255),
                        location VARCHAR(255),
                        created_at TIMESTAMP DEFAULT now(),
                        updated_at TIMESTAMP DEFAULT now()
                    );
                """)
                
                # Create demand sheet table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_demand_sheet (
                        id SERIAL PRIMARY KEY,
                        demand_date DATE DEFAULT CURRENT_DATE,
                        client_id INTEGER REFERENCES tbl_clients(id),
                        job_title VARCHAR(255),
                        job_description TEXT,
                        job_description_url TEXT,
                        skill VARCHAR(255),
                        no_of_positions INTEGER DEFAULT 1,
                        priority VARCHAR(50) DEFAULT 'medium',
                        status VARCHAR(50) DEFAULT 'open',
                        experience_level VARCHAR(100),
                        location VARCHAR(255),
                        salary_range VARCHAR(255),
                        assigned_to JSONB DEFAULT '[]'::jsonb,
                        required_cv_count INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT now(),
                        updated_at TIMESTAMP DEFAULT now()
                    );
                """)
                
                # Create recruiter activity table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_recruiter_activity (
                        id BIGSERIAL PRIMARY KEY,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        recruiter_id INTEGER REFERENCES tbl_users(id),
                        demand_id INTEGER REFERENCES tbl_demand_sheet(id),
                        activity_type VARCHAR(50) DEFAULT 'cv_upload',
                        status VARCHAR(50) DEFAULT 'active',
                        notes TEXT,
                        cv_list JSONB DEFAULT '[]'::jsonb,
                        uploaded_cv_count INTEGER DEFAULT 0,
                        demand_id_ref INTEGER REFERENCES tbl_demand_sheet(id)
                    );
                """)
                
                # Create CV uploads table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_cv_uploads (
                        id SERIAL PRIMARY KEY,
                        recruiter_id INTEGER REFERENCES tbl_users(id),
                        demand_id INTEGER REFERENCES tbl_demand_sheet(id),
                        file_name VARCHAR(255),
                        file_path TEXT,
                        file_size INTEGER,
                        upload_date TIMESTAMP DEFAULT now(),
                        status VARCHAR(50) DEFAULT 'uploaded'
                    );
                """)
                
                # Create candidate submissions table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_candidate_submissions (
                        id SERIAL PRIMARY KEY,
                        demand_id INTEGER REFERENCES tbl_demand_sheet(id),
                        recruiter_id INTEGER REFERENCES tbl_users(id),
                        candidate_name VARCHAR(255),
                        candidate_email VARCHAR(255),
                        candidate_phone VARCHAR(50),
                        resume_url TEXT,
                        status VARCHAR(32) DEFAULT 'submitted',
                        notes TEXT,
                        created_at TIMESTAMP DEFAULT now(),
                        updated_at TIMESTAMP DEFAULT now()
                    );
                """)
                
                # Create OTPs table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_otps (
                        id BIGSERIAL PRIMARY KEY,
                        email VARCHAR(255) NOT NULL,
                        purpose VARCHAR(50) NOT NULL,
                        code VARCHAR(10) NOT NULL,
                        expires_at TIMESTAMPTZ NOT NULL,
                        used_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """)
                
                # Insert default roles
                cur.execute("""
                    INSERT INTO tbl_roles (role_name, role_key, description, is_system_role, is_active)
                    VALUES 
                        ('Super Admin', 'superadmin', 'System administrator with full access', TRUE, TRUE),
                        ('Team Leader', 'teamleader', 'Team leader with management access', TRUE, TRUE),
                        ('Recruiter', 'recruiter', 'Recruiter with standard access', TRUE, TRUE),
                        ('Candidate', 'candidate', 'Candidate user', TRUE, TRUE)
                    ON CONFLICT (role_key) DO NOTHING;
                """)
                
                # Insert default users
                cur.execute("""
                    INSERT INTO tbl_users (first_name, last_name, email, password_hash, user_type, role, approval_status, is_active, is_verified)
                    VALUES 
                        ('Admin', 'User', 'admin@kudzu.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4.8K2W', 'admin', 'superadmin', TRUE, TRUE, TRUE),
                        ('Team', 'Leader', 'teamleader@kudzu.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4.8K2W', 'hiring_manager', 'teamleader', TRUE, TRUE, TRUE),
                        ('Test', 'Recruiter', 'recruiter@kudzu.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4.8K2W', 'recruiter', 'recruiter', TRUE, TRUE, TRUE)
                    ON CONFLICT (email) DO NOTHING;
                """)
                
                # Insert sample clients
                cur.execute("""
                    INSERT INTO tbl_clients (client_name, client_code, industry, email, contact_person, location)
                    VALUES 
                        ('TechCorp Solutions', 'TC001', 'Technology', 'contact@techcorp.com', 'John Smith', 'San Francisco'),
                        ('FinanceFirst Inc', 'FF001', 'Finance', 'hr@financefirst.com', 'Sarah Johnson', 'New York'),
                        ('HealthTech Systems', 'HT001', 'Healthcare', 'careers@healthtech.com', 'Mike Davis', 'Boston')
                    ON CONFLICT DO NOTHING;
                """)
                
                conn.commit()
                print("✅ Database setup completed successfully!")
                
                # Verify setup
                cur.execute("SELECT COUNT(*) FROM tbl_users")
                user_count = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM tbl_roles")
                role_count = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM tbl_clients")
                client_count = cur.fetchone()[0]
                
                print(f"📊 Database contains:")
                print(f"   - {user_count} users")
                print(f"   - {role_count} roles")
                print(f"   - {client_count} clients")
                
    except Exception as e:
        print(f"❌ Database setup failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = setup_database()
    if success:
        print("\n🎉 Database is ready for Kudzu Operations!")
        print("Default login credentials:")
        print("  - Super Admin: admin@kudzu.com / admin123")
        print("  - Team Leader: teamleader@kudzu.com / teamleader123")
        print("  - Recruiter: recruiter@kudzu.com / recruiter123")
    else:
        print("\n💥 Database setup failed!")
        exit(1)
