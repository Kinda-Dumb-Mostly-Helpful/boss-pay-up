"""Integration test using an isolated, rolled-back PostgreSQL schema."""
import uuid
from contextlib import contextmanager
from unittest.mock import patch
from types import SimpleNamespace
import psycopg2
from fastapi import HTTPException
from backend.database.connection import DB_CONFIG
from backend.controllers import batches
from backend.controllers import reimbursement


def run():
    conn = psycopg2.connect(**DB_CONFIG)
    schema = 'batch_test_' + uuid.uuid4().hex
    http_request = SimpleNamespace(state=SimpleNamespace(user={'id': 'tester', 'username': 'tester', 'display_name': 'Tester'}))
    class Transaction:
        def cursor(self, *args, **kwargs):
            return conn.cursor(*args, **kwargs)
        def commit(self):
            pass
    @contextmanager
    def connection():
        yield Transaction()
    def conflict(operation):
        try:
            operation()
        except HTTPException as error:
            assert error.status_code == 409
        else:
            raise AssertionError('Expected conflict')
    try:
        with conn.cursor() as cursor:
            cursor.execute(f'CREATE SCHEMA {schema}')
            cursor.execute(f'SET LOCAL search_path TO {schema}')
            for table in ['departments', 'reimbursements', 'receipt_images']:
                cursor.execute(f'CREATE TABLE {table} (LIKE public.{table} INCLUDING DEFAULTS)')
            cursor.execute('CREATE TABLE reimbursement_voids (reimbursement_id TEXT PRIMARY KEY, reason TEXT, operator TEXT, operator_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
            cursor.execute("INSERT INTO departments(id,name) VALUES ('d','Test')")
            for record in ['a', 'b', 'c']:
                cursor.execute('INSERT INTO reimbursements(id,"desc",amount,category,date,status,department_id) VALUES (%s,\'Original\',10,\'Test\',\'2026-10-12\',\'待审批\',\'d\')', (record,))
        with patch.object(batches, 'get_db_connection', connection), patch.object(reimbursement, 'get_db_connection', connection):
            batches.init_batches()
            def create(ids):
                return batches.create_batch(batches.CreateBatch(ids=ids,title='Test batch',currency='KHR'), http_request)['id']
            def act(id, action):
                return batches.act_on_batch(id,batches.BatchAction(action=action,note='Test note'), http_request)
            first = create(['a','b'])
            conflict(lambda: create(['a']))
            conflict(lambda: act(first,'reimburse'))
            with conn.cursor() as cursor:
                conflict(lambda: batches.ensure_unbatched(cursor,['a']))
            act(first,'approve')
            act(first,'reimburse')
            conflict(lambda: act(first,'reimburse'))
            with conn.cursor() as cursor:
                cursor.execute("SELECT status FROM reimbursements WHERE id IN ('a','b')")
                assert all(row[0] == '已报销' for row in cursor.fetchall())
            second = create(['c'])
            act(second,'reject')
            conflict(lambda: create(['c']))
            with conn.cursor() as cursor:
                batches.ensure_unbatched(cursor,['c'])
                cursor.execute('UPDATE reimbursements SET "desc"=\'Revised\', status=\'待审批\' WHERE id=\'c\'')
            create(['c'])
            archives = {batch['id']:batch for batch in batches.list_batches()}
            assert archives[second]['items'][0]['desc'] == 'Original'
            assert archives[first]['currency'] == 'KHR'
            assert [event['action'] for event in archives[first]['events']] == ['提交','已批准','已报销']
            with conn.cursor() as cursor:
                cursor.execute('INSERT INTO reimbursements(id,"desc",amount,category,date,status,department_id) VALUES (\'void-test\',\'Void\',10,\'Test\',\'2026-10-12\',\'待审批\',\'d\')')
            conflict(lambda: reimbursement.void_reimbursement('a', reimbursement.VoidRequest(reason='test'), http_request))
            data = reimbursement.ReimbursementUpdate(desc='changed',amount=10,category='Test',date='2026-10-12',status='待审批',department_id='d')
            conflict(lambda: reimbursement.update_reimbursement('a', data))
            try:
                reimbursement.void_reimbursement('void-test', reimbursement.VoidRequest(reason='   '), http_request)
                raise AssertionError('Blank reason accepted')
            except HTTPException as error:
                assert error.status_code == 422
            reimbursement.void_reimbursement('void-test', reimbursement.VoidRequest(reason='Duplicate receipt'), http_request)
            conflict(lambda: reimbursement.update_reimbursement('void-test', data))
            conflict(lambda: reimbursement.void_reimbursement('void-test', reimbursement.VoidRequest(reason='again'), http_request))
            conflict(lambda: create(['void-test']))
            try:
                reimbursement.delete_reimbursement('void-test')
                raise AssertionError('Deletion allowed')
            except HTTPException as error:
                assert error.status_code == 405
            with conn.cursor() as cursor:
                cursor.execute("SELECT status FROM reimbursements WHERE id='void-test'")
                assert cursor.fetchone()[0] == '已报废'
                cursor.execute("SELECT reason,operator_id FROM reimbursement_voids WHERE reimbursement_id='void-test'")
                assert cursor.fetchone() == ('Duplicate receipt','tester')
            print('PASS: void reason/audit, retained record, no deletion, paid/void edit locks, no void resubmission')
            print('PASS: snapshots, duplicate prevention, approval gate, batch payment, edit lock, rejection/resubmission, audit history')
    finally:
        conn.rollback()
        conn.close()


if __name__ == '__main__':
    run()
