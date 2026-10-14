<p align="center">
  <img src="frontend/public/branding/boss-pay-up-logo-en.png" alt="Boss Pay Up" width="200" />
</p>

# Boss Pay Up · 老板打钱

**English** | [简体中文](README.zh-CN.md)

You kept the receipts. Time for the boss to pay up.

An open-source team expense app built with React, FastAPI, and PostgreSQL.

## Features

- Expense records, multiple receipt images, filters, and pagination.
- Batch approvals, archived history, and one-click reimbursement tracking.
- Excel export and PDF through the browser print dialog.
- User accounts with saved language and currency preferences.
- Seven languages with matching logos and eight display currencies.

All signed-in users share expense data. Only user management is administrator-only. Currency selection does not convert amounts.

## Quick start

Install Docker with Compose, then run in PowerShell:

```powershell
git clone https://github.com/Kinda-Dumb-Mostly-Helpful/boss-pay-up.git boss-pay-up
cd boss-pay-up
Copy-Item .env.example .env
# Set your own DB_PASSWORD in .env.
docker compose up -d --build
```

Open <http://localhost:8080> and create your administrator account.

For a domain or different port, update `CORS_ORIGINS` in `.env`. Existing installations should keep their original `COMPOSE_PROJECT_NAME` to retain data volumes.

Stop with `docker compose down`. Adding `-v` deletes database and attachment volumes.

## Contributing

Issues and pull requests are welcome: [GitHub](https://github.com/Kinda-Dumb-Mostly-Helpful/boss-pay-up).

[Login notes](backend/LOGIN.md) · [Font notes](frontend/public/fonts/README.md) · [MIT License](LICENSE)

Third-party dependencies and fonts retain their own licenses. Local Helvetica files are not distributed.
