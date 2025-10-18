-- Check assigned_to data format
SELECT id, assigned_to, status, client_id 
FROM tbl_demand_sheet 
WHERE assigned_to IS NOT NULL 
ORDER BY id DESC 
LIMIT 10;

-- Check if recruiter 4 has any assigned demands using different methods
-- Method 1: JSON query
SELECT COUNT(*) as json_count 
FROM tbl_demand_sheet 
WHERE assigned_to::jsonb ? '4';

-- Method 2: Array query  
SELECT COUNT(*) as array_count 
FROM tbl_demand_sheet 
WHERE 4 = ANY(assigned_to);

-- Method 3: Simple text search
SELECT COUNT(*) as text_count 
FROM tbl_demand_sheet 
WHERE assigned_to::text LIKE '%4%';
