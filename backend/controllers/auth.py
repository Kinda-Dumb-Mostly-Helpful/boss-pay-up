import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from psycopg2.extras import RealDictCursor
from backend.database.connection import get_db_connection

router = APIRouter(prefix="/api/auth", tags=["authentication"])
COOKIE = "reimbursement_session"
SESSION_SECONDS = 8 * 60 * 60


def init_auth():
    with get_db_connection() as conn, conn.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_users (
                id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
                role TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS app_sessions (
                token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id),
                expires_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE IF NOT EXISTS login_attempts (
                username TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0,
                blocked_until TIMESTAMPTZ
            );
            ALTER TABLE app_users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'zh-CN';
            ALTER TABLE app_users ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'CNY';
        """)
        conn.commit()


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600000).hex()
    return f"{salt}${digest}"


def verify_password(password, stored):
    salt, expected = stored.split('$')
    actual = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600000).hex()
    return hmac.compare_digest(actual, expected)


def current_user(request: Request):
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    with get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("""SELECT u.id,u.username,u.display_name,u.role,u.language,u.currency,s.expires_at FROM app_sessions s
            JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=%s AND s.expires_at>NOW()""",
            (hashlib.sha256(token.encode()).hexdigest(),))
        return cursor.fetchone()


class Login(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)

    @field_validator('username')
    @classmethod
    def normalize_username(cls, value):
        value = value.strip().lower()
        if not value:
            raise ValueError('请输入用户名')
        return value


class NewUser(Login):
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=64)
    role: Literal['admin', 'user'] = 'user'

    @field_validator('display_name')
    @classmethod
    def validate_name(cls, value):
        if not value.strip():
            raise ValueError('请输入姓名')
        return value.strip()


def insert_user(cursor, data, role):
    cursor.execute("SELECT 1 FROM app_users WHERE username=%s", (data.username,))
    if cursor.fetchone():
        raise HTTPException(409, '用户名已存在')
    user = dict(id=str(uuid.uuid4()), username=data.username, display_name=data.display_name, role=role)
    cursor.execute("INSERT INTO app_users(id,username,display_name,password_hash,role) VALUES(%s,%s,%s,%s,%s)",
                   (user['id'], user['username'], user['display_name'], hash_password(data.password), role))
    return user


@router.get('/setup-status')
def setup_status():
    with get_db_connection() as conn, conn.cursor() as cursor:
        cursor.execute('SELECT EXISTS(SELECT 1 FROM app_users)')
        return {'needs_setup': not cursor.fetchone()[0]}


@router.post('/setup')
def setup(data: NewUser):
    with get_db_connection() as conn, conn.cursor() as cursor:
        cursor.execute('LOCK TABLE app_users IN EXCLUSIVE MODE')
        cursor.execute('SELECT 1 FROM app_users LIMIT 1')
        if cursor.fetchone():
            raise HTTPException(403, '系统已初始化，请登录或联系管理员')
        user = insert_user(cursor, data, 'admin')
        conn.commit()
    return user


@router.post('/login')
def login(data: Login, response: Response, request: Request):
    with get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute('INSERT INTO login_attempts(username) VALUES(%s) ON CONFLICT DO NOTHING', (data.username,))
        cursor.execute('SELECT * FROM login_attempts WHERE username=%s FOR UPDATE', (data.username,))
        attempt = cursor.fetchone()
        now = datetime.now(timezone.utc)
        if attempt['blocked_until'] and attempt['blocked_until'] > now:
            raise HTTPException(429, '登录失败次数过多，请 5 分钟后重试')
        cursor.execute('SELECT * FROM app_users WHERE username=%s', (data.username,))
        user = cursor.fetchone()
        stored = user['password_hash'] if user else '00' * 16 + '$' + '00' * 32
        if not verify_password(data.password, stored) or not user:
            failures = (0 if attempt['blocked_until'] else attempt['failures']) + 1
            cursor.execute('UPDATE login_attempts SET failures=%s,blocked_until=%s WHERE username=%s',
                           (failures, now + timedelta(minutes=5) if failures >= 5 else None, data.username))
            conn.commit()
            raise HTTPException(401, '用户名或密码错误')
        cursor.execute('DELETE FROM login_attempts WHERE username=%s', (data.username,))
        cursor.execute('DELETE FROM app_sessions WHERE expires_at<=NOW()')
        old_token = request.cookies.get(COOKIE)
        if old_token:
            cursor.execute('DELETE FROM app_sessions WHERE token_hash=%s', (hashlib.sha256(old_token.encode()).hexdigest(),))
        token = secrets.token_urlsafe(32)
        cursor.execute('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES(%s,%s,%s)',
                       (hashlib.sha256(token.encode()).hexdigest(), user['id'], now + timedelta(seconds=SESSION_SECONDS)))
        conn.commit()
    response.set_cookie(COOKIE, token, httponly=True, samesite='lax', secure=os.getenv('COOKIE_SECURE') == '1', max_age=SESSION_SECONDS)
    return {**{key: user[key] for key in ('id','username','display_name','role','language','currency')}, 'expires_at': now + timedelta(seconds=SESSION_SECONDS)}


@router.get('/me')
def me(request: Request):
    return request.state.user


@router.post('/dev-login')
def dev_login(request: Request, response: Response):
    if os.getenv('APP_ENV') != 'development' or os.getenv('DEV_AUTO_LOGIN') != '1':
        raise HTTPException(404, 'Not found')
    if not request.client or request.client.host not in ('127.0.0.1', '::1'):
        raise HTTPException(403, '开发登录仅允许本机访问')
    if request.url.hostname not in ('localhost', '127.0.0.1', '::1'):
        raise HTTPException(403, '开发登录仅允许本机地址')
    with get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute('SELECT id,username,display_name,role,language,currency FROM app_users WHERE username=%s',
                       (os.getenv('DEV_LOGIN_USER', 'admin'),))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(409, '开发账号不存在，请先创建账号')
        token = secrets.token_urlsafe(32)
        cursor.execute('DELETE FROM app_sessions WHERE expires_at<=NOW()')
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)
        cursor.execute('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES(%s,%s,%s)',
                       (hashlib.sha256(token.encode()).hexdigest(), user['id'], expires_at))
        conn.commit()
    response.set_cookie(COOKIE, token, httponly=True, samesite='lax', secure=os.getenv('COOKIE_SECURE') == '1', max_age=SESSION_SECONDS)
    return {**user, 'expires_at': expires_at}


@router.post('/logout')
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE, '')
    with get_db_connection() as conn, conn.cursor() as cursor:
        cursor.execute('DELETE FROM app_sessions WHERE token_hash=%s', (hashlib.sha256(token.encode()).hexdigest(),))
        conn.commit()
    response.delete_cookie(COOKIE)
    return {'message': '已退出登录'}


@router.get('/users')
def users(request: Request):
    if request.state.user['role'] != 'admin':
        raise HTTPException(403, '仅管理员可管理用户')
    with get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute('SELECT id,username,display_name,role FROM app_users ORDER BY created_at')
        return cursor.fetchall()


class Preferences(BaseModel):
    language: Literal['zh-CN', 'zh-TW', 'en', 'km', 'es', 'vi', 'hi']
    currency: Literal['CNY', 'USD', 'KHR', 'VND', 'INR', 'EUR', 'HKD', 'SGD']


@router.post('/preferences')
def save_preferences(data: Preferences, request: Request):
    with get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute('UPDATE app_users SET language=%s,currency=%s WHERE id=%s RETURNING id,username,display_name,role,language,currency',
                       (data.language, data.currency, request.state.user['id']))
        user = cursor.fetchone()
        conn.commit()
        return user


@router.post('/users')
def add_user(data: NewUser, request: Request):
    if request.state.user['role'] != 'admin':
        raise HTTPException(403, '仅管理员可管理用户')
    with get_db_connection() as conn, conn.cursor() as cursor:
        cursor.execute('LOCK TABLE app_users IN EXCLUSIVE MODE')
        user = insert_user(cursor, data, data.role)
        conn.commit()
        return user
