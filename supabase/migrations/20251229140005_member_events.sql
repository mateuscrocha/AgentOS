-- =====================================================
-- MEMBER EVENTS: Registro histórico de participação em grupos WhatsApp
-- Fonte: eventos capturados via n8n (Z-API) e persistidos no Supabase
-- Uso: timeline, churn, entradas/saídas, auditoria, relatórios históricos
-- Sem deduplicação; estado derivado será tratado futuramente
-- =====================================================

-- 1) Enum de tipos de eventos
CREATE TYPE public.member_event_type AS ENUM (
  'MEMBERSHIP_APPROVAL_REQUEST',
  'REVOKED_MEMBERSHIP_REQUESTS',
  'GROUP_PARTICIPANT_ADD',
  'GROUP_PARTICIPANT_LEAVE',
  'GROUP_PARTICIPANT_REMOVE'
);

-- 2) Tabela principal
CREATE TABLE public.member_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  group_id uuid NOT NULL REFERENCES public.groups(id),

  member_id uuid NULL REFERENCES public.group_members(id),

  external_member_id text NOT NULL,

  event_type public.member_event_type NOT NULL,

  source text NOT NULL DEFAULT 'zapi',

  payload_raw jsonb NULL,

  occurred_at timestamptz NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  meta jsonb NULL
);

-- 3) Índices obrigatórios para leitura e análise
CREATE INDEX idx_member_events_group_id
  ON public.member_events (group_id);

CREATE INDEX idx_member_events_group_id_occurred_at
  ON public.member_events (group_id, occurred_at);

CREATE INDEX idx_member_events_event_type
  ON public.member_events (event_type);

CREATE INDEX idx_member_events_external_member_id
  ON public.member_events (external_member_id);

