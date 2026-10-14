import psycopg2
import psycopg2.extras
import contextlib
import os
from fastapi import HTTPException


# Database configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5433"),
    "database": os.getenv("DB_NAME", "reimbursement_db"),
    "user": os.getenv("DB_USER", "reimbursement_user"),
    "password": os.getenv("DB_PASSWORD", "reimbursement_pass"),
}


def get_connection_string():
    """Return connection string for PostgreSQL."""
    return f"host={DB_CONFIG['host']} port={DB_CONFIG['port']} dbname={DB_CONFIG['database']} user={DB_CONFIG['user']} password={DB_CONFIG['password']}"


# Database connection helper
@contextlib.contextmanager
def get_db_connection():
    """Context manager for database connections with proper error handling."""
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = False
        # Use DictCursor to return rows as dictionaries
        yield conn
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            conn.close()


def get_db_cursor():
    """Get a database cursor for direct operations."""
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    return conn, cursor
