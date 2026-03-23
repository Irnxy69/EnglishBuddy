import { Pool } from "pg";
import { DataStore } from "./contracts.js";
import { Invitation, InvitationCreateInput, LearningPlan, Message, Session, User } from "../types.js";

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BUDDY${suffix}`;
}

export function createPostgresStore(pool: Pool): DataStore {
  return {
    getDemoUser: () => ({
      id: "u_1001",
      email: "demo@englishbuddy.ai",
      cefrLevel: "B1",
      nativeLang: "zh-CN",
      createdAt: new Date().toISOString()
    }),
    findAuthAccountByEmail: async (email: string) => {
      const rs = await pool.query(
        `select u.id,
                u.email,
                u.cefr_level as "cefrLevel",
                u.native_lang as "nativeLang",
                u.created_at as "createdAt",
                a.password
         from users u
         join auth_accounts a on a.user_id = u.id
         where lower(u.email) = lower($1)
         limit 1`,
        [email]
      );

      if (!rs.rows[0]) {
        return undefined;
      }

      const row = rs.rows[0] as User & { password: string };
      return {
        user: {
          id: row.id,
          email: row.email,
          cefrLevel: row.cefrLevel,
          nativeLang: row.nativeLang,
          createdAt: row.createdAt
        },
        password: row.password
      };
    },
    createAuthAccount: async (input) => {
      await pool.query(
        `insert into users (id, email, cefr_level, native_lang, created_at)
         values ($1, $2, $3, $4, now())
         on conflict (id) do nothing`,
        [input.user.id, input.user.email.toLowerCase(), input.user.cefrLevel, input.user.nativeLang]
      );

      await pool.query(
        `insert into auth_accounts (user_id, password)
         values ($1, $2)
         on conflict (user_id) do update set password = excluded.password`,
        [input.user.id, input.password]
      );
    },
    listInvitations: async () => {
      const rs = await pool.query(
        `select code,
                max_uses as "maxUses",
                used_count as "usedCount",
                created_at as "createdAt",
                created_by as "createdBy",
                is_active as "isActive",
                expires_at as "expiresAt",
                note
         from invitations
         order by created_at desc`
      );
      return rs.rows as Invitation[];
    },
    createInvitation: async (input: InvitationCreateInput) => {
      let code = randomCode();
      for (let i = 0; i < 5; i++) {
        const exists = await pool.query("select 1 from invitations where code = $1 limit 1", [code]);
        if (exists.rowCount === 0) {
          break;
        }
        code = randomCode();
      }

      const rs = await pool.query(
        `insert into invitations (code, max_uses, used_count, created_by, is_active, expires_at, note)
         values ($1, $2, 0, $3, true, $4, $5)
         returning code,
                   max_uses as "maxUses",
                   used_count as "usedCount",
                   created_at as "createdAt",
                   created_by as "createdBy",
                   is_active as "isActive",
                   expires_at as "expiresAt",
                   note`,
        [code, input.maxUses, input.createdBy, input.expiresAt ?? null, input.note ?? null]
      );
      return rs.rows[0] as Invitation;
    },
    disableInvitation: async (code: string) => {
      const rs = await pool.query("update invitations set is_active = false where code = upper($1)", [code]);
      return (rs.rowCount ?? 0) > 0;
    },
    verifyInvitation: async (code: string) => {
      const rs = await pool.query(
        `select code, max_uses, used_count, is_active, expires_at
         from invitations
         where code = upper($1)
         limit 1`,
        [code]
      );
      const row = rs.rows[0] as { max_uses: number; used_count: number; is_active: boolean; expires_at: string | null } | undefined;
      if (!row) {
        return { valid: false, message: "邀请码不存在或已过期" };
      }
      if (!row.is_active) {
        return { valid: false, message: "邀请码已被禁用" };
      }
      if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
        return { valid: false, message: "邀请码已过期" };
      }
      if (row.used_count >= row.max_uses) {
        return { valid: false, message: "邀请码已达使用上限" };
      }
      return { valid: true };
    },
    consumeInvitation: async (code: string) => {
      const rs = await pool.query(
        `update invitations
         set used_count = used_count + 1
         where code = upper($1)
           and is_active = true
           and used_count < max_uses
           and (expires_at is null or expires_at > now())`,
        [code]
      );
      return (rs.rowCount ?? 0) > 0;
    },
    getScenarios: async () => {
      const rs = await pool.query("select id,name,category,prompt_template as \"promptTemplate\",difficulty from scenarios order by name");
      return rs.rows;
    },
    getScenarioById: async (id) => {
      const rs = await pool.query(
        "select id,name,category,prompt_template as \"promptTemplate\",difficulty from scenarios where id = $1 limit 1",
        [id]
      );
      return rs.rows[0];
    },
    getPlanByUserId: async (userId) => {
      const rs = await pool.query(
        "select id,user_id as \"userId\",weekly_goal_min as \"weeklyGoalMin\",current_streak as \"currentStreak\",plan_json as \"planJson\" from learning_plans where user_id = $1 limit 1",
        [userId]
      );
      return rs.rows[0];
    },
    upsertPlan: async (plan: LearningPlan) => {
      const rs = await pool.query(
        `insert into learning_plans (id,user_id,weekly_goal_min,current_streak,plan_json)
         values ($1,$2,$3,$4,$5::jsonb)
         on conflict (user_id)
         do update set weekly_goal_min = excluded.weekly_goal_min,
                      current_streak = excluded.current_streak,
                      plan_json = excluded.plan_json,
                      updated_at = now()
         returning id,user_id as "userId",weekly_goal_min as "weeklyGoalMin",current_streak as "currentStreak",plan_json as "planJson"`,
        [plan.id, plan.userId, plan.weeklyGoalMin, plan.currentStreak, JSON.stringify(plan.planJson)]
      );
      return rs.rows[0];
    },
    createSession: async (userId: string, scenarioId: string): Promise<Session> => {
      const rs = await pool.query(
        `insert into sessions (id,user_id,scenario_id,started_at,duration_sec)
         values (concat('sess_', substr(md5(random()::text), 1, 8)),$1,$2,now(),0)
         returning id,user_id as "userId",scenario_id as "scenarioId",started_at as "startedAt",duration_sec as "durationSec"`,
        [userId, scenarioId]
      );
      return rs.rows[0];
    },
    getSessionById: async (id: string) => {
      const rs = await pool.query(
        "select id,user_id as \"userId\",scenario_id as \"scenarioId\",started_at as \"startedAt\",duration_sec as \"durationSec\" from sessions where id = $1 limit 1",
        [id]
      );
      return rs.rows[0];
    },
    listMessagesBySessionId: async (sessionId: string): Promise<Message[]> => {
      const rs = await pool.query(
        "select id,session_id as \"sessionId\",role,content,audio_url as \"audioUrl\",score_json as \"scoreJson\",created_at as \"createdAt\" from messages where session_id = $1 order by created_at asc",
        [sessionId]
      );
      return rs.rows;
    },
    addMessage: async (payload: Omit<Message, "id" | "createdAt">): Promise<Message> => {
      const rs = await pool.query(
        `insert into messages (id,session_id,role,content,audio_url,score_json,created_at)
         values (concat('msg_', substr(md5(random()::text), 1, 8)),$1,$2,$3,$4,$5::jsonb,now())
         returning id,session_id as "sessionId",role,content,audio_url as "audioUrl",score_json as "scoreJson",created_at as "createdAt"`,
        [payload.sessionId, payload.role, payload.content, payload.audioUrl ?? null, JSON.stringify(payload.scoreJson ?? null)]
      );
      return rs.rows[0];
    }
  };
}
