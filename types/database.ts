/**
 * أنواع TypeScript مطابقة لمخطط قاعدة البيانات.
 * بعد ربط المشروع بـ Supabase الفعلي، يُفضّل توليد هذا الملف تلقائيًا عبر:
 *   npx supabase gen types typescript --project-id <PROJECT_ID> > types/database.ts
 * الأنواع هنا مكتوبة يدويًا لتغطية الجداول المستخدمة في المرحلة الأولى من التطبيق.
 */

export type AppRole = "super_admin" | "general_secretary" | "stage_secretary" | "servant" | "member";
export type AppStage = "prep1" | "prep2" | "prep3";
export type AccountStatus = "active" | "disabled";

export type QuestionStatus = "new" | "reviewed" | "discussed" | "archived";
export type QuizQuestionType = "single_choice" | "multiple_choice" | "true_false" | "text";

type T<Row, Ins = Partial<Row>, Upd = Partial<Row>> = { Row: Row; Insert: Ins; Update: Upd; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone_normalized: string;
          role: AppRole;
          stage_id: AppStage | null;
          status: AccountStatus;
          qr_token: string;
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone_normalized: string;
          role?: AppRole;
          stage_id?: AppStage | null;
          status?: AccountStatus;
          created_by?: string | null;
        };
        Update: Partial<{
          full_name: string;
          role: AppRole;
          stage_id: AppStage | null;
          status: AccountStatus;
        }>;
        Relationships: [];
      };
      stages: {
        Row: { id: AppStage; name_ar: string; sort_order: number };
        Insert: { id: AppStage; name_ar: string; sort_order: number };
        Update: Partial<{ name_ar: string; sort_order: number }>;
        Relationships: [];
      };
      servant_assignments: {
        Row: { id: string; servant_id: string; stage_id: AppStage; created_at: string };
        Insert: { servant_id: string; stage_id: AppStage };
        Update: Partial<{ stage_id: AppStage }>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          details?: Record<string, unknown>;
        };
        Update: never;
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; value: Record<string, unknown>; updated_at: string; updated_by: string | null };
        Insert: { key: string; value: Record<string, unknown>; updated_by?: string | null };
        Update: Partial<{ value: Record<string, unknown> }>;
        Relationships: [];
      };
      prayer_sessions: {
        Row: {
          id: string;
          user_id: string;
          prayer_content_id: string;
          started_at: string;
          ended_at: string | null;
          active_seconds: number;
          progress_percent: number;
          activity_level: "low" | "medium" | "high" | null;
          completion_level: "not_started" | "partial" | "likely_complete";
          status: "in_progress" | "completed" | "abandoned";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["prayer_sessions"]["Row"]> & {
          user_id: string;
          prayer_content_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["prayer_sessions"]["Row"]>;
        Relationships: [];
      };
      mass_attendance: {
        Row: {
          id: string;
          mass_id: string;
          user_id: string;
          method: "self_report" | "qr_scan" | "manual_by_servant";
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          mass_id: string;
          user_id: string;
          method: "self_report" | "qr_scan" | "manual_by_servant";
          recorded_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      confessions: {
        Row: { id: string; user_id: string; confessed_at: string; created_at: string };
        Insert: { user_id: string; confessed_at: string };
        Update: never;
        Relationships: [];
      };
      sunday_school_attendance: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          method: "qr_scan" | "manual_by_servant";
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: {
          session_id: string;
          user_id: string;
          method: "qr_scan" | "manual_by_servant";
          recorded_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      sunday_school_sessions: {
        Row: {
          id: string;
          stage_id: AppStage;
          session_date: string;
          starts_at: string | null;
          ends_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          stage_id: AppStage;
          session_date: string;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      bible_reading_sessions: {
        Row: {
          id: string;
          user_id: string;
          chapter_id: string;
          plan_item_id: string | null;
          started_at: string;
          ended_at: string | null;
          active_seconds: number;
          progress_percent: number;
          activity_level: "low" | "medium" | "high" | null;
          completion_level: "not_started" | "partial" | "likely_complete";
          status: "in_progress" | "completed" | "abandoned";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bible_reading_sessions"]["Row"]> & {
          user_id: string;
          chapter_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["bible_reading_sessions"]["Row"]>;
        Relationships: [];
      };
      masses: {
        Row: { id: string; title_ar: string; mass_date: string; created_at: string };
        Insert: { title_ar: string; mass_date: string };
        Update: Partial<{ title_ar: string; mass_date: string }>;
        Relationships: [];
      };
      prayer_contents: {
        Row: {
          id: string;
          code: string;
          title_ar: string;
          body_ar: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: { code: string; title_ar: string; body_ar: string; sort_order?: number; is_active?: boolean };
        Update: Partial<{ title_ar: string; body_ar: string; sort_order: number; is_active: boolean }>;
        Relationships: [];
      };
      prayer_activity_events: {
        Row: { id: string; session_id: string; occurred_at: string; event_type: string; payload: Record<string, unknown> };
        Insert: { session_id: string; event_type: string; payload?: Record<string, unknown> };
        Update: never;
        Relationships: [];
      };
      bible_reading_activity_events: {
        Row: { id: string; session_id: string; occurred_at: string; event_type: string; payload: Record<string, unknown> };
        Insert: { session_id: string; event_type: string; payload?: Record<string, unknown> };
        Update: never;
        Relationships: [];
      };
      bible_books: {
        Row: { id: number; name_ar: string; testament: "old" | "new"; sort_order: number };
        Insert: { id: number; name_ar: string; testament: "old" | "new"; sort_order: number };
        Update: never;
        Relationships: [];
      };
      bible_chapters: {
        Row: { id: string; book_id: number; chapter_number: number };
        Insert: { book_id: number; chapter_number: number };
        Update: never;
        Relationships: [];
      };
      bible_verses: {
        Row: { id: string; chapter_id: string; verse_number: number; text_ar: string };
        Insert: { chapter_id: string; verse_number: number; text_ar: string };
        Update: never;
        Relationships: [];
      };
      symposium_questions: T<
        {
          id: string; user_id: string; is_anonymous: boolean; stage_id: AppStage; question_text: string;
          status: QuestionStatus; assigned_to: string | null; created_at: string; updated_at: string;
        },
        { user_id: string; question_text: string; is_anonymous?: boolean; stage_id?: AppStage }
      >;
      symposium_question_notes: T<
        { id: string; question_id: string; author_id: string; note: string; created_at: string },
        { question_id: string; author_id: string; note: string }
      >;
      quizzes: T<
        {
          id: string; title_ar: string; description_ar: string | null; stage_id: AppStage | null;
          starts_at: string; ends_at: string; duration_seconds: number; max_attempts: number;
          created_by: string | null; created_at: string; quiz_mode: "questions" | "file";
          attachment_path: string | null; attachment_name: string | null; max_score: number;
        },
        {
          title_ar: string; description_ar?: string | null; stage_id?: AppStage | null; starts_at: string;
          ends_at: string; duration_seconds: number; max_attempts: number; created_by: string;
          quiz_mode: "questions" | "file"; attachment_path?: string | null; attachment_name?: string | null;
          max_score: number;
        }
      >;
      quiz_questions: T<
        { id: string; quiz_id: string; question_type: QuizQuestionType; prompt: string; sort_order: number; points: number },
        { quiz_id: string; question_type: QuizQuestionType; prompt: string; sort_order: number; points: number }
      >;
      quiz_question_choices: T<
        { id: string; question_id: string; choice_text: string; is_correct: boolean; sort_order: number },
        { question_id: string; choice_text: string; is_correct: boolean; sort_order: number }
      >;
      quiz_attempts: T<
        {
          id: string; quiz_id: string; user_id: string; attempt_number: number; started_at: string;
          submitted_at: string | null; score: number | null; answer_file_path: string | null;
          answer_file_name: string | null; feedback: string | null; graded_by: string | null;
          graded_at: string | null; needs_review: boolean;
        },
        { quiz_id: string; user_id: string; attempt_number: number }
      >;
      quiz_answers: T<
        {
          id: string; attempt_id: string; question_id: string; selected_choice_ids: string[] | null;
          text_answer: string | null; is_correct: boolean | null;
        },
        { attempt_id: string; question_id: string; selected_choice_ids?: string[]; text_answer?: string | null; is_correct?: boolean | null }
      >;
      notifications: T<
        {
          id: string; title: string; body: string; link_url: string | null;
          target_type: "all" | "all_servants" | "stage" | "role" | "specific_users" | "custom";
          target_stage: AppStage | null; target_role: AppRole | null;
          scheduled_at: string | null; sent_at: string | null; created_by: string | null; created_at: string;
        },
        {
          title: string; body: string; link_url?: string | null;
          target_type: "all" | "all_servants" | "stage" | "role" | "specific_users" | "custom";
          target_stage?: AppStage | null; target_role?: AppRole | null;
          scheduled_at?: string | null; sent_at?: string | null; created_by?: string | null;
        }
      >;
      notification_recipients: T<
        { id: string; notification_id: string; user_id: string; channel: "in_app" | "push"; read_at: string | null; delivered_at: string | null },
        { notification_id: string; user_id: string; channel?: "in_app" | "push"; delivered_at?: string | null },
        { read_at?: string | null }
      >;
    };
    Views: {
      child_activity_summary: {
        Row: {
          user_id: string;
          full_name: string;
          stage_id: AppStage;
          last_prayer_at: string | null;
          last_reading_at: string | null;
          last_mass_date: string | null;
          last_confession_at: string | null;
          last_sunday_school_date: string | null;
          weekly_activity_percent: number | null;
          last_prayer_activity_at: string | null;
          today_prayer_status: "completed" | "partial" | "none";
          last_reading_activity_at: string | null;
          today_reading_status: "completed" | "partial" | "none";
          monthly_activity_percent: number | null;
        };
        Relationships: [];
      };
      servant_activity_summary: {
        Row: {
          user_id: string;
          full_name: string;
          stage_id: AppStage;
          last_prayer_at: string | null;
          last_reading_at: string | null;
          last_mass_date: string | null;
          last_confession_at: string | null;
          last_sunday_school_date: string | null;
          weekly_activity_percent: number | null;
        };
        Relationships: [];
      };
      symposium_inbox: {
        Row: {
          id: string; stage_id: AppStage; question_text: string; status: QuestionStatus; created_at: string;
          updated_at: string; assigned_to: string | null; assigned_name: string | null; is_anonymous: boolean;
          asker_id: string | null; asker_name: string | null;
        };
        Relationships: [];
      };
      symposium_notes_view: {
        Row: { id: string; question_id: string; note: string; created_at: string; author_id: string; author_name: string };
        Relationships: [];
      };
    };
    Functions: {
      symposium_set_status: { Args: { q: string; s: QuestionStatus }; Returns: undefined };
      symposium_assign: { Args: { q: string; a: string | null }; Returns: undefined };
    };
    Enums: {
      app_role: AppRole;
      app_stage: AppStage;
      account_status: AccountStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
