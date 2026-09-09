import { query } from './client.js';

// ── Token Usage ──
export const tokenUsage = {
  async insert(e: {
    userId?: string | null;
    workspaceId?: string | null;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costCents: number;
  }): Promise<void> {
    await query(
      `INSERT INTO token_usage (user_id, workspace_id, model, prompt_tokens, completion_tokens, total_tokens, cost_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [e.userId ?? null, e.workspaceId ?? null, e.model, e.promptTokens, e.completionTokens, e.totalTokens, e.costCents],
    );
  },

  async getRecent(limit = 100): Promise<unknown[]> {
    const result = await query(`SELECT * FROM token_usage ORDER BY created_at DESC LIMIT $1`, [limit]);
    return result.rows;
  },

  async getStats(from?: Date, to?: Date, model?: string): Promise<{ totalTokens: number; totalCostCents: number; byModel: Record<string, number> }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (from) { params.push(from); conditions.push(`created_at >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`created_at <= $${params.length}`); }
    if (model) { params.push(model); conditions.push(`model = $${params.length}`); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT model, SUM(total_tokens) as total_tokens, SUM(cost_cents) as total_cost FROM token_usage ${where} GROUP BY model`,
      params,
    );
    let totalTokens = 0;
    let totalCostCents = 0;
    const byModel: Record<string, number> = {};
    for (const row of result.rows as Record<string, unknown>[]) {
      const t = Number(row.total_tokens ?? 0);
      const c = Number(row.total_cost ?? 0);
      totalTokens += t;
      totalCostCents += c;
      byModel[row.model as string] = t;
    }
    return { totalTokens, totalCostCents, byModel };
  },

  async count(): Promise<number> {
    const result = await query(`SELECT COUNT(*) as cnt FROM token_usage`);
    return Number((result.rows[0] as Record<string, unknown>).cnt ?? 0);
  },
};

// ── Tool Execution Stats ──
export const toolExecutionStats = {
  async insert(e: {
    toolName: string;
    success: boolean;
    durationMs: number;
    errorType?: string | null;
    userId?: string | null;
  }): Promise<void> {
    await query(
      `INSERT INTO tool_execution_stats (tool_name, success, duration_ms, error_type, user_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [e.toolName, e.success, e.durationMs, e.errorType ?? null, e.userId ?? null],
    );
  },

  async getRecent(limit = 100): Promise<unknown[]> {
    const result = await query(`SELECT * FROM tool_execution_stats ORDER BY created_at DESC LIMIT $1`, [limit]);
    return result.rows;
  },

  async getStats(): Promise<{ tools: Array<{ toolName: string; totalCalls: number; errorRate: number }>; totalCalls: number; errorRate: number }> {
    const result = await query(
      `SELECT tool_name, COUNT(*) as total_calls, SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as errors FROM tool_execution_stats GROUP BY tool_name ORDER BY total_calls DESC`,
    );
    const tools = (result.rows as Record<string, unknown>[]).map((row) => ({
      toolName: row.tool_name as string,
      totalCalls: Number(row.total_calls ?? 0),
      errorRate: Number(row.total_calls ?? 0) > 0 ? Number(row.errors ?? 0) / Number(row.total_calls) : 0,
    }));
    const totalCalls = tools.reduce((s, t) => s + t.totalCalls, 0);
    const totalErrors = tools.reduce((s, t) => s + Math.round(t.errorRate * t.totalCalls), 0);
    return { tools, totalCalls, errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0 };
  },

  async count(): Promise<number> {
    const result = await query(`SELECT COUNT(*) as cnt FROM tool_execution_stats`);
    return Number((result.rows[0] as Record<string, unknown>).cnt ?? 0);
  },
};

