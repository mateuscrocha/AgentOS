-- Seed Organizations
INSERT INTO organizations (id, name, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Acme Corporation', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Beta Industries', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Gamma Tech', 'inactive');

-- Seed Groups
INSERT INTO groups (id, name, organization_id, provider) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme - Vendas', '11111111-1111-1111-1111-111111111111', 'whatsapp'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Acme - Suporte', '11111111-1111-1111-1111-111111111111', 'whatsapp'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Beta - Marketing', '22222222-2222-2222-2222-222222222222', 'whatsapp'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Gamma - Geral', '33333333-3333-3333-3333-333333333333', 'whatsapp');

-- Seed Members
INSERT INTO members (id, name, phone, group_id, is_admin) VALUES
  ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'João Silva', '+5511999990001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true),
  ('22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Maria Santos', '+5511999990002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false),
  ('33333333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pedro Costa', '+5511999990003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false),
  ('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Ana Oliveira', '+5511999990004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true),
  ('22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Carlos Lima', '+5511999990005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false),
  ('11111111-cccc-cccc-cccc-cccccccccccc', 'Lucas Ferreira', '+5511999990006', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true),
  ('22222222-cccc-cccc-cccc-cccccccccccc', 'Julia Almeida', '+5511999990007', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false),
  ('11111111-dddd-dddd-dddd-dddddddddddd', 'Fernando Rocha', '+5511999990008', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);

-- Seed Messages
INSERT INTO messages (group_id, member_id, content, message_type) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bom dia equipe! Temos uma reunião hoje às 10h.', 'text'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Confirmado! Estarei presente.', 'text'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Também confirmo presença.', 'text'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Novo ticket de suporte recebido.', 'text'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Estou analisando o caso.', 'text'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-cccc-cccc-cccc-cccccccccccc', 'Campanha de marketing aprovada!', 'text'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-cccc-cccc-cccc-cccccccccccc', 'Ótimo! Vou preparar os materiais.', 'text'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-dddd-dddd-dddd-dddddddddddd', 'Bem-vindos ao grupo da Gamma Tech.', 'text');

-- Assign SYSTEM_ADMIN role to existing user (eu@rochamateus.com.br)
INSERT INTO user_roles (user_id, role) VALUES
  ('06cb58c0-7019-4f92-acb6-a8dc3b3b4a46', 'SYSTEM_ADMIN')
ON CONFLICT DO NOTHING;