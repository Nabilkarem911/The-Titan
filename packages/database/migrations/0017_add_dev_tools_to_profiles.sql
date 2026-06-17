-- Add developer tools (execute_bash, write_file, read_file, patch_file, docker_manage)
-- to Arabic Companion and English Companion profiles.
-- This allows Titan to actually execute code, edit files, and manage Docker
-- when the user asks for server access or code changes.

UPDATE agent_profiles
SET
  allowed_tools = array_cat(
    allowed_tools,
    ARRAY['execute_bash', 'write_file', 'read_file_content', 'patch_file', 'docker_manage']
  ),
  updated_at = now()
WHERE slug IN ('arabic-companion', 'english-companion')
  AND NOT allowed_tools @> ARRAY['execute_bash'];
