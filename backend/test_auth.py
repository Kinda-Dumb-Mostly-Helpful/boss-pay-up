"""Exercise authentication HTTP flows in an isolated, rolled-back schema."""
from contextlib import contextmanager
from unittest.mock import patch
import uuid
import psycopg2
from fastapi.testclient import TestClient
from backend.database.connection import DB_CONFIG
from backend.controllers import auth, batches
from backend.main import app


def run():
    conn = psycopg2.connect(**DB_CONFIG)
    class Transaction:
        def cursor(self, *args, **kwargs):
            return conn.cursor(*args, **kwargs)
        def commit(self):
            pass
    @contextmanager
    def connection():
        yield Transaction()
    try:
        with conn.cursor() as cursor:
            schema = 'auth_test_' + uuid.uuid4().hex
            cursor.execute(f'CREATE SCHEMA {schema}')
            cursor.execute(f'SET LOCAL search_path TO {schema}')
            for table in ['departments', 'reimbursements', 'receipt_images']:
                cursor.execute(f'CREATE TABLE {table} (LIKE public.{table} INCLUDING DEFAULTS)')
            cursor.execute("INSERT INTO departments(id,name) VALUES ('d','Test')")
            cursor.execute('INSERT INTO reimbursements(id,"desc",amount,category,date,status,department_id) VALUES (\'r\',\'Test\',10,\'Test\',\'2026-10-12\',\'待审批\',\'d\')')
        with patch.object(auth, 'get_db_connection', connection), patch.object(batches, 'get_db_connection', connection):
            auth.init_auth()
            batches.init_batches()
            client = TestClient(app)
            for path in ['/api/reimbursements/', '/api/approval-batches', '/api/upload/test.png', '/api/auth/users']:
                assert client.get(path).status_code == 401
            assert client.post('/api/exports/reimbursements.xlsx', json={'ids':['r']}).status_code == 401
            assert client.post('/api/uploads').status_code == 401
            assert client.get('/api/auth/setup-status').json()['needs_setup']
            admin = dict(username='AdminTest', password='Test-password-2026', display_name='Test Admin')
            assert client.post('/api/auth/setup', json=admin, headers={'Origin':'http://evil.example'}).status_code == 403
            assert client.post('/api/auth/setup', json=admin).status_code == 200
            assert client.post('/api/auth/setup', json=admin).status_code == 403
            assert not client.get('/api/auth/setup-status').json()['needs_setup']
            assert client.post('/api/auth/login', json={**admin, 'password':'wrong'}).status_code == 401
            response = client.post('/api/auth/login', json=admin)
            assert response.status_code == 200
            assert 'httponly' in response.headers['set-cookie'].lower()
            assert 'password' not in str(response.json())
            assert client.get('/api/auth/me').json()['role'] == 'admin'
            assert client.post('/api/auth/preferences', json={'language':'en','currency':'USD'}).status_code == 200
            other_device = TestClient(app)
            second_login = other_device.post('/api/auth/login', json=admin).json()
            assert second_login['language'] == 'en' and second_login['currency'] == 'USD'
            assert other_device.get('/api/auth/me').json()['currency'] == 'USD'
            for language in ['zh-CN', 'zh-TW', 'en', 'km', 'es', 'vi', 'hi']:
                saved = client.post('/api/auth/preferences', json={'language':language,'currency':'USD'})
                assert saved.status_code == 200 and saved.json()['language'] == language
                assert other_device.get('/api/auth/me').json()['language'] == language
                login_again = other_device.post('/api/auth/login', json=admin)
                assert login_again.json()['language'] == language
                assert login_again.json()['currency'] == 'USD'
            print('PASS: all seven languages persist across sessions without changing currency')
            assert client.post('/api/auth/preferences', json={'language':'invalid','currency':'USD'}).status_code == 422
            member = dict(username='member', password='Another-password-2026', display_name='Test Member', role='user')
            assert client.post('/api/auth/users', json=member).status_code == 200
            assert client.post('/api/auth/users', json=member).status_code == 409
            assert client.post('/api/auth/users', json={**member, 'username':'weak', 'password':'short'}).status_code == 422
            old_cookie = client.cookies.get(auth.COOKIE)
            assert client.post('/api/auth/logout').status_code == 200
            assert client.get('/api/auth/me').status_code == 401
            assert client.get('/api/auth/me', headers={'Cookie': f'{auth.COOKIE}={old_cookie}'}).status_code == 401
            assert client.post('/api/auth/login', json=member).status_code == 200
            assert client.get('/api/auth/me').json()['language'] == 'zh-CN'
            assert client.get('/api/auth/me').json()['currency'] == 'CNY'
            assert client.get('/api/auth/users').status_code == 403
            assert client.post('/api/auth/users', json=admin).status_code == 403
            result = client.post('/api/approval-batches', json={'ids':['r'], 'operator':'Forged Admin', 'currency':'CNY'})
            assert result.status_code == 200, result.text
            archive = client.get('/api/approval-batches').json()[0]
            assert archive['events'][0]['operator'] == 'Test Member（member）'
            assert client.post('/api/approval-batches/'+result.json()['id']+'/actions', json={'action':'approve','operator':'Forged Admin'}).status_code == 200
            assert client.get('/api/approval-batches').json()[0]['events'][1]['operator'] == 'Test Member（member）'
            with conn.cursor() as cursor:
                cursor.execute('UPDATE app_sessions SET expires_at=NOW()-INTERVAL \'1 second\'')
            assert client.get('/api/auth/me').status_code == 401
            for _ in range(5):
                assert client.post('/api/auth/login', json={**member, 'password':'wrong'}).status_code == 401
            assert client.post('/api/auth/login', json=member).status_code == 429
            print('PASS: setup, password validation, login/logout/expiry, cookie, protected endpoints, admin checks, login throttling, trusted approval identity')
    finally:
        conn.rollback()
        conn.close()


if __name__ == '__main__':
    run()
