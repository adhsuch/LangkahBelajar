-- CreateEnum
CREATE TYPE "RelationRole" AS ENUM ('PARENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "TextSize" AS ENUM ('NORMAL', 'LARGE', 'XLARGE');

-- CreateEnum
CREATE TYPE "ResponseMethod" AS ENUM ('TAP', 'CAREGIVER_ASSISTED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('PRACTICE', 'STARTER');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'PAUSED', 'STOPPED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StepKind" AS ENUM ('START', 'PRACTICE', 'BREAK', 'FINISH');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "MasteryStatus" AS ENUM ('PRACTICING', 'NEXT_STAGE_OFFERED', 'FINAL_STAGE_REACHED');

-- CreateEnum
CREATE TYPE "MaterialFormat" AS ENUM ('TEXT', 'VISUAL', 'AUDIO');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caregiver_child_relations" (
    "caregiver_id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "role" "RelationRole" NOT NULL,
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caregiver_child_relations_pkey" PRIMARY KEY ("caregiver_id","child_id")
);

-- CreateTable
CREATE TABLE "api_clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_profiles" (
    "id" UUID NOT NULL,
    "nickname" TEXT NOT NULL,
    "initial_notes" TEXT,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_preferences" (
    "child_id" UUID NOT NULL,
    "audio_enabled" BOOLEAN NOT NULL,
    "text_size" "TextSize" NOT NULL,
    "visual_cues" BOOLEAN NOT NULL,
    "response_method" "ResponseMethod" NOT NULL,
    "reduce_motion" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_preferences_pkey" PRIMARY KEY ("child_id")
);

-- CreateTable
CREATE TABLE "skills" (
    "code" TEXT NOT NULL,
    "max_level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "skill_targets" (
    "child_id" UUID NOT NULL,
    "skill_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_targets_pkey" PRIMARY KEY ("child_id","skill_code")
);

-- CreateTable
CREATE TABLE "learning_sessions" (
    "id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "type" "SessionType" NOT NULL DEFAULT 'PRACTICE',
    "status" "SessionStatus" NOT NULL DEFAULT 'PLANNED',
    "duration_minutes" INTEGER NOT NULL,
    "profile_snapshot" JSONB NOT NULL,
    "pause_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "stopped_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_steps" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "StepKind" NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "skill_code" TEXT,
    "level" INTEGER,
    "activity_id" TEXT,
    "activity_version" TEXT,
    "activity" JSONB,
    "material" JSONB,
    "adaptation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_results" (
    "id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "session_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "skill_code" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "activity_id" TEXT NOT NULL,
    "activity_version" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "answer" JSONB NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "support_used" TEXT[],
    "independent" BOOLEAN NOT NULL,
    "counts_toward_mastery" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_mastery" (
    "child_id" UUID NOT NULL,
    "skill_code" TEXT NOT NULL,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "status" "MasteryStatus" NOT NULL DEFAULT 'PRACTICING',
    "dismissed_at_count" INTEGER NOT NULL DEFAULT 0,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_mastery_pkey" PRIMARY KEY ("child_id","skill_code")
);

-- CreateTable
CREATE TABLE "caregiver_notes" (
    "id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "session_id" UUID,
    "skill_code" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caregiver_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routines" (
    "child_id" UUID NOT NULL,
    "days" INTEGER[],
    "time" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "break_minutes" INTEGER NOT NULL,
    "reminders_enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("child_id")
);

-- CreateTable
CREATE TABLE "session_summaries" (
    "session_id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_summaries_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "material_cache" (
    "id" UUID NOT NULL,
    "material_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "skill_code" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "format" "MaterialFormat" NOT NULL,
    "media_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_cache" (
    "id" UUID NOT NULL,
    "activity_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "skill_code" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "template" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_provider_logs" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "http_status" INTEGER,
    "duration_ms" INTEGER NOT NULL,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_provider_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "caregiver_child_relations_child_id_idx" ON "caregiver_child_relations"("child_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_clients_name_key" ON "api_clients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "api_clients_key_hash_key" ON "api_clients"("key_hash");

-- CreateIndex
CREATE INDEX "learning_sessions_child_id_status_idx" ON "learning_sessions"("child_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "session_steps_session_id_position_key" ON "session_steps"("session_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_results_idempotency_key_key" ON "exercise_results"("idempotency_key");

-- CreateIndex
CREATE INDEX "exercise_results_child_id_skill_code_level_idx" ON "exercise_results"("child_id", "skill_code", "level");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_results_step_id_attempt_no_key" ON "exercise_results"("step_id", "attempt_no");

-- CreateIndex
CREATE INDEX "caregiver_notes_child_id_created_at_idx" ON "caregiver_notes"("child_id", "created_at");

-- CreateIndex
CREATE INDEX "session_summaries_child_id_created_at_idx" ON "session_summaries"("child_id", "created_at");

-- CreateIndex
CREATE INDEX "material_cache_skill_code_level_format_valid_until_idx" ON "material_cache"("skill_code", "level", "format", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "material_cache_material_id_version_key" ON "material_cache"("material_id", "version");

-- CreateIndex
CREATE INDEX "activity_cache_skill_code_level_valid_until_idx" ON "activity_cache"("skill_code", "level", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "activity_cache_activity_id_version_key" ON "activity_cache"("activity_id", "version");

-- CreateIndex
CREATE INDEX "external_provider_logs_provider_created_at_idx" ON "external_provider_logs"("provider", "created_at");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_child_relations" ADD CONSTRAINT "caregiver_child_relations_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_child_relations" ADD CONSTRAINT "caregiver_child_relations_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_preferences" ADD CONSTRAINT "learning_preferences_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_targets" ADD CONSTRAINT "skill_targets_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_targets" ADD CONSTRAINT "skill_targets_skill_code_fkey" FOREIGN KEY ("skill_code") REFERENCES "skills"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_steps" ADD CONSTRAINT "session_steps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_results" ADD CONSTRAINT "exercise_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_results" ADD CONSTRAINT "exercise_results_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "session_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_results" ADD CONSTRAINT "exercise_results_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_mastery" ADD CONSTRAINT "skill_mastery_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_mastery" ADD CONSTRAINT "skill_mastery_skill_code_fkey" FOREIGN KEY ("skill_code") REFERENCES "skills"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_notes" ADD CONSTRAINT "caregiver_notes_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_notes" ADD CONSTRAINT "caregiver_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "routines_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
