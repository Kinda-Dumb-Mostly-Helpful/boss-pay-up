import psycopg2
import uuid
from datetime import datetime
from .connection import DB_CONFIG


def init_db():
    """Initialize database with required tables and default data."""
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cursor = conn.cursor()

    try:
        # Create departments table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS departments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create reimbursements table with department_id column and receipt_filename
        cursor.execute(
            """
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
            )
        """
        )

        # Create receipt_images table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS receipt_images (
                id TEXT PRIMARY KEY,
                reimbursement_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (reimbursement_id) REFERENCES reimbursements (id) ON DELETE CASCADE
            )
        """
        )

        # Add foreign key constraint if not exists
        cursor.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'reimbursements_department_id_fkey'
                    AND table_name = 'reimbursements'
                ) THEN
                    ALTER TABLE reimbursements
                    ADD CONSTRAINT reimbursements_department_id_fkey
                    FOREIGN KEY (department_id) REFERENCES departments (id);
                END IF;
            END $$;
        """
        )

        cursor.execute("""CREATE TABLE IF NOT EXISTS reimbursement_voids (
            reimbursement_id TEXT PRIMARY KEY REFERENCES reimbursements(id),
            reason TEXT NOT NULL, operator TEXT NOT NULL, operator_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def seed_default_data():
    """Insert default departments and sample reimbursements if tables are empty."""
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cursor = conn.cursor()

    try:
        # Insert default departments if none exist
        cursor.execute("SELECT COUNT(*) FROM departments")
        count = cursor.fetchone()[0]
        if count == 0:
            default_departments = [
                ("d1", "技术部", "负责技术研发和产品开发"),
                ("d2", "市场部", "负责市场推广和销售"),
                ("d3", "财务部", "负责财务管理和报销审核"),
                ("d4", "行政部", "负责行政事务和办公用品采购"),
            ]
            # Use ON CONFLICT DO NOTHING for PostgreSQL
            for dept in default_departments:
                cursor.execute(
                    "INSERT INTO departments (id, name, description) VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING",
                    dept,
                )
            conn.commit()

        # Insert some sample reimbursements if table is empty
        cursor.execute("SELECT COUNT(*) FROM reimbursements")
        count = cursor.fetchone()[0]
        if count == 0:
            sample_data = [
                ("r1", "打车去机场", 128.50, "交通", "2025-03-12", "已报销", "d1"),
                ("r2", "团队聚餐(川菜)", 875.00, "餐饮", "2025-03-14", "待审批", "d2"),
                ("r3", "打印纸/墨盒", 234.80, "办公用品", "2025-03-10", "已报销", "d4"),
                ("r4", "杭州出差住宿", 520.00, "住宿", "2025-03-05", "驳回", "d3"),
                ("r5", "下午茶奶茶", 86.50, "餐饮", "2025-03-17", "待审批", "d1"),
            ]
            for data in sample_data:
                cursor.execute(
                    'INSERT INTO reimbursements (id, "desc", amount, category, date, status, department_id) VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING',
                    data,
                )
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
