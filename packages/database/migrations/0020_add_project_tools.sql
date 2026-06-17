-- Add project tools (set_project, get_project) to companion profiles
-- so Titan can remember and retrieve user projects.

UPDATE agent_profiles
SET
  allowed_tools = array_cat(
    allowed_tools,
    ARRAY['set_project', 'get_project']
  ),
  updated_at = now()
WHERE slug IN ('arabic-companion', 'english-companion')
  AND NOT allowed_tools @> ARRAY['set_project'];
