#!/usr/bin/env python3
"""
Database Dump Script for Kudzu Operations
Creates a comprehensive SQL dump file with all data and schema
"""

import os
import psycopg
from datetime import datetime
import json

# Database connection
DATABASE_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:indhuja@127.0.0.1:5432/kudzuops")

def create_database_dump():
    """Create a comprehensive database dump file"""
    dump_file = "kudzu_database_complete_dump.sql"
    
    print("🗄️ Creating comprehensive database dump...")
    print(f"📁 Output file: {dump_file}")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Start the dump file
                with open(dump_file, 'w', encoding='utf-8') as f:
                    f.write("-- Kudzu Operations Database Dump\n")
                    f.write(f"-- Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                    f.write("-- Database: kudzuops\n")
                    f.write("-- Purpose: Complete database backup for easy restoration\n\n")
                    
                    f.write("-- ==============================================\n")
                    f.write("-- SCHEMA CREATION\n")
                    f.write("-- ==============================================\n\n")
                    
                    # Get all tables
                    cur.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        ORDER BY table_name
                    """)
                    tables = [row[0] for row in cur.fetchall()]
                    
                    print(f"📋 Found {len(tables)} tables: {tables}")
                    
                    # For each table, get structure and data
                    for table in tables:
                        print(f"📊 Processing table: {table}")
                        
                        # Get table structure
                        cur.execute(f"""
                            SELECT column_name, data_type, is_nullable, column_default
                            FROM information_schema.columns 
                            WHERE table_name = '{table}' 
                            ORDER BY ordinal_position
                        """)
                        columns = cur.fetchall()
                        
                        f.write(f"-- Table: {table}\n")
                        f.write(f"-- Columns: {len(columns)}\n")
                        f.write(f"CREATE TABLE IF NOT EXISTS {table} (\n")
                        
                        column_definitions = []
                        for col in columns:
                            col_name, data_type, is_nullable, col_default = col
                            nullable = "NULL" if is_nullable == "YES" else "NOT NULL"
                            default = f" DEFAULT {col_default}" if col_default else ""
                            column_definitions.append(f"    {col_name} {data_type}{default} {nullable}")
                        
                        f.write(",\n".join(column_definitions))
                        f.write("\n);\n\n")
                        
                        # Get table data
                        cur.execute(f"SELECT COUNT(*) FROM {table}")
                        row_count = cur.fetchone()[0]
                        
                        if row_count > 0:
                            f.write(f"-- Data for table: {table} ({row_count} rows)\n")
                            
                            # Get all data
                            cur.execute(f"SELECT * FROM {table}")
                            rows = cur.fetchall()
                            
                            # Get column names
                            column_names = [desc[0] for desc in cur.description]
                            
                            # Insert data
                            for row in rows:
                                values = []
                                for i, value in enumerate(row):
                                    if value is None:
                                        values.append("NULL")
                                    elif isinstance(value, str):
                                        # Escape single quotes
                                        escaped_value = value.replace("'", "''")
                                        values.append(f"'{escaped_value}'")
                                    elif isinstance(value, (int, float)):
                                        values.append(str(value))
                                    elif isinstance(value, bool):
                                        values.append("TRUE" if value else "FALSE")
                                    else:
                                        # For other types, convert to string and escape
                                        escaped_value = str(value).replace("'", "''")
                                        values.append(f"'{escaped_value}'")
                                
                                f.write(f"INSERT INTO {table} ({', '.join(column_names)}) VALUES ({', '.join(values)});\n")
                            
                            f.write("\n")
                        else:
                            f.write(f"-- No data in table: {table}\n\n")
                    
                    # Add sequences and indexes information
                    f.write("-- ==============================================\n")
                    f.write("-- SEQUENCES AND INDEXES\n")
                    f.write("-- ==============================================\n\n")
                    
                    # Get sequences
                    cur.execute("""
                        SELECT sequence_name, start_value, minimum_value, maximum_value, increment
                        FROM information_schema.sequences
                        WHERE sequence_schema = 'public'
                    """)
                    sequences = cur.fetchall()
                    
                    if sequences:
                        f.write("-- Sequences\n")
                        for seq in sequences:
                            seq_name, start_val, min_val, max_val, increment = seq
                            f.write(f"-- Sequence: {seq_name}\n")
                            f.write(f"-- Start: {start_val}, Min: {min_val}, Max: {max_val}, Increment: {increment}\n")
                        f.write("\n")
                    
                    # Get indexes
                    cur.execute("""
                        SELECT indexname, indexdef
                        FROM pg_indexes
                        WHERE schemaname = 'public'
                        ORDER BY tablename, indexname
                    """)
                    indexes = cur.fetchall()
                    
                    if indexes:
                        f.write("-- Indexes\n")
                        for idx in indexes:
                            idx_name, idx_def = idx
                            f.write(f"-- {idx_name}\n")
                            f.write(f"{idx_def};\n\n")
                    
                    f.write("-- ==============================================\n")
                    f.write("-- DUMP COMPLETE\n")
                    f.write("-- ==============================================\n")
                    f.write(f"-- Total tables processed: {len(tables)}\n")
                    f.write(f"-- Dump completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                
                print(f"✅ Database dump created successfully: {dump_file}")
                print(f"📊 Total tables: {len(tables)}")
                
                # Get file size
                file_size = os.path.getsize(dump_file)
                print(f"📁 File size: {file_size / 1024 / 1024:.2f} MB")
                
                return dump_file
                
    except Exception as e:
        print(f"❌ Error creating database dump: {e}")
        return None

def create_simple_dump():
    """Create a simpler SQL dump with just the essential data"""
    dump_file = "kudzu_simple_dump.sql"
    
    print("🗄️ Creating simple database dump...")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                with open(dump_file, 'w', encoding='utf-8') as f:
                    f.write("-- Kudzu Operations - Simple Database Dump\n")
                    f.write(f"-- Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                    
                    # Get all tables and their data
                    cur.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        ORDER BY table_name
                    """)
                    tables = [row[0] for row in cur.fetchall()]
                    
                    for table in tables:
                        f.write(f"-- Table: {table}\n")
                        
                        # Get data
                        cur.execute(f"SELECT * FROM {table}")
                        rows = cur.fetchall()
                        column_names = [desc[0] for desc in cur.description]
                        
                        if rows:
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
                        f.write("\n")
                
                print(f"✅ Simple dump created: {dump_file}")
                return dump_file
                
    except Exception as e:
        print(f"❌ Error creating simple dump: {e}")
        return None

if __name__ == "__main__":
    print("🚀 Kudzu Database Dump Tool")
    print("=" * 50)
    
    # Create comprehensive dump
    dump_file = create_database_dump()
    
    if dump_file:
        print(f"\n✅ Database dump completed successfully!")
        print(f"📁 File: {dump_file}")
        print(f"📋 To restore this database:")
        print(f"   psql -h localhost -U kudzuops -d kudzuops -f {dump_file}")
    else:
        print("\n❌ Failed to create database dump")
