-- ================================================================
-- 에베레스트 POS 데이터베이스 스키마
-- Everest Restaurant Group Custom POS Schema
-- ================================================================

-- 지점 (Branches)
CREATE TABLE IF NOT EXISTS branches (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  address     TEXT,
  phone       VARCHAR(20),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 직원 (Staff)
CREATE TABLE IF NOT EXISTS staff (
  id          SERIAL PRIMARY KEY,
  branch_id   INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  name_ko     VARCHAR(50) NOT NULL,
  name_en     VARCHAR(50),
  role        VARCHAR(20) NOT NULL DEFAULT 'staff', -- 'admin','manager','staff','kitchen'
  pin_hash    VARCHAR(255),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 메뉴 카테고리 (Categories)
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name_ko     VARCHAR(50) NOT NULL,
  name_en     VARCHAR(50),
  sort_order  INTEGER DEFAULT 0,
  color       VARCHAR(7) DEFAULT '#0ECFB1',
  icon        VARCHAR(10),
  is_active   BOOLEAN DEFAULT true
);

-- 메뉴 (Menus)
CREATE TABLE IF NOT EXISTS menus (
  id              SERIAL PRIMARY KEY,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name_ko         VARCHAR(100) NOT NULL,
  name_en         VARCHAR(100),
  price           INTEGER NOT NULL,
  image_url       TEXT,
  description_ko  TEXT,
  description_en  TEXT,
  is_active       BOOLEAN DEFAULT true,
  is_sold_out     BOOLEAN DEFAULT false,
  sort_order      INTEGER DEFAULT 0,
  printer_target  VARCHAR(10) DEFAULT 'kitchen', -- 'kitchen','bar','both'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 메뉴 레시피 (Menu Recipes - 재고관리 연동용)
CREATE TABLE IF NOT EXISTS menu_recipes (
  id              SERIAL PRIMARY KEY,
  menu_id         INTEGER REFERENCES menus(id) ON DELETE CASCADE,
  ingredient_id   INTEGER NOT NULL,    -- 재고관리 앱의 재료 ID
  ingredient_name VARCHAR(100),
  qty             DECIMAL(10,3) NOT NULL,
  unit            VARCHAR(10) NOT NULL -- 'g', 'ml', 'ea'
);

-- 메뉴 옵션 그룹 (예: 맵기 선택)
CREATE TABLE IF NOT EXISTS menu_option_groups (
  id          SERIAL PRIMARY KEY,
  menu_id     INTEGER REFERENCES menus(id) ON DELETE CASCADE,
  name_ko     VARCHAR(50) NOT NULL,
  name_en     VARCHAR(50),
  is_required BOOLEAN DEFAULT false,
  multi_select BOOLEAN DEFAULT false
);

-- 메뉴 옵션 (예: 보통, 매운, 아주매운)
CREATE TABLE IF NOT EXISTS menu_options (
  id          SERIAL PRIMARY KEY,
  group_id    INTEGER REFERENCES menu_option_groups(id) ON DELETE CASCADE,
  name_ko     VARCHAR(50) NOT NULL,
  name_en     VARCHAR(50),
  price_add   INTEGER DEFAULT 0
);

-- 테이블 (Tables)
CREATE TABLE IF NOT EXISTS tables (
  id                SERIAL PRIMARY KEY,
  branch_id         INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  table_no          VARCHAR(10) NOT NULL,
  floor             VARCHAR(20) DEFAULT '1층',
  seat_count        INTEGER DEFAULT 4,
  status            VARCHAR(20) DEFAULT 'empty', -- 'empty','occupied','checkout'
  current_order_id  INTEGER,
  pos_x             INTEGER DEFAULT 0, -- 배치도 X좌표 (%)
  pos_y             INTEGER DEFAULT 0  -- 배치도 Y좌표 (%)
);

-- 주문 (Orders)
CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  branch_id     INTEGER REFERENCES branches(id),
  table_id      INTEGER REFERENCES tables(id) ON DELETE SET NULL,
  order_type    VARCHAR(20) DEFAULT 'dine-in', -- 'dine-in','takeout','delivery'
  source        VARCHAR(20) DEFAULT 'pos',     -- 'pos','torder','delivery'
  status        VARCHAR(20) DEFAULT 'pending', -- 'pending','cooking','served','paid','cancelled'
  person_count  INTEGER DEFAULT 1,
  note          TEXT,
  staff_id      INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 주문 아이템 (Order Items)
CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  menu_id     INTEGER REFERENCES menus(id) ON DELETE SET NULL,
  qty         INTEGER NOT NULL DEFAULT 1,
  unit_price  INTEGER NOT NULL,
  options     JSONB DEFAULT '[]',
  note        TEXT,
  status      VARCHAR(20) DEFAULT 'pending', -- 'pending','cooking','done','cancelled'
  printed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 결제 (Payments)
CREATE TABLE IF NOT EXISTS payments (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER REFERENCES orders(id),
  branch_id       INTEGER REFERENCES branches(id),
  method          VARCHAR(20) NOT NULL,  -- 'cash','card','mixed','membership'
  total_amount    INTEGER NOT NULL,
  cash_amount     INTEGER DEFAULT 0,
  cash_received   INTEGER DEFAULT 0,
  card_amount     INTEGER DEFAULT 0,
  card_approval_no VARCHAR(50),
  card_company    VARCHAR(30),
  card_last4      VARCHAR(4),
  points_used     INTEGER DEFAULT 0,
  coupon_id       INTEGER,
  member_id       INTEGER,
  discount_amount INTEGER DEFAULT 0,
  staff_id        INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  is_cancelled    BOOLEAN DEFAULT false,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 분할 결제 상세 (Split Payments - 현금+카드 혼합 결제용)
CREATE TABLE IF NOT EXISTS split_payments (
  id              SERIAL PRIMARY KEY,
  payment_id      INTEGER REFERENCES payments(id) ON DELETE CASCADE,
  method          VARCHAR(20) NOT NULL,
  amount          INTEGER NOT NULL,
  card_approval_no VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 멤버십 회원 (Members)
CREATE TABLE IF NOT EXISTS members (
  id            SERIAL PRIMARY KEY,
  phone         VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(50),
  total_amount  INTEGER DEFAULT 0,
  points        INTEGER DEFAULT 0,
  visit_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 멤버십 쿠폰 (Member Coupons)
CREATE TABLE IF NOT EXISTS member_coupons (
  id          SERIAL PRIMARY KEY,
  member_id   INTEGER REFERENCES members(id) ON DELETE CASCADE,
  coupon_type VARCHAR(30) DEFAULT 'free_curry',
  coupon_name VARCHAR(100),
  is_used     BOOLEAN DEFAULT false,
  issued_at   TIMESTAMPTZ DEFAULT NOW(),
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ
);

-- 멤버십 로그 (Member Logs)
CREATE TABLE IF NOT EXISTS member_logs (
  id            SERIAL PRIMARY KEY,
  member_id     INTEGER REFERENCES members(id) ON DELETE CASCADE,
  order_id      INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  amount        INTEGER,
  points_earned INTEGER DEFAULT 0,
  points_used   INTEGER DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 일 마감 (Daily Sales)
CREATE TABLE IF NOT EXISTS daily_sales (
  id                    SERIAL PRIMARY KEY,
  branch_id             INTEGER REFERENCES branches(id),
  date                  DATE NOT NULL,
  total_amount          INTEGER DEFAULT 0,
  cash_amount           INTEGER DEFAULT 0,
  card_amount           INTEGER DEFAULT 0,
  order_count           INTEGER DEFAULT 0,
  person_count          INTEGER DEFAULT 0,
  by_category           JSONB DEFAULT '{}',
  is_synced_revenue     BOOLEAN DEFAULT false,
  is_synced_inventory   BOOLEAN DEFAULT false,
  synced_at             TIMESTAMPTZ,
  closed_by             INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, date)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_branch_date ON orders(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_date ON payments(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_daily_sales_branch_date ON daily_sales(branch_id, date);
