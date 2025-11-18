#!/usr/bin/env python3
"""
Extract current database schema to generate proper migration files.
This script connects to the database and extracts:
- All tables
- All columns with datatypes, defaults, constraints
- Foreign keys
- Indexes
"""

import os
import sys
import json
import psycopg
from dotenv import load_dotenv, find_dotenv
from pathlib import Path
from datetime import datetime

# Load environment variables
load_dotenv(find_dotenv(), override=False)

def get_dsn() -> str:
    """Get database connection string."""
    host = os.getenv("DB_HOST")
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASS")
    port = os.getenv("DB_PORT", "5432")
    
    if host and name and user and password:
        return f"host={host} port={port} dbname={name} user={user} password={password}"
    
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/kudzu_operations",
    )
    return database_url


def extract_schema():
    """Extract complete database schema."""
    dsn = get_dsn()
    schema = {
        "extracted_at": datetime.now().isoformat(),
        "database": None,
        "enums": [],
        "tables": [],
        "foreign_keys": [],
        "indexes": []
    }
    
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                # Get database name
                cur.execute("SELECT current_database()")
                schema["database"] = cur.fetchone()[0]
                
                # Extract enums
                cur.execute("""
                    SELECT t.typname, 
                           array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
                    FROM pg_type t 
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    GROUP BY t.typname
                    ORDER BY t.typname;
                """)
                for row in cur.fetchall():
                    schema["enums"].append({
                        "name": row[0],
                        "values": row[1]
                    })
                
                # Extract tables
                cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                    ORDER BY table_name;
                """)
                tables = [row[0] for row in cur.fetchall()]
                
                for table_name in tables:
                    # Extract columns
                    cur.execute("""
                        SELECT 
                            column_name,
                            data_type,
                            udt_name,
                            character_maximum_length,
                            is_nullable,
                            column_default,
                            is_identity,
                            identity_generation
                        FROM information_schema.columns
                        WHERE table_schema = 'public' 
                        AND table_name = %s
                        ORDER BY ordinal_position;
                    """, (table_name,))
                    
                    columns = []
                    for col in cur.fetchall():
                        col_info = {
                            "name": col[0],
                            "data_type": col[1],
                            "udt_name": col[2],
                            "max_length": col[3],
                            "nullable": col[4] == "YES",
                            "default": col[5],
                            "is_identity": col[6] == "YES",
                            "identity_generation": col[7]
                        }
                        columns.append(col_info)
                    
                    # Extract constraints
                    cur.execute("""
                        SELECT 
                            tc.constraint_name,
                            tc.constraint_type,
                            kcu.column_name
                        FROM information_schema.table_constraints tc
                        LEFT JOIN information_schema.key_column_usage kcu
                            ON tc.constraint_name = kcu.constraint_name
                            AND tc.table_schema = kcu.table_schema
                        WHERE tc.table_schema = 'public'
                        AND tc.table_name = %s
                        ORDER BY tc.constraint_type, tc.constraint_name;
                    """, (table_name,))
                    
                    constraints = {}
                    for const in cur.fetchall():
                        const_name = const[0]
                        const_type = const[1]
                        col_name = const[2]
                        
                        if const_name not in constraints:
                            constraints[const_name] = {
                                "type": const_type,
                                "columns": []
                            }
                        if col_name:
                            constraints[const_name]["columns"].append(col_name)
                    
                    # Extract primary key
                    primary_key = None
                    for const_name, const_info in constraints.items():
                        if const_info["type"] == "PRIMARY KEY":
                            primary_key = const_info["columns"]
                            break
                    
                    table_info = {
                        "name": table_name,
                        "columns": columns,
                        "primary_key": primary_key,
                        "constraints": constraints
                    }
                    schema["tables"].append(table_info)
                
                # Extract foreign keys
                cur.execute("""
                    SELECT
                        tc.table_name,
                        kcu.column_name,
                        ccu.table_name AS foreign_table_name,
                        ccu.column_name AS foreign_column_name,
                        tc.constraint_name,
                        rc.update_rule,
                        rc.delete_rule
                    FROM information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                    JOIN information_schema.referential_constraints AS rc
                        ON rc.constraint_name = tc.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = 'public'
                    ORDER BY tc.table_name, kcu.column_name;
                """)
                
                for fk in cur.fetchall():
                    schema["foreign_keys"].append({
                        "table": fk[0],
                        "column": fk[1],
                        "references_table": fk[2],
                        "references_column": fk[3],
                        "constraint_name": fk[4],
                        "on_update": fk[5],
                        "on_delete": fk[6]
                    })
                
                # Extract indexes
                cur.execute("""
                    SELECT
                        tablename,
                        indexname,
                        indexdef
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                    AND indexname NOT LIKE '%_pkey'
                    ORDER BY tablename, indexname;
                """)
                
                for idx in cur.fetchall():
                    schema["indexes"].append({
                        "table": idx[0],
                        "name": idx[1],
                        "definition": idx[2]
                    })
                
                return schema
                
    except Exception as e:
        print(f"Error extracting schema: {e}", file=sys.stderr)
        sys.exit(1)


def generate_schema_sql(schema: dict) -> str:
    """Generate SQL from extracted schema."""
    sql_parts = []
    
    sql_parts.append("-- ==============================================")
    sql_parts.append("-- EXTRACTED DATABASE SCHEMA")
    sql_parts.append(f"-- Extracted at: {schema['extracted_at']}")
    sql_parts.append(f"-- Database: {schema['database']}")
    sql_parts.append("-- ==============================================\n")
    
    # Create enums
    if schema["enums"]:
        sql_parts.append("-- ENUMS")
        sql_parts.append("-- ==============================================")
        for enum in schema["enums"]:
            values = "', '".join(enum["values"])
            sql_parts.append(f"""
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{enum["name"]}') THEN
        CREATE TYPE {enum["name"]} AS ENUM ('{values}');
    END IF;
