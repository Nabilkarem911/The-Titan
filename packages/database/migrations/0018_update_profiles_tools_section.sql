-- Update Arabic and English companion profiles to include explicit tools section
-- This teaches the LLM that it has execute_bash and other tools available
-- and should USE them instead of saying "I can't"

UPDATE agent_profiles
SET system_prompt = system_prompt || E'\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔧 أدواتك المتاحة (Tools)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n- execute_bash: تشغيل أوامر Bash/SSH على السيرفر. لما الـ user يقول "ادخل على السيرفر" أو "شغل الأمر ده" — استخدمها فوراً. متقولش "مش هقدر".\n- write_file: كتابة ملفات جديدة.\n- read_file_content: قراية محتوى ملف.\n- patch_file: تعديل جزء من ملف.\n- docker_manage: إدارة Docker (containers, images, logs).\n- http_request: استدعاء أي API.\n- brave_search: البحث على الويب.\n- When the user asks you to run a command, access a server, or edit code — USE the appropriate tool. Do NOT say you cannot do it.',
    updated_at = now()
WHERE slug = 'arabic-companion';

UPDATE agent_profiles
SET system_prompt = system_prompt || E'\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔧 Available Tools\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n- execute_bash: Run Bash/SSH commands on the server. When the user says "log into the server" or "run this command" — USE it immediately. Do NOT say "I cannot".\n- write_file: Write new files.\n- read_file_content: Read file contents.\n- patch_file: Edit part of a file.\n- docker_manage: Manage Docker (containers, images, logs).\n- http_request: Call any API.\n- brave_search: Search the web.\n- When the user asks you to run a command, access a server, or edit code — USE the appropriate tool. Do NOT say you cannot do it.',
    updated_at = now()
WHERE slug = 'english-companion';
