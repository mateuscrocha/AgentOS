import { supabase } from "@/integrations/supabase/client";

export type EventType = 
  | 'ORG_UPDATED' 
  | 'GROUP_UPDATED' 
  | 'MEMBER_UPDATED' 
  | 'ORG_CREATED' 
  | 'GROUP_CREATED';

export type EntityType = 'organization' | 'group' | 'member' | 'message';

interface LogEventParams {
  eventType: EventType;
  entityType: EntityType;
  entityId: string;
  userId: string;
  metadata?: Record<string, any>;
}

/**
 * Logs an audit event to the events table.
 * This is a fire-and-forget operation - errors are logged but don't break the flow.
 */
export async function logEvent({
  eventType,
  entityType,
  entityId,
  userId,
  metadata = {},
}: LogEventParams): Promise<void> {
  try {
    const { error } = await supabase.from('events').insert({
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      metadata,
    });

    if (error) {
      console.warn('Failed to log event:', error.message);
    }
  } catch (err) {
    // Silent fail - don't break the main flow
    console.warn('Event logging failed:', err);
  }
}

/**
 * Detects which fields have changed between original and updated objects
 */
export function getChangedFields<T extends Record<string, any>>(
  original: T,
  updated: Partial<T>,
  fieldsToCheck: (keyof T)[]
): string[] {
  return fieldsToCheck.filter(field => 
    updated[field] !== undefined && original[field] !== updated[field]
  ) as string[];
}
