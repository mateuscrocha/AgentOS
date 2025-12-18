-- Create test organization, group, members, messages, and reactions
DO $$
DECLARE
  v_org_id uuid;
  v_group_id uuid;
  v_member_ids uuid[];
  v_admin_member_ids uuid[];
  v_active_member_ids uuid[];
  v_sporadic_member_ids uuid[];
  v_inactive_member_ids uuid[];
  v_message_ids uuid[];
  v_i integer;
  v_member_id uuid;
  v_message_id uuid;
  v_message_ts timestamp with time zone;
  v_hour integer;
  v_day_offset integer;
  v_message_type text;
  v_rand float;
BEGIN
  -- 1. Create organization TESTE
  INSERT INTO organizations (name, status, slug, plan)
  VALUES ('TESTE', 'active', 'teste-dashboard', 'premium')
  RETURNING id INTO v_org_id;

  -- 2. Create group TESTE Dashboard
  INSERT INTO groups (organization_id, name, provider, status, sync_status, description)
  VALUES (v_org_id, 'TESTE Dashboard', 'whatsapp', 'active', 'synced', 'Grupo de teste para validação dos dashboards')
  RETURNING id INTO v_group_id;

  -- 3. Create 20 members with different profiles
  -- 3 Admins (including 1 owner)
  INSERT INTO members (group_id, name, phone_e164, is_admin, is_owner, is_super_admin, joined_at, status)
  VALUES 
    (v_group_id, 'Carlos Admin', '+5511999990001', true, true, true, now() - interval '60 days', 'active'),
    (v_group_id, 'Maria Gestora', '+5511999990002', true, false, false, now() - interval '45 days', 'active'),
    (v_group_id, 'João Moderador', '+5511999990003', true, false, false, now() - interval '30 days', 'active');

  SELECT array_agg(id) INTO v_admin_member_ids FROM members WHERE group_id = v_group_id AND is_admin = true;

  -- 7 Active/Recurrent members
  INSERT INTO members (group_id, name, phone_e164, is_admin, joined_at, status)
  VALUES 
    (v_group_id, 'Ana Paula', '+5511999990004', false, now() - interval '40 days', 'active'),
    (v_group_id, 'Roberto Silva', '+5511999990005', false, now() - interval '35 days', 'active'),
    (v_group_id, 'Fernanda Costa', '+5511999990006', false, now() - interval '28 days', 'active'),
    (v_group_id, 'Lucas Oliveira', '+5511999990007', false, now() - interval '25 days', 'active'),
    (v_group_id, 'Juliana Santos', '+5511999990008', false, now() - interval '20 days', 'active'),
    (v_group_id, 'Pedro Henrique', '+5511999990009', false, now() - interval '15 days', 'active'),
    (v_group_id, 'Camila Rocha', '+5511999990010', false, now() - interval '10 days', 'active');

  SELECT array_agg(id) INTO v_active_member_ids FROM members WHERE group_id = v_group_id AND is_admin = false AND phone_e164 IN ('+5511999990004', '+5511999990005', '+5511999990006', '+5511999990007', '+5511999990008', '+5511999990009', '+5511999990010');

  -- 5 Sporadic members
  INSERT INTO members (group_id, name, phone_e164, is_admin, joined_at, status)
  VALUES 
    (v_group_id, 'Marcos Almeida', '+5511999990011', false, now() - interval '50 days', 'active'),
    (v_group_id, 'Patricia Lima', '+5511999990012', false, now() - interval '55 days', 'active'),
    (v_group_id, 'Ricardo Souza', '+5511999990013', false, now() - interval '22 days', 'active'),
    (v_group_id, 'Beatriz Ferreira', '+5511999990014', false, now() - interval '18 days', 'active'),
    (v_group_id, 'Gustavo Pereira', '+5511999990015', false, now() - interval '8 days', 'active');

  SELECT array_agg(id) INTO v_sporadic_member_ids FROM members WHERE group_id = v_group_id AND phone_e164 IN ('+5511999990011', '+5511999990012', '+5511999990013', '+5511999990014', '+5511999990015');

  -- 5 Inactive members (joined but rarely/never message)
  INSERT INTO members (group_id, name, phone_e164, is_admin, joined_at, status)
  VALUES 
    (v_group_id, 'Thiago Nascimento', '+5511999990016', false, now() - interval '5 days', 'active'),
    (v_group_id, 'Larissa Mendes', '+5511999990017', false, now() - interval '4 days', 'active'),
    (v_group_id, 'Diego Cardoso', '+5511999990018', false, now() - interval '3 days', 'active'),
    (v_group_id, 'Amanda Ribeiro', '+5511999990019', false, now() - interval '2 days', 'active'),
    (v_group_id, 'Felipe Martins', '+5511999990020', false, now() - interval '1 day', 'active');

  SELECT array_agg(id) INTO v_inactive_member_ids FROM members WHERE group_id = v_group_id AND phone_e164 IN ('+5511999990016', '+5511999990017', '+5511999990018', '+5511999990019', '+5511999990020');

  -- Get all member IDs
  SELECT array_agg(id) INTO v_member_ids FROM members WHERE group_id = v_group_id;

  -- 4. Create ~500 messages distributed over 30 days
  v_message_ids := ARRAY[]::uuid[];
  
  FOR v_i IN 1..500 LOOP
    -- Determine day offset (more recent = more messages)
    v_rand := random();
    IF v_rand < 0.06 THEN
      v_day_offset := 0; -- Today
    ELSIF v_rand < 0.35 THEN
      v_day_offset := floor(random() * 6)::integer + 1; -- Last 7 days
    ELSIF v_rand < 0.65 THEN
      v_day_offset := floor(random() * 7)::integer + 7; -- Days 7-14
    ELSE
      v_day_offset := floor(random() * 16)::integer + 14; -- Days 14-30
    END IF;

    -- Determine hour (peak at 16-17h and 10-11h)
    v_rand := random();
    IF v_rand < 0.25 THEN
      v_hour := 16 + floor(random() * 2)::integer;
    ELSIF v_rand < 0.40 THEN
      v_hour := 10 + floor(random() * 2)::integer;
    ELSIF v_rand < 0.50 THEN
      v_hour := floor(random() * 6)::integer;
    ELSE
      v_hour := floor(random() * 18)::integer + 6;
    END IF;

    v_message_ts := (now() - (v_day_offset || ' days')::interval) - ((24 - v_hour) || ' hours')::interval + (floor(random() * 60) || ' minutes')::interval;

    -- Determine member (60% active, 25% sporadic, 10% admin, 5% inactive)
    v_rand := random();
    IF v_rand < 0.60 AND array_length(v_active_member_ids, 1) > 0 THEN
      v_member_id := v_active_member_ids[1 + floor(random() * array_length(v_active_member_ids, 1))::integer];
    ELSIF v_rand < 0.85 AND array_length(v_sporadic_member_ids, 1) > 0 THEN
      v_member_id := v_sporadic_member_ids[1 + floor(random() * array_length(v_sporadic_member_ids, 1))::integer];
    ELSIF v_rand < 0.95 AND array_length(v_admin_member_ids, 1) > 0 THEN
      v_member_id := v_admin_member_ids[1 + floor(random() * array_length(v_admin_member_ids, 1))::integer];
    ELSIF array_length(v_inactive_member_ids, 1) > 0 THEN
      v_member_id := v_inactive_member_ids[1 + floor(random() * array_length(v_inactive_member_ids, 1))::integer];
    ELSE
      v_member_id := v_member_ids[1];
    END IF;

    -- Determine message type
    v_rand := random();
    IF v_rand < 0.80 THEN
      v_message_type := 'text';
    ELSIF v_rand < 0.95 THEN
      v_message_type := 'image';
    ELSIF v_rand < 0.97 THEN
      v_message_type := 'audio';
    ELSIF v_rand < 0.99 THEN
      v_message_type := 'video';
    ELSE
      v_message_type := 'document';
    END IF;

    INSERT INTO messages (group_id, member_id, message_type, message_ts, created_at, content, text, status, direction)
    VALUES (
      v_group_id,
      v_member_id,
      v_message_type,
      v_message_ts,
      v_message_ts,
      CASE v_message_type 
        WHEN 'text' THEN 'Mensagem de teste #' || v_i
        WHEN 'image' THEN '[Imagem]'
        WHEN 'audio' THEN '[Áudio]'
        WHEN 'video' THEN '[Vídeo]'
        ELSE '[Documento]'
      END,
      CASE v_message_type WHEN 'text' THEN 'Mensagem de teste #' || v_i ELSE NULL END,
      'RECEIVED',
      'inbound'
    )
    RETURNING id INTO v_message_id;

    v_message_ids := array_append(v_message_ids, v_message_id);
  END LOOP;

  -- 5. Create ~100 reactions
  FOR v_i IN 1..100 LOOP
    v_message_id := v_message_ids[1 + floor(random() * least(200, array_length(v_message_ids, 1)))::integer];
    v_member_id := v_member_ids[1 + floor(random() * array_length(v_member_ids, 1))::integer];
    v_rand := random();
    
    INSERT INTO message_reactions (group_id, message_id, member_id, emoji, reacted_at)
    VALUES (
      v_group_id,
      v_message_id,
      v_member_id,
      CASE 
        WHEN v_rand < 0.35 THEN '👍'
        WHEN v_rand < 0.55 THEN '❤️'
        WHEN v_rand < 0.75 THEN '😂'
        WHEN v_rand < 0.90 THEN '🔥'
        ELSE '👏'
      END,
      now() - (floor(random() * 30) || ' days')::interval
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 6. Update last_seen_message_at for members
  UPDATE members m
  SET last_seen_message_at = (
    SELECT MAX(message_ts) FROM messages WHERE member_id = m.id
  )
  WHERE group_id = v_group_id;

  RAISE NOTICE 'Created org: %, group: %', v_org_id, v_group_id;
END $$;