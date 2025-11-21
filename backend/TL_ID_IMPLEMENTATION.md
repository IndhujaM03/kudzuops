# Team Leader ID Implementation for Demand Creation

## Overview
This implementation adds automatic Team Leader ID assignment during demand creation and provides a script to update existing records.

## Changes Made

### 1. Database Schema Update
**Migration File:** `backend/migrations/026_add_tl_id_to_demand_sheet.sql`

- Added `tl_id` column (BIGINT, nullable) to `tbl_demand_sheet` table
- Added foreign key constraint linking `tl_id` to `tbl_users(id)`
- Added index for better query performance

**To apply the migration:**
```bash
# Run the migration SQL file against your database
psql -U your_user -d kudzuops -f backend/migrations/026_add_tl_id_to_demand_sheet.sql
```

### 2. Demand Creation Logic Updates

#### Updated Files:
- `backend/app/routes/demand_sheet.py`
- `backend/app/demand_enhanced.py`

**Changes:**
- Added `_get_team_leader_id()` helper function that:
  - Queries `tbl_users` table for users with role `'team_leader'` or `'tl'`
  - Filters for active and approved users (`is_active = TRUE` and `approval_status = TRUE`)
  - Returns the first Team Leader ID found (ordered by ID ASC)

- Updated both demand creation endpoints:
  - `/api/demand/create` (in `demand_sheet.py`)
  - `/api/demand` (POST endpoint in `demand_enhanced.py`)
  
  Both endpoints now:
  1. Fetch the Team Leader ID before inserting the demand
  2. Include `tl_id` in the INSERT statement
  3. Automatically assign the Team Leader ID to new demands

### 3. Script to Update Existing Records

**File:** `backend/scripts/update_existing_demands_with_tl_id.py`

This script updates all existing demand records that don't have a `tl_id` value.

**Features:**
- Checks if `tl_id` column exists (requires migration to be run first)
- Fetches the Team Leader ID from `tbl_users`
- Updates all records where `tl_id IS NULL`
- Provides detailed progress and error messages

**Usage:**
```bash
cd backend
python scripts/update_existing_demands_with_tl_id.py
```

**Requirements:**
- Migration 026 must be applied first
- At least one active Team Leader user must exist in `tbl_users` with:
  - `role IN ('team_leader', 'tl')`
  - `is_active = TRUE`
  - `approval_status = TRUE`

## Implementation Details

### Team Leader Selection Logic
The system selects the Team Leader using the following criteria:
1. Role must be `'team_leader'` or `'tl'`
2. User must be active (`is_active = TRUE`)
3. User must be approved (`approval_status = TRUE`)
4. If multiple Team Leaders match, selects the one with the lowest ID (first created)

### Error Handling
- If no Team Leader is found during demand creation, `tl_id` will be set to `NULL`
- The script will fail gracefully if no Team Leader exists, providing clear error messages
- Foreign key constraint ensures `tl_id` references a valid user ID

## Testing

### Test Migration
```sql
-- Verify column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tbl_demand_sheet' 
AND column_name = 'tl_id';

-- Verify foreign key constraint
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'tbl_demand_sheet' 
AND constraint_name = 'tbl_demand_sheet_tl_id_fkey';
```

### Test Demand Creation
1. Create a new demand through the API
2. Verify that `tl_id` is automatically populated:
```sql
SELECT id, client_id, tl_id, created_at 
FROM tbl_demand_sheet 
ORDER BY created_at DESC 
LIMIT 1;
```

### Test Script
Run the update script and verify:
```sql
-- Check how many records were updated
SELECT COUNT(*) as total_demands,
       COUNT(tl_id) as demands_with_tl_id,
       COUNT(*) - COUNT(tl_id) as demands_without_tl_id
FROM tbl_demand_sheet;
```

## Notes

- The `tl_id` column is nullable, so existing functionality will not break if no Team Leader is found
- The system assumes there is at least one Team Leader in the system
- If multiple Team Leaders exist, the system will use the first one (lowest ID)
- Future enhancements could include:
  - Support for multiple Team Leaders per demand
  - Team Leader assignment based on demand attributes (client, skill, etc.)
  - Manual override of Team Leader assignment


