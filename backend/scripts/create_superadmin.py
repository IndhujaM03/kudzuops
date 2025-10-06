#!/usr/bin/env python3
"""
Create super admin user with proper password hash
"""
import os
import sys
import hashlib
import secrets
import psycopg

def hash_password(password: str) -> str:
    """Generate PBKDF2 hash for password"""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 200000)
    return f"pbkdf2_sha256${salt}${dk.hex()}"

def main():
    # Database connection
    host = os.getenv("PGHOST", "127.0.0.1")
    port = int(os.getenv("PGPORT", "5432"))
    user = os.getenv("PGUSER", "postgres")
    password = os.getenv("PGPASSWORD", "")
    dbname = os.getenv("DB_NAME", "kudzuops")
    
    try:
        with psycopg.connect(host=host, port=port, user=user, password=password, dbname=dbname) as conn:
            with conn.cursor() as cur:
                # Add columns if they don't exist
                print("Adding approval and role columns...")
                cur.execute("""
                    ALTER TABLE IF EXISTS tbl_users
                    ADD COLUMN IF NOT EXISTS approval_status BOOLEAN DEFAULT FALSE,
                    ADD COLUMN IF NOT EXISTS approved_by BIGINT NULL,
                    ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'candidate'
                """)
                
                # Add FK constraint
                print("Adding foreign key constraint...")
                cur.execute("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.table_constraints
                            WHERE constraint_name = 'tbl_users_approved_by_fkey'
                        ) THEN
                            ALTER TABLE tbl_users
                            ADD CONSTRAINT tbl_users_approved_by_fkey
                            FOREIGN KEY (approved_by) REFERENCES tbl_users(id) ON DELETE SET NULL;
                        END IF;
                    END $$;
                """)
                
                # Create indexes
                print("Creating indexes...")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_tbl_users_approval_status ON tbl_users(approval_status)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_tbl_users_role ON tbl_users(role)")
                
                # Create super admin user
                admin_email = "admin@kudzu.com"
                admin_password = "admin123"
                password_hash = hash_password(admin_password)
                
                print(f"Creating super admin user: {admin_email}")
                cur.execute("""
                    INSERT INTO tbl_users (email, password_hash, is_verified, user_type, approval_status, role) 
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (email) DO UPDATE SET 
                        password_hash = EXCLUDED.password_hash,
                        role = EXCLUDED.role,
                        approval_status = EXCLUDED.approval_status,
                        is_verified = EXCLUDED.is_verified
                """, (admin_email, password_hash, True, "candidate", True, "super_admin"))
                
                conn.commit()
                
                # Verify creation
                cur.execute("SELECT id, email, role, approval_status, is_verified FROM tbl_users WHERE role = 'super_admin'")
                result = cur.fetchone()
                if result:
                    print(f"✅ Super admin created successfully:")
                    print(f"   ID: {result[0]}")
                    print(f"   Email: {result[1]}")
                    print(f"   Role: {result[2]}")
                    print(f"   Approved: {result[3]}")
                    print(f"   Verified: {result[4]}")
                    print(f"   Password: {admin_password}")
                else:
                    print("❌ Failed to create super admin")
                    return 1
                    
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    print("\n🎉 Super admin setup complete!")
    print("You can now login with:")
    print("  Email: admin@kudzu.com")
    print("  Password: admin123")
    return 0

if __name__ == "__main__":
    sys.exit(main())
