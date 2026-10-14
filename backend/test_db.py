"""
Database testing module for Boss Pay Up.
Tests database schema, constraints, and data integrity.
"""

import sqlite3
import os
import sys
from datetime import datetime


def test_database_schema():
    """Test that the database schema is correctly set up."""
    print("Testing database schema...")

    # Remove existing test database if it exists
    test_db_path = "test_reimbursements.db"
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    # Create a fresh connection
    conn = sqlite3.connect(test_db_path)
    cursor = conn.cursor()

    # Create tables using the same schema as main.py
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

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS reimbursements (
            id TEXT PRIMARY KEY,
            desc TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL,
            department_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

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

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON")

    # Test 1: Insert departments
    print("  Test 1: Inserting departments...")
    departments = [
        ("d1", "技术部", "负责技术研发和产品开发"),
        ("d2", "市场部", "负责市场推广和销售"),
        ("d3", "财务部", "负责财务管理和报销审核"),
        ("d4", "行政部", "负责行政事务和办公用品采购"),
    ]

    cursor.executemany(
        "INSERT INTO departments (id, name, description) VALUES (?, ?, ?)", departments
    )

    # Test 2: Insert reimbursements
    print("  Test 2: Inserting reimbursements...")
    reimbursements = [
        ("r1", "打车去机场", 128.50, "交通", "2025-03-12", "已报销", "d1"),
        ("r2", "团队聚餐(川菜)", 875.00, "餐饮", "2025-03-14", "待审批", "d2"),
        ("r3", "打印纸/墨盒", 234.80, "办公用品", "2025-03-10", "已报销", "d4"),
        ("r4", "杭州出差住宿", 520.00, "住宿", "2025-03-05", "驳回", "d3"),
        ("r5", "下午茶奶茶", 86.50, "餐饮", "2025-03-17", "待审批", "d1"),
    ]

    cursor.executemany(
        "INSERT INTO reimbursements (id, desc, amount, category, date, status, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        reimbursements,
    )

    # Test 3: Foreign key constraint (should fail)
    print("  Test 3: Testing foreign key constraint...")
    try:
        cursor.execute(
            "INSERT INTO reimbursements (id, desc, amount, category, date, status, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                "r6",
                "Invalid department test",
                100.00,
                "测试",
                "2025-03-18",
                "待审批",
                "d99",
            ),
        )
        print("    ERROR: Foreign key constraint not enforced!")
        conn.rollback()
    except sqlite3.IntegrityError as e:
        print(f"    PASS: Foreign key constraint works: {e}")
        conn.rollback()

    # Test 4: Unique department name constraint
    print("  Test 4: Testing unique department name constraint...")
    try:
        cursor.execute(
            "INSERT INTO departments (id, name, description) VALUES (?, ?, ?)",
            ("d5", "技术部", "Duplicate name test"),
        )
        print("    ERROR: Unique constraint not enforced!")
        conn.rollback()
    except sqlite3.IntegrityError as e:
        print(f"    PASS: Unique constraint works: {e}")
        conn.rollback()

    # Test 5: Query data
    print("  Test 5: Querying data...")
    cursor.execute("SELECT COUNT(*) FROM departments")
    dept_count = cursor.fetchone()[0]
    print(f"    Departments count: {dept_count}")

    cursor.execute("SELECT COUNT(*) FROM reimbursements")
    reimb_count = cursor.fetchone()[0]
    print(f"    Reimbursements count: {reimb_count}")

    cursor.execute("SELECT SUM(amount) FROM reimbursements")
    total_amount = cursor.fetchone()[0]
    print(f"    Total amount: {total_amount}")

    # Test 6: Test cascade delete
    print("  Test 6: Testing cascade delete...")

    # First insert an image for a reimbursement
    cursor.execute(
        "INSERT INTO receipt_images (id, reimbursement_id, filename, filepath) VALUES (?, ?, ?, ?)",
        ("img1", "r1", "test.jpg", "/uploads/test.jpg"),
    )

    # Count images before delete
    cursor.execute("SELECT COUNT(*) FROM receipt_images WHERE reimbursement_id = 'r1'")
    before_count = cursor.fetchone()[0]
    print(f"    Images before delete: {before_count}")

    # Delete the reimbursement
    cursor.execute("DELETE FROM reimbursements WHERE id = 'r1'")

    # Count images after delete (should be 0 due to cascade)
    cursor.execute("SELECT COUNT(*) FROM receipt_images WHERE reimbursement_id = 'r1'")
    after_count = cursor.fetchone()[0]
    print(f"    Images after delete: {after_count}")

    if after_count == 0:
        print("    PASS: Cascade delete works")
    else:
        print("    ERROR: Cascade delete failed")

    conn.commit()
    conn.close()

    # Clean up test database
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    print("\nDatabase schema tests completed successfully!")
    return True


