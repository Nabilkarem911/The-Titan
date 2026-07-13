import type { FastifyPluginAsync } from 'fastify';
import { dreamDebugRoutes } from './dream-debug-routes.js';
import { cognitionRoutes } from './cognition-routes.js';
import { safetyRoutes } from './safety-routes.js';
import { infrastructureRoutes } from './infrastructure-routes.js';
import { statsRoutes } from './stats-routes.js';

export const reasoningRoutes: FastifyPluginAsync = async (app) => {
  await dreamDebugRoutes(app, {});
  await cognitionRoutes(app, {});
  await safetyRoutes(app, {});
  await infrastructureRoutes(app, {});
  await statsRoutes(app, {});
};