// ── Marketplace Listings ──
export const marketplaceListings = {
  async insert(e: {
    id?: string;
    type: string;
    name: string;
    description?: string;
    manifest?: unknown;
    tags?: string[];
    authorId?: string | null;
  }): Promise<Record<string, unknown>> {
    const result = await query(
      `INSERT INTO marketplace_listings (type, name, description, manifest, tags, author_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [e.type, e.name, e.description ?? null, JSON.stringify(e.manifest ?? {}), e.tags ?? [], e.authorId ?? null],
    );
    return result.rows[0] as Record<string, unknown>;
  },

  async getById(id: string): Promise<Record<string, unknown> | null> {
    const result = await query(`SELECT * FROM marketplace_listings WHERE id = $1`, [id]);
    return (result.rows[0] as Record<string, unknown>) ?? null;
  },

  async browse(opts: { type?: string; sort?: string; page?: number; limit?: number }): Promise<{ listings: unknown[]; total: number }> {
    const limit = opts.limit ?? 20;
    const offset = ((opts.page ?? 1) - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (opts.type) { params.push(opts.type); conditions.push(`type = $${params.length}`); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = opts.sort === 'downloads' ? 'downloads DESC' : opts.sort === 'rating' ? 'rating DESC' : 'published_at DESC';
    const result = await query(`SELECT * FROM marketplace_listings ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
    const countResult = await query(`SELECT COUNT(*) as cnt FROM marketplace_listings ${where}`, params);
    return { listings: result.rows, total: Number((countResult.rows[0] as Record<string, unknown>).cnt ?? 0) };
  },

  async getFeatured(): Promise<{ featured: unknown[]; trending: unknown[]; newest: unknown[] }> {
    const featured = await query(`SELECT * FROM marketplace_listings ORDER BY rating DESC LIMIT 5`);
    const trending = await query(`SELECT * FROM marketplace_listings ORDER BY downloads DESC LIMIT 5`);
    const newest = await query(`SELECT * FROM marketplace_listings ORDER BY published_at DESC LIMIT 5`);
    return { featured: featured.rows, trending: trending.rows, newest: newest.rows };
  },

  async incrementDownloads(id: string): Promise<void> {
    await query(`UPDATE marketplace_listings SET downloads = downloads + 1 WHERE id = $1`, [id]);
  },
};

// ── Marketplace Reviews ──
export const marketplaceReviews = {
  async insert(e: {
    listingId: string;
    userId?: string | null;
    rating: number;
    comment?: string;
  }): Promise<Record<string, unknown>> {
    const result = await query(
      `INSERT INTO marketplace_reviews (listing_id, user_id, rating, comment) VALUES ($1,$2,$3,$4) RETURNING *`,
      [e.listingId, e.userId ?? null, e.rating, e.comment ?? null],
    );
    return result.rows[0] as Record<string, unknown>;
  },

  async getByListing(listingId: string): Promise<unknown[]> {
    const result = await query(`SELECT * FROM marketplace_reviews WHERE listing_id = $1 ORDER BY created_at DESC`, [listingId]);
    return result.rows;
  },
};

// ── User Preferences ──
export const userPreferences = {
  async getOrCreate(userId: string): Promise<Record<string, unknown>> {
    const result = await query(
      `INSERT INTO user_preferences (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = $1
       RETURNING *`,
      [userId],
    );
    return result.rows[0] as Record<string, unknown>;
  },

  async update(userId: string, updates: Record<string, unknown>): Promise<Record<string, unknown>> {
    const allowedFields = ['theme', 'language', 'notification_email', 'notification_push', 'default_model', 'default_agent', 'timezone'];
    const setClauses: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        params.push(value);
        setClauses.push(`${dbKey} = $${params.length}`);
      }
    }
    if (setClauses.length === 0) return this.getOrCreate(userId);
    params.push(userId);
    const result = await query(
      `UPDATE user_preferences SET ${setClauses.join(', ')} WHERE user_id = $${params.length} RETURNING *`,
      params,
    );
    return (result.rows[0] as Record<string, unknown>) ?? this.getOrCreate(userId);
  },
};

// ── Run Feedback ──
export const runFeedback = {
  async insert(e: {
    runId: string;
    userId?: string | null;
    rating: string;
    comment?: string;
  }): Promise<void> {
    await query(
      `INSERT INTO run_feedback (run_id, user_id, rating, comment) VALUES ($1,$2,$3,$4)
       ON CONFLICT (run_id, user_id) DO UPDATE SET rating = $3, comment = $4`,
      [e.runId, e.userId ?? null, e.rating, e.comment ?? null],
    );
  },

  async getRecent(limit = 100): Promise<unknown[]> {
    const result = await query(`SELECT * FROM run_feedback ORDER BY created_at DESC LIMIT $1`, [limit]);
    return result.rows;
  },

  async getStats(): Promise<{ total: number; positiveRate: number }> {
    const result = await query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN rating = 'positive' THEN 1 ELSE 0 END) as positive
       FROM run_feedback`,
    );
    const row = result.rows[0] as Record<string, unknown>;
    const total = Number(row.total ?? 0);
    const positive = Number(row.positive ?? 0);
    return { total, positiveRate: total > 0 ? positive / total : 0 };
  },
};

// ── User Notifications ──
export const userNotifications = {
  async insert(e: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: unknown;
  }): Promise<void> {
    await query(
      `INSERT INTO user_notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)`,
      [e.userId, e.type, e.title, e.body, JSON.stringify(e.data ?? {})],
    );
  },

  async getByUser(userId: string, limit = 50): Promise<{ notifications: unknown[]; unreadCount: number }> {
    const result = await query(
      `SELECT * FROM user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    const unreadResult = await query(
      `SELECT COUNT(*) as cnt FROM user_notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return {
      notifications: result.rows,
      unreadCount: Number((unreadResult.rows[0] as Record<string, unknown>).cnt ?? 0),
    };
  },

  async markRead(id: string): Promise<void> {
    await query(`UPDATE user_notifications SET read_at = now() WHERE id = $1`, [id]);
  },

  async delete(id: string): Promise<void> {
    await query(`DELETE FROM user_notifications WHERE id = $1`, [id]);
  },
};
