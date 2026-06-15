import { getLogger } from '@titan/logging';
import { agentProfiles } from '@titan/database';

const log = getLogger().child({ component: 'tool-manage-agent-profile' });

export interface ManageAgentProfileInput {
  action: 'create' | 'update' | 'delete' | 'list' | 'get';
  ownerId: string;
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  allowedTools?: string[];
  forbiddenTools?: string[];
  maxSteps?: number;
  temperature?: number;
  workspaceId?: string;
  isPublic?: boolean;
}

export async function manageAgentProfile(input: ManageAgentProfileInput): Promise<unknown> {
  const { action, ownerId } = input;

  switch (action) {
    case 'create': {
      if (!input.name || !input.slug) {
        throw new Error('name and slug are required to create an agent profile');
      }

      // Check for duplicate slug
      const existing = await agentProfiles.findBySlug(ownerId, input.slug);
      if (existing) {
        throw new Error(`Agent profile with slug '${input.slug}' already exists. Choose a different slug.`);
      }

      const profile = await agentProfiles.create({
        name: input.name,
        slug: input.slug,
        description: input.description,
        systemPrompt: input.systemPrompt ?? 'You are a helpful AI assistant.',
        model: input.model,
        allowedTools: input.allowedTools,
        forbiddenTools: input.forbiddenTools,
        maxSteps: input.maxSteps ?? 10,
        temperature: input.temperature,
        ownerId,
        workspaceId: input.workspaceId,
        isPublic: input.isPublic ?? false,
      });

      log.info({ profileId: profile.id, name: profile.name, slug: profile.slug }, 'agent profile created via tool');
      return {
        message: `Agent profile "${profile.name}" created successfully.`,
        profile: {
          id: profile.id,
          name: profile.name,
          slug: profile.slug,
          description: profile.description,
          systemPrompt: profile.systemPrompt,
          allowedTools: profile.allowedTools,
          forbiddenTools: profile.forbiddenTools,
          maxSteps: profile.maxSteps,
        },
      };
    }

    case 'update': {
      if (!input.id && !input.slug) {
        throw new Error('id or slug is required to update an agent profile');
      }

      let profileId = input.id;
      if (!profileId && input.slug) {
        const found = await agentProfiles.findBySlug(ownerId, input.slug);
        if (!found) throw new Error(`Agent profile with slug '${input.slug}' not found`);
        profileId = found.id;
      }

      const updated = await agentProfiles.update(profileId!, {
        name: input.name,
        slug: input.slug,
        description: input.description,
        systemPrompt: input.systemPrompt,
        model: input.model,
        allowedTools: input.allowedTools,
        forbiddenTools: input.forbiddenTools,
        maxSteps: input.maxSteps,
        temperature: input.temperature,
        isPublic: input.isPublic,
      });

      if (!updated) throw new Error('Agent profile not found or update failed');

      log.info({ profileId, name: updated.name }, 'agent profile updated via tool');
      return {
        message: `Agent profile "${updated.name}" updated successfully.`,
        profile: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          systemPrompt: updated.systemPrompt,
          allowedTools: updated.allowedTools,
          forbiddenTools: updated.forbiddenTools,
          maxSteps: updated.maxSteps,
        },
      };
    }

    case 'delete': {
      if (!input.id && !input.slug) {
        throw new Error('id or slug is required to delete an agent profile');
      }

      let profileId = input.id;
      if (!profileId && input.slug) {
        const found = await agentProfiles.findBySlug(ownerId, input.slug);
        if (!found) throw new Error(`Agent profile with slug '${input.slug}' not found`);
        profileId = found.id;
      }

      const deleted = await agentProfiles.delete(profileId!);
      if (!deleted) throw new Error('Agent profile not found or delete failed');

      log.info({ profileId }, 'agent profile deleted via tool');
      return { message: `Agent profile deleted successfully.` };
    }

    case 'list': {
      const profiles = await agentProfiles.listForOwner(ownerId, { limit: 50 });
      const publicProfiles = await agentProfiles.listPublic({ limit: 50 });

      // Merge and deduplicate
      const all = new Map<string, typeof profiles[0]>();
      for (const p of [...profiles, ...publicProfiles]) {
        all.set(p.id, p);
      }

      return {
        message: `Found ${all.size} agent profiles.`,
        profiles: Array.from(all.values()).map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          maxSteps: p.maxSteps,
          isPublic: p.isPublic,
          ownerId: p.ownerId,
        })),
      };
    }

    case 'get': {
      if (!input.id && !input.slug) {
        throw new Error('id or slug is required to get an agent profile');
      }

      let profile;
      if (input.id) {
        profile = await agentProfiles.findById(input.id);
      } else if (input.slug) {
        profile = await agentProfiles.findBySlug(ownerId, input.slug);
        if (!profile) {
          // Try public profiles from system user
          profile = await agentProfiles.findBySlug('00000000-0000-0000-0000-000000000001', input.slug);
        }
      }

      if (!profile) throw new Error('Agent profile not found');

      return {
        profile: {
          id: profile.id,
          name: profile.name,
          slug: profile.slug,
          description: profile.description,
          systemPrompt: profile.systemPrompt,
          model: profile.model,
          allowedTools: profile.allowedTools,
          forbiddenTools: profile.forbiddenTools,
          maxSteps: profile.maxSteps,
          temperature: profile.temperature,
          isPublic: profile.isPublic,
        },
      };
    }

    default:
      throw new Error(`Unknown action: ${action}. Valid actions: create, update, delete, list, get`);
  }
}
