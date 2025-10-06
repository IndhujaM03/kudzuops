-- Seed initial roles
INSERT INTO tbl_roles (role_name, role_key, description, is_system_role, is_active, is_default)
VALUES
  ('Admin', 'admin', 'Can manage all users and settings', TRUE, TRUE, FALSE),
  ('Recruiter', 'recruiter', 'Handles candidate sourcing and pipeline', TRUE, TRUE, TRUE),
  ('Candidate', 'candidate', 'End user applying for jobs', TRUE, TRUE, TRUE),
  ('Hiring Manager', 'hiring_manager', 'Reviews and approves candidates', TRUE, TRUE, FALSE),
  ('Team Lead', 'team_lead', 'Leads a team of recruiters', TRUE, TRUE, FALSE)
ON CONFLICT (role_key) DO NOTHING;

-- Basic permissions per module/action (example set; extend as needed)
WITH roles AS (
  SELECT id, role_key FROM tbl_roles
)
INSERT INTO tbl_role_permissions (role_id, module, permission_key, is_allowed)
SELECT r.id, p.module, p.permission_key, p.is_allowed
FROM roles r
JOIN (
  VALUES
    -- Admin: allow all basic actions on key modules
    ('admin','users','view',TRUE), ('admin','users','create',TRUE), ('admin','users','edit',TRUE), ('admin','users','delete',TRUE), ('admin','users','export',TRUE),
    ('admin','jobs','view',TRUE), ('admin','jobs','create',TRUE), ('admin','jobs','edit',TRUE), ('admin','jobs','delete',TRUE), ('admin','jobs','export',TRUE),
    ('admin','candidates','view',TRUE), ('admin','candidates','create',TRUE), ('admin','candidates','edit',TRUE), ('admin','candidates','delete',TRUE), ('admin','candidates','export',TRUE),

    -- Recruiter: typical permissions
    ('recruiter','candidates','view',TRUE), ('recruiter','candidates','create',TRUE), ('recruiter','candidates','edit',TRUE), ('recruiter','candidates','delete',FALSE), ('recruiter','candidates','export',TRUE),
    ('recruiter','jobs','view',TRUE), ('recruiter','jobs','create',TRUE), ('recruiter','jobs','edit',TRUE), ('recruiter','jobs','delete',FALSE), ('recruiter','jobs','export',TRUE),

    -- Candidate: self-scope
    ('candidate','self','view',TRUE), ('candidate','self','edit',TRUE),

    -- Hiring Manager: review candidates and jobs
    ('hiring_manager','candidates','view',TRUE), ('hiring_manager','candidates','edit',TRUE), ('hiring_manager','candidates','delete',FALSE),
    ('hiring_manager','jobs','view',TRUE), ('hiring_manager','jobs','edit',TRUE),

    -- Team Lead: manage team and jobs
    ('team_lead','candidates','view',TRUE), ('team_lead','candidates','edit',TRUE), ('team_lead','candidates','delete',FALSE),
    ('team_lead','jobs','view',TRUE), ('team_lead','jobs','create',TRUE), ('team_lead','jobs','edit',TRUE), ('team_lead','jobs','delete',FALSE)
) AS p(role_key, module, permission_key, is_allowed)
  ON r.role_key = p.role_key
ON CONFLICT (role_id, module, permission_key) DO NOTHING;


