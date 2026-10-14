-- PostgreSQL database initialization script for Boss Pay Up
-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create reimbursements table (use quoted "desc" for reserved keyword)
CREATE TABLE IF NOT EXISTS reimbursements (
    id TEXT PRIMARY KEY,
    "desc" TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    department_id TEXT DEFAULT 'd1',
    receipt_filename TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create receipt_images table with foreign key constraint
CREATE TABLE IF NOT EXISTS receipt_images (
    id TEXT PRIMARY KEY,
    reimbursement_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reimbursement_id) REFERENCES reimbursements (id) ON DELETE CASCADE
);

-- Add foreign key constraint to reimbursements table if not exists
DO $ $ BEGIN IF NOT EXISTS (
    SELECT
        1
    FROM
        information_schema.table_constraints
    WHERE
        constraint_name = 'reimbursements_department_id_fkey'
        AND table_name = 'reimbursements'
) THEN
ALTER TABLE
    reimbursements
ADD
    CONSTRAINT reimbursements_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments (id);

END IF;

END $ $;

-- Insert default departments if none exist
INSERT INTO
    departments (id, name, description)
VALUES
    ('d1', '技术部', '负责技术研发和产品开发'),
    ('d2', '市场部', '负责市场推广和销售'),
    ('d3', '财务部', '负责财务管理和报销审核'),
    ('d4', '行政部', '负责行政事务和办公用品采购') ON CONFLICT (id) DO NOTHING;

-- Insert some sample reimbursements if table is empty
INSERT INTO
    reimbursements (
        id,
        "desc",
        amount,
        category,
        date,
        status,
        department_id
    )
VALUES
    (
        'r1',
        '打车去机场',
        128.50,
        '交通',
        '2025-03-12',
        '已报销',
        'd1'
    ),
    (
        'r2',
        '团队聚餐(川菜)',
        875.00,
        '餐饮',
        '2025-03-14',
        '待审批',
        'd2'
    ),
    (
        'r3',
        '打印纸/墨盒',
        234.80,
        '办公用品',
        '2025-03-10',
        '已报销',
        'd4'
    ),
    (
        'r4',
        '杭州出差住宿',
        520.00,
        '住宿',
        '2025-03-05',
        '驳回',
        'd3'
    ),
    (
        'r5',
        '下午茶奶茶',
        86.50,
        '餐饮',
        '2025-03-17',
        '待审批',
        'd1'
    ) ON CONFLICT (id) DO NOTHING;