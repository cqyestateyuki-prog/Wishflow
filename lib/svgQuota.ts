/**
 * SVG generation daily quota / AI 生成额度（服务端强制）
 *
 * Logged-in users get 3 AI drawings/day (keyed by account); anonymous users get
 * 1/day (keyed by a hashed IP). Enforced via a Supabase SECURITY DEFINER
 * function so the free image API can't be spammed by hitting /api/classify.
 *
 * Fails OPEN: if the quota backend is unreachable or the migration hasn't been
 * run yet, generation is allowed (unmetered) rather than blocked. Abuse on the
 * free Gemini tier degrades availability, not billing (over-quota just 429s and
 * falls back to a template), so availability wins over a hard lock during outages.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

const ANON_DAILY_LIMIT = 1;
const USER_DAILY_LIMIT = 3;

export type QuotaResult = { allowed: boolean; used: number; limit: number };

function serverClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

// Store only a salted hash of the IP — never the raw address.
function hashIp(ip: string): string {
  const salt = process.env.QUOTA_SALT || 'wishflow-quota';
  return createHash('sha256').update(salt + ip).digest('hex').slice(0, 32);
}

// Resolve who this request is, and how many drawings they get per day.
async function resolveIdentity(
  supabase: SupabaseClient,
  request: Request
): Promise<{ identity: string; limit: number }> {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        return { identity: `user:${data.user.id}`, limit: USER_DAILY_LIMIT };
      }
    } catch {
      // fall through to IP-based identity
    }
  }
  return { identity: `ip:${hashIp(clientIp(request))}`, limit: ANON_DAILY_LIMIT };
}

/**
 * Reserve one generation slot for this request.
 * Returns the quota state, or null if the check couldn't run (treat null as
 * "allowed" — fail open).
 */
export async function checkSvgQuota(request: Request): Promise<QuotaResult | null> {
  const supabase = serverClient();
  if (!supabase) return null;
  const { identity, limit } = await resolveIdentity(supabase, request);
  try {
    const { data, error } = await supabase.rpc('increment_svg_quota', {
      p_identity: identity,
      p_limit: limit,
    });
    if (error) {
      logger.error('[SVG Quota] RPC error, failing open:', error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return { allowed: !!row.allowed, used: row.used, limit: row.quota };
  } catch (e) {
    logger.error('[SVG Quota] check failed, failing open:', e);
    return null;
  }
}
