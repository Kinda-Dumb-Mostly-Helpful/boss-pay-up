import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from backend.database.init_db import init_db, seed_default_data
from backend.controllers.department import router as department_router
from backend.controllers.reimbursement import router as reimbursement_router
from backend.controllers.upload import router as upload_router
from backend.controllers.summary import router as summary_router
from backend.controllers.export import router as export_router
from backend.controllers.batches import router as batches_router, init_batches
from backend.controllers.auth import router as auth_router, init_auth, current_user

app = FastAPI(title="Boss Pay Up API", version="2.0.0")
allowed_origins = [value.strip() for value in os.getenv('CORS_ORIGINS', ','.join(
    f'http://{host}:{port}' for host in ('localhost', '127.0.0.1') for port in (5173, 5174, 5175, 3000, 8001)
)).split(',') if value.strip()]

@app.middleware("http")
async def authenticate(request: Request, call_next):
    public = {"/api/auth/login", "/api/auth/setup", "/api/auth/setup-status", "/api/auth/dev-login"}
    path = request.url.path.rstrip('/')
    if request.method != 'OPTIONS' and path.startswith('/api/'):
        if request.method not in ('GET', 'HEAD'):
            origin = request.headers.get('origin')
            if origin and origin not in allowed_origins:
                return JSONResponse({'detail': '请求来源不被允许'}, status_code=403)
        if path not in public:
            user = await run_in_threadpool(current_user, request)
            if not user:
                return JSONResponse({'detail': '请先登录，或登录已过期'}, status_code=401)
            request.state.user = user
    response = await call_next(request)
    if path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response

# CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(department_router)
app.include_router(reimbursement_router)
app.include_router(upload_router)
app.include_router(summary_router)
app.include_router(export_router)
app.include_router(batches_router)
app.include_router(auth_router)


# Initialize database on startup
@app.on_event("startup")
def startup_event():
    init_db()
    init_batches()
    init_auth()
    seed_default_data()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
