# SkinGuru — AI Healthcare Skin Disease Detection

A full-stack web application for AI-powered skin lesion screening.  
**Stack:** FastAPI · MongoDB Atlas · React · Tailwind CSS · JWT + Google OAuth · RBAC

---

## Architecture

```
Skin-guru/
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   │   ├── dependencies.py   # JWT middleware + RBAC guard
│   │   │   ├── routes.py         # Auth API routes (register/login/logout/oauth/profile)
│   │   │   └── security.py       # bcrypt + JWT encode/decode helpers
│   │   ├── db/
│   │   │   └── mongo.py          # MongoDB Atlas connection + index creation
│   │   ├── models/
│   │   │   └── user.py           # UserRole enum, user document helpers
│   │   ├── ml/
│   │   │   └── service.py        # ANN/CNN/Ensemble model inference
│   │   ├── config.py             # All env-var configuration
│   │   ├── constants.py          # HAM10000 class labels
│   │   ├── main.py               # FastAPI app, CORS, router inclusion
│   │   └── schemas.py            # Pydantic request/response models
│   ├── models/                   # Saved Keras model files
│   ├── scripts/
│   │   └── train_models.py       # Standalone training script
│   ├── .env.example              # Environment variable template
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── auth/
    │   │   ├── AuthContext.jsx   # Global auth state + API integration
    │   │   └── ProtectedRoute.jsx # Route guard (auth + RBAC)
    │   ├── components/
    │   │   ├── auth/
    │   │   │   ├── AuthShell.jsx         # Two-column auth page layout
    │   │   │   └── GoogleSignInButton.jsx # Google GSI button loader
    │   │   ├── icons/AppIcons.jsx
    │   │   └── layout/TopNav.jsx         # Role-aware navigation bar
    │   ├── pages/
    │   │   ├── auth/
    │   │   │   ├── LoginPage.jsx         # Email + Google login
    │   │   │   └── RegisterPage.jsx      # Registration with role picker
    │   │   ├── AdminDashboard.jsx        # Admin: users list + model training
    │   │   ├── DoctorDashboard.jsx       # Doctor: clinical workspace
    │   │   ├── HomePage.jsx              # AI scanner (main app)
    │   │   ├── PatientDashboard.jsx      # Patient: health tips + quick scan
    │   │   └── ProfilePage.jsx           # Profile view + edit
    │   ├── lib/api.js                    # API client with auto token refresh
    │   ├── App.jsx                       # React Router v6 route definitions
    │   └── main.jsx
    ├── .env.example
    └── package.json
```

---

## Setup

### 1. Install dependencies

```powershell
pip install -r backend/requirements.txt
npm.cmd install --prefix frontend
```

### 2. Configure environment variables

Copy `.env.example` files and fill in your values:

```powershell
# Backend
copy backend\.env.example backend\.env

# Frontend
copy frontend\.env.example frontend\.env
```

**Backend `.env` variables:**

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | Database name (default: `skin_guru`) |
| `JWT_SECRET_KEY` | Secret for access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET_KEY` | Secret for refresh tokens (min 32 chars) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Default: `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Default: `7` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console (optional) |
| `COOKIE_SECURE` | `true` in production (HTTPS only) |
| `FRONTEND_ORIGINS` | Comma-separated allowed origins |

**Frontend `.env` variables:**

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend URL (auto-detected on localhost) |
| `VITE_GOOGLE_CLIENT_ID` | Same as backend `GOOGLE_CLIENT_ID` |

### 3. Set up MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://mongodb.com/atlas).
2. Create a database user and allow your IP.
3. Copy the connection string into `MONGODB_URI`.
4. Indexes are created automatically on first startup.

### 4. Set up Google OAuth (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create an OAuth 2.0 Client ID (Web Application).
3. Add your frontend URL to **Authorized JavaScript Origins** (e.g., `http://localhost:5173`).
4. Copy the Client ID into both `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend).

---

## Running Locally

**Backend:**
```powershell
uvicorn backend.app.main:app --reload
# API available at http://127.0.0.1:8000
# Swagger UI at  http://127.0.0.1:8000/docs
```

**Frontend:**
```powershell
npm.cmd run dev --prefix frontend
# App available at http://127.0.0.1:5173
```

---

## Authentication System

### Flows

| Flow | Endpoint | Token storage |
|------|----------|---------------|
| Email registration | `POST /api/auth/register` | Access → sessionStorage; Refresh → HttpOnly cookie |
| Email login | `POST /api/auth/login` | Same as above |
| Google OAuth | `POST /api/auth/google` | Same as above |
| Token refresh | `POST /api/auth/refresh` | Auto-refreshed on 401 |
| Logout | `POST /api/auth/logout` | Revokes DB token hash + clears cookie |

### Security features

- 🔐 **bcrypt** password hashing (cost factor 12)
- 🎟️ **Short-lived access tokens** (15 min) + **refresh tokens** (7 days)
- 🍪 **HttpOnly** cookie for refresh tokens (XSS-safe)
- 🔄 **Token rotation** — refresh tokens are invalidated on each use and on logout
- 🛡️ **RBAC** — every protected route validates both token validity and user role
- 🔒 **Admin protection** — admin accounts cannot be created via public registration

---

## Role-Based Access Control (RBAC)

| Role | Frontend routes | Backend access |
|------|----------------|----------------|
| `patient` | `/app`, `/patient`, `/profile` | Predict, patient dashboard, own profile |
| `doctor` | `/app`, `/doctor`, `/profile` | Predict, doctor dashboard, own profile |
| `admin` | `/app`, `/patient`, `/doctor`, `/admin`, `/profile` | All endpoints + user list + model training |

---

## API Endpoints Summary

| Method | Path | Auth | Role |
|--------|------|------|------|
| `POST` | `/api/auth/register` | No | — |
| `POST` | `/api/auth/login` | No | — |
| `POST` | `/api/auth/google` | No | — |
| `POST` | `/api/auth/refresh` | Cookie | — |
| `POST` | `/api/auth/logout` | Bearer | Any |
| `GET` | `/api/auth/me` | Bearer | Any |
| `PATCH` | `/api/profile` | Bearer | Any |
| `GET` | `/api/patient/dashboard` | Bearer | patient, admin |
| `GET` | `/api/doctor/dashboard` | Bearer | doctor, admin |
| `GET` | `/api/admin/dashboard` | Bearer | admin |
| `GET` | `/api/admin/users` | Bearer | admin |
| `POST` | `/api/predict` | Bearer | Any |
| `POST` | `/api/models/train` | Bearer | admin |
| `GET` | `/api/models/status` | No | — |
| `GET` | `/api/health` | No | — |

---

## Train The Models

```powershell
python -m backend.scripts.train_models
```

Or via the Admin Dashboard UI (requires admin login).

Model files saved to:
- `backend/models/ann_model.keras`
- `backend/models/cnn_model.keras`