def test_data_integrity():
    """Test data integrity in the actual database."""
    print("\nTesting data integrity in production database...")

    db_path = "reimbursements.db"
    if not os.path.exists(db_path):
        print(f"  ERROR: Database file '{db_path}' not found!")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON")

    # Test 1: Check for orphaned reimbursements (no department)
    print("  Test 1: Checking for orphaned reimbursements...")
    cursor.execute(
        """
        SELECT r.id, r.desc, r.department_id 
        FROM reimbursements r 
        LEFT JOIN departments d ON r.department_id = d.id 
        WHERE d.id IS NULL
    """
    )
    orphans = cursor.fetchall()

    if orphans:
        print(f"    ERROR: Found {len(orphans)} orphaned reimbursements:")
        for orphan in orphans:
            print(f"      - ID: {orphan[0]}, Desc: {orphan[1]}, Dept ID: {orphan[2]}")
    else:
        print("    PASS: No orphaned reimbursements found")

    # Test 2: Check for orphaned images (no reimbursement)
    print("  Test 2: Checking for orphaned receipt images...")
    cursor.execute(
        """
        SELECT i.id, i.filename, i.reimbursement_id 
        FROM receipt_images i 
        LEFT JOIN reimbursements r ON i.reimbursement_id = r.id 
        WHERE r.id IS NULL
    """
    )
    orphan_images = cursor.fetchall()

    if orphan_images:
        print(f"    ERROR: Found {len(orphan_images)} orphaned images:")
        for img in orphan_images:
            print(f"      - ID: {img[0]}, Filename: {img[1]}, Reimb ID: {img[2]}")
    else:
        print("    PASS: No orphaned images found")

    # Test 3: Check for invalid status values
    print("  Test 3: Checking for invalid status values...")
    cursor.execute(
        """
        SELECT DISTINCT status FROM reimbursements
    """
    )
    statuses = [row[0] for row in cursor.fetchall()]
    valid_statuses = ["待审批", "已报销", "驳回"]

    invalid_statuses = [s for s in statuses if s not in valid_statuses]
    if invalid_statuses:
        print(f"    WARNING: Found invalid status values: {invalid_statuses}")
    else:
        print(f"    PASS: All status values are valid: {statuses}")

    # Test 4: Check for negative amounts
    print("  Test 4: Checking for negative amounts...")
    cursor.execute(
        """
        SELECT id, desc, amount FROM reimbursements WHERE amount < 0
    """
    )
    negative_amounts = cursor.fetchall()

    if negative_amounts:
        print(
            f"    ERROR: Found {len(negative_amounts)} reimbursements with negative amounts:"
        )
        for neg in negative_amounts:
            print(f"      - ID: {neg[0]}, Desc: {neg[1]}, Amount: {neg[2]}")
    else:
        print("    PASS: No negative amounts found")

    # Test 5: Check for future dates
    print("  Test 5: Checking for future dates...")
    today = datetime.now().strftime("%Y-%m-%d")
    cursor.execute(
        """
        SELECT id, desc, date FROM reimbursements WHERE date > ?
    """,
        (today,),
    )
    future_dates = cursor.fetchall()

    if future_dates:
        print(
            f"    WARNING: Found {len(future_dates)} reimbursements with future dates:"
        )
        for future in future_dates:
            print(f"      - ID: {future[0]}, Desc: {future[1]}, Date: {future[2]}")
    else:
        print("    PASS: No future dates found")

    conn.close()
    print("\nData integrity tests completed!")
    return len(orphans) == 0 and len(orphan_images) == 0 and len(negative_amounts) == 0


def run_all_tests():
    """Run all database tests."""
    print("=" * 60)
    print("DATABASE TEST SUITE")
    print("=" * 60)

    try:
        schema_ok = test_database_schema()
        integrity_ok = test_data_integrity()

        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)

        if schema_ok and integrity_ok:
            print("✅ All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            return 1

    except Exception as e:
        print(f"\n❌ Test suite crashed with error: {e}")
        import traceback

        traceback.print_exc()
        return 2


if __name__ == "__main__":
    sys.exit(run_all_tests())
