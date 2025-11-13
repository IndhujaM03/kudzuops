#!/usr/bin/env python3
"""
Simple Database Dump Script for Kudzu Operations
Creates a simple SQL dump with just the data
"""

import os
import psycopg
from datetime import datetime

# Database connection
DATABASE_DSN = "postgresql://postgres:indhuja@127.0.0.1:5432/kudzuops"

def create_simple_dump():
    """Create a simple SQL dump with just the data"""
    dump_file = "kudzu_simple_dump.sql"
    
    print("🗄️ Creating simple database dump...")
    print(f"📁 Output file: {dump_file}")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                with open(dump_file, 'w', encoding='utf-8') as f:
                    f.write("-- Kudzu Operations - Simple Database Dump\n")
                    f.write(f"-- Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                    
                    # Get all tables
                    cur.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        ORDER BY table_name
                    """)
                    tables = [row[0] for row in cur.fetchall()]
                    
                    print(f"📋 Processing {len(tables)} tables...")
                    
                    for table in tables:
                        print(f"📊 Processing table: {table}")
                        f.write(f"-- Table: {table}\n")
                        
                        # Get data
                        cur.execute(f"SELECT * FROM {table}")
                        rows = cur.fetchall()
                        column_names = [desc[0] for desc in cur.description]
                        
                        if rows:
                            f.write(f"-- {len(rows)} rows\n")
                            for row in rows:
                                values = []
                                for value in row:
                                    if value is None:
                                        values.append("NULL")
                                    elif isinstance(value, str):
                                        escaped = value.replace("'", "''")
                                        values.append(f"'{escaped}'")
                                    else:
                                        values.append(f"'{value}'")
                                
                                f.write(f"INSERT INTO {table} ({', '.join(column_names)}) VALUES ({', '.join(values)});\n")
                        else:
                            f.write("-- No data\n")
                        f.write("\n")
                
                print(f"✅ Simple dump created: {dump_file}")
                
                # Get file size
                file_size = os.path.getsize(dump_file)
                print(f"📁 File size: {file_size / 1024:.2f} KB")
                
                return dump_file
                
    except Exception as e:
        print(f"❌ Error creating simple dump: {e}")
        return None

if __name__ == "__main__":
    print("🚀 Kudzu Simple Database Dump Tool")
    print("=" * 50)
    
    dump_file = create_simple_dump()
    
    if dump_file:
        print(f"\n✅ Simple database dump completed!")
        print(f"📁 File: {dump_file}")
    else:
        print("\n❌ Failed to create simple dump")
