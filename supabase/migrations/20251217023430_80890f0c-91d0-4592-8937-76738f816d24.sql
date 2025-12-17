-- Clean up test data from onboarding tests

-- Delete events related to test organizations
DELETE FROM events WHERE entity_id IN ('bd22cfb0-f28b-44fe-8962-467a3c2ef736', '4670858b-70e8-4346-88ff-d437998f15e3');

-- Delete user_roles for the test organizations
DELETE FROM user_roles WHERE organization_id IN ('bd22cfb0-f28b-44fe-8962-467a3c2ef736', '4670858b-70e8-4346-88ff-d437998f15e3');

-- Delete members from test groups
DELETE FROM members WHERE group_id IN (SELECT id FROM groups WHERE organization_id IN ('bd22cfb0-f28b-44fe-8962-467a3c2ef736', '4670858b-70e8-4346-88ff-d437998f15e3'));

-- Delete test groups
DELETE FROM groups WHERE organization_id IN ('bd22cfb0-f28b-44fe-8962-467a3c2ef736', '4670858b-70e8-4346-88ff-d437998f15e3');

-- Delete test organizations
DELETE FROM organizations WHERE id IN ('bd22cfb0-f28b-44fe-8962-467a3c2ef736', '4670858b-70e8-4346-88ff-d437998f15e3');