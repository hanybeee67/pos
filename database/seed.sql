-- ================================================================
-- 에베레스트 POS 초기 시드 데이터
-- ================================================================

-- 지점 (9개)
INSERT INTO branches (name, address, phone) VALUES
  ('동대문점',  '서울 동대문구 장한로 123',   '02-1111-0001'),
  ('영등포점',  '서울 영등포구 영등포로 456',  '02-1111-0002'),
  ('동탄점',    '경기 화성시 동탄대로 789',    '031-1111-0003'),
  ('양재점',    '서울 서초구 양재천로 321',    '02-1111-0004'),
  ('룸비니점',  '서울 마포구 마포대로 654',    '02-1111-0005'),
  ('강남점',    '서울 강남구 테헤란로 111',    '02-1111-0006'),
  ('홍대점',    '서울 마포구 와우산로 222',    '02-1111-0007'),
  ('신촌점',    '서울 서대문구 신촌로 333',    '02-1111-0008'),
  ('수원점',    '경기 수원시 팔달로 444',      '031-1111-0009')
ON CONFLICT DO NOTHING;

-- 카테고리
INSERT INTO categories (name_ko, name_en, sort_order, color, icon) VALUES
  ('카레류',   'Curry',       1, '#0ECFB1', '🍛'),
  ('밥 종류',  'Rice',        2, '#F5A623', '🍚'),
  ('탄두리',   'Tandoori',    3, '#F5566B', '🍗'),
  ('난 종류',  'Naan',        4, '#8B6FE8', '🫓'),
  ('음료',     'Drinks',      5, '#4B8EF5', '🥤'),
  ('디저트',   'Dessert',     6, '#0ECFB1', '🍮'),
  ('세트메뉴', 'Set Menu',    7, '#F5A623', '🍱')
ON CONFLICT DO NOTHING;

-- 메뉴 (샘플)
INSERT INTO menus (category_id, name_ko, name_en, price, printer_target, sort_order) VALUES
  -- 카레류 (cat 1)
  (1, '치킨 커리',     'Chicken Curry',      12000, 'kitchen', 1),
  (1, '양고기 커리',   'Mutton Curry',       14000, 'kitchen', 2),
  (1, '채소 커리',     'Veg Curry',          11000, 'kitchen', 3),
  (1, '버터 치킨',     'Butter Chicken',     13000, 'kitchen', 4),
  (1, '달 커리',       'Dal Curry',          10000, 'kitchen', 5),
  (1, '참치 커리',     'Fish Curry',         13000, 'kitchen', 6),
  -- 밥 종류 (cat 2)
  (2, '필라우 라이스', 'Pilau Rice',          4000, 'kitchen', 1),
  (2, '볶음밥',        'Fried Rice',          7000, 'kitchen', 2),
  (2, '달밥',          'Dal Bhat',           10000, 'kitchen', 3),
  -- 탄두리 (cat 3)
  (3, '탄두리 치킨',   'Tandoori Chicken',   15000, 'kitchen', 1),
  (3, '탄두리 채소',   'Tandoori Veg',       12000, 'kitchen', 2),
  -- 난 종류 (cat 4)
  (4, '플레인 난',     'Plain Naan',          3000, 'kitchen', 1),
  (4, '마늘 난',       'Garlic Naan',         4000, 'kitchen', 2),
  (4, '치즈 난',       'Cheese Naan',         5000, 'kitchen', 3),
  -- 음료 (cat 5)
  (5, '라씨',          'Lassi',               5000, 'bar',     1),
  (5, '망고 라씨',     'Mango Lassi',         6000, 'bar',     2),
  (5, '차이',          'Chai',                3000, 'bar',     3),
  (5, '생수',          'Water',               1000, 'bar',     4),
  (5, '콜라',          'Coke',                3000, 'bar',     5),
  -- 세트메뉴 (cat 7)
  (7, '1인 세트 A',    'Set A (1 person)',   16000, 'kitchen', 1),
  (7, '2인 세트 B',    'Set B (2 persons)',  29000, 'kitchen', 2)
ON CONFLICT DO NOTHING;

-- 테이블 (동탄점 기준 샘플, branch_id=3)
INSERT INTO tables (branch_id, table_no, floor, seat_count, pos_x, pos_y) VALUES
  (3, '1',  '1층', 4, 5,  10),
  (3, '2',  '1층', 4, 20, 10),
  (3, '3',  '1층', 4, 35, 10),
  (3, '4',  '1층', 4, 50, 10),
  (3, '5',  '1층', 4, 65, 10),
  (3, '6',  '1층', 4, 80, 10),
  (3, '7',  '1층', 6, 5,  40),
  (3, '8',  '1층', 6, 20, 40),
  (3, '9',  '1층', 6, 35, 40),
  (3, '10', '1층', 6, 50, 40),
  (3, '11', '1층', 2, 65, 40),
  (3, '12', '1층', 2, 80, 40)
ON CONFLICT DO NOTHING;

-- 관리자 직원 (비밀번호: 1234 → bcrypt 필요, 여기선 평문 해시 플레이스홀더)
INSERT INTO staff (branch_id, name_ko, name_en, role, pin_hash) VALUES
  (3, '홍길동', 'Hong Gildong', 'admin',   '$2b$10$placeholder'),
  (3, '김직원', 'Kim Staff',    'staff',   '$2b$10$placeholder'),
  (3, '이주방', 'Lee Kitchen',  'kitchen', '$2b$10$placeholder')
ON CONFLICT DO NOTHING;
