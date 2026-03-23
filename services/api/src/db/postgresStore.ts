import { Pool } from "pg";
import { DataStore } from "./contracts.js";
import { LearningPlan, Message, Session } from "../types.js";

export function createPostgresStore(pool: Pool): DataStore {
  return {
    getDemoUser: () => ({
      id: "u_1001",
      email: "demo@englishbuddy.ai",
      cefrLevel: "B1",
      nativeLang: "zh-CN",
      createdAt: new Date().toISOString()
    }),
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