END $$;
""")
        sql_parts.append("")
    
    # Create tables
    sql_parts.append("-- TABLES")
    sql_parts.append("-- ==============================================")
    for table in schema["tables"]:
        sql_parts.append(f"\n-- Table: {table['name']}")
        sql_parts.append(f"CREATE TABLE IF NOT EXISTS {table['name']} (")
        
        col_defs = []
        for col in table["columns"]:
            col_def = f"    {col['name']} "
            
            # Data type
            if col["udt_name"] in ["varchar", "char", "text"]:
                if col["max_length"]:
                    col_def += f"{col['udt_name'].upper()}({col['max_length']})"
                else:
                    col_def += "TEXT"
            elif col["udt_name"] == "int4":
                col_def += "INTEGER"
            elif col["udt_name"] == "int8":
                col_def += "BIGINT"
            elif col["udt_name"] == "bool":
                col_def += "BOOLEAN"
            elif col["udt_name"] == "timestamptz":
                col_def += "TIMESTAMPTZ"
            elif col["udt_name"] == "date":
                col_def += "DATE"
            elif col["udt_name"] == "jsonb":
                col_def += "JSONB"
            elif col["udt_name"] == "numeric":
                col_def += "NUMERIC"
            elif col["udt_name"] in ["serial", "bigserial"]:
                col_def += col["udt_name"].upper()
            else:
                col_def += col["udt_name"].upper()
            
            # Not null
            if not col["nullable"]:
                col_def += " NOT NULL"
            
            # Default
            if col["default"]:
                col_def += f" DEFAULT {col['default']}"
            
            col_defs.append(col_def)
        
        sql_parts.append(",\n".join(col_defs))
        
        # Primary key
        if table["primary_key"]:
            pk_cols = ", ".join(table["primary_key"])
            sql_parts.append(f",\n    PRIMARY KEY ({pk_cols})")
        
        sql_parts.append(");\n")
    
    # Foreign keys
    if schema["foreign_keys"]:
        sql_parts.append("-- FOREIGN KEYS")
        sql_parts.append("-- ==============================================")
        for fk in schema["foreign_keys"]:
            on_update = f" ON UPDATE {fk['on_update']}" if fk['on_update'] != "NO ACTION" else ""
            on_delete = f" ON DELETE {fk['on_delete']}" if fk['on_delete'] != "NO ACTION" else ""
            sql_parts.append(f"""
ALTER TABLE {fk['table']}
    ADD CONSTRAINT {fk['constraint_name']}
    FOREIGN KEY ({fk['column']})
    REFERENCES {fk['references_table']}({fk['references_column']}){on_update}{on_delete};
""")
    
    # Indexes
    if schema["indexes"]:
        sql_parts.append("-- INDEXES")
        sql_parts.append("-- ==============================================")
        for idx in schema["indexes"]:
            # Extract CREATE INDEX statement from definition
            idx_def = idx["definition"]
            sql_parts.append(f"{idx_def};")
    
    return "\n".join(sql_parts)


if __name__ == "__main__":
    print("Extracting database schema...")
    schema = extract_schema()
    
    # Save as JSON
    output_dir = Path(__file__).parent.parent / "migrations"
    output_dir.mkdir(exist_ok=True)
    
    json_path = output_dir / "extracted_schema.json"
    with open(json_path, "w") as f:
        json.dump(schema, f, indent=2)
    print(f"Schema saved to: {json_path}")
    
    # Generate SQL
    sql = generate_schema_sql(schema)
    sql_path = output_dir / "101_extracted_schema.sql"
    with open(sql_path, "w") as f:
        f.write(sql)
    print(f"SQL schema saved to: {sql_path}")
    
    print(f"\nExtracted {len(schema['tables'])} tables, {len(schema['enums'])} enums, {len(schema['foreign_keys'])} foreign keys, {len(schema['indexes'])} indexes")

