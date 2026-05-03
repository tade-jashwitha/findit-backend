# 🔧 CampusFind — Backend API

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18-339933?style=for-the-badge&logo=node.js)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)
![Render](https://img.shields.io/badge/Deployed-Render-46E3B7?style=for-the-badge&logo=render)

**REST API for the CampusFind Lost & Found platform — powering item reporting, AI matching, claim verification, and Google OAuth.**

[🌐 Frontend Repo](https://github.com/tade-jashwitha/findit-frontend) · [🔌 Live API](https://findit-backend-0v6p.onrender.com/api/health)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **JWT Auth** | Email/password registration + Google OAuth via token exchange |
| 📦 **Item CRUD** | Create, read, update, delete lost & found items |
| 🤖 **AI Auto-Match** | Automatically matches new items against opposites using keyword scoring |
| 📸 **Image Upload** | Cloudinary integration via `multer-storage-cloudinary` |
| 📋 **2-Step Claim Verification** | Finder approves claim → Claimant confirms receipt → "Reunited" |
| 🔔 **Notifications** | In-app notification system for matches, claims, and reunions |
| ♾️ **Keep-Alive** | Self-ping every 10 minutes to prevent Render free-tier cold starts |
| 🌐 **CORS** | Configured for web, Capacitor (native Android), and GitHub Pages |

---

## 🚀 Tech Stack

```
Runtime:     Node.js 18
Framework:   Express 4
Database:    MongoDB Atlas (via Mongoose)
Auth:        JWT + bcryptjs + Google OAuth token exchange
Storage:     Cloudinary (images)
Deployment:  Render (free tier with keep-alive)
Validation:  express-validator
```

---

## 📡 API Endpoints

### Auth
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register with email & password |
| `POST` | `/api/auth/login` | Login → returns JWT token |
| `POST` | `/api/auth/google` | Google OAuth → exchange user info for JWT |
| `GET`  | `/api/auth/me` | Get current authenticated user |

### Items
| Method | Route | Description |
|---|---|---|
| `GET`    | `/api/items` | Browse items (filters: type, category, search, location) |
| `GET`    | `/api/items/my` | Get current user's reported items |
| `GET`    | `/api/items/:id` | Get single item details |
| `POST`   | `/api/items` | Report a new lost/found item (with image upload) |
| `PATCH`  | `/api/items/:id/status` | Update item status |
| `DELETE` | `/api/items/:id` | Delete an item |

### Claim Verification (2-Step)
| Method | Route | Description |
|---|---|---|
| `POST`  | `/api/items/:id/claim` | **Claimant:** Send a claim request with proof message |
| `PATCH` | `/api/items/:id/claim/:claimId` | **Finder (Step 1):** Approve or reject claim |
| `PATCH` | `/api/items/:id/claim/:claimId/confirm` | **Claimant (Step 2):** Confirm item received → marks "Reunited" |

### Notifications
| Method | Route | Description |
|---|---|---|
| `GET`   | `/api/notifications` | Get all notifications for current user |
| `PATCH` | `/api/notifications/:id/read` | Mark a notification as read |

### Health
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Server health check |

---

## 🗂️ Project Structure

```
backend/
├── config/
│   └── cloudinary.js      # Cloudinary + multer upload config
├── middleware/
│   └── auth.js            # JWT protect & optionalAuth middleware
├── models/
│   ├── Item.js            # Item schema (with claimRequests & matches)
│   ├── User.js            # User schema (email/google auth)
│   └── Notification.js   # Notification schema
├── routes/
│   ├── auth.js            # Auth routes (register, login, google, me)
│   ├── items.js           # Item CRUD + auto-match + claim verification
│   ├── notifications.js   # Notification routes
│   └── ai.js              # AI-powered item match routes
├── utils/
│   ├── matcher.js         # AI scoring logic for item matching
│   └── keepAlive.js       # Self-ping to prevent Render cold starts
└── server.js              # Express app setup + CORS + route mounting
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Cloudinary account
- Google Cloud project with OAuth credentials

### 1. Clone & Install

```bash
git clone https://github.com/tade-jashwitha/findit-backend.git
cd findit-backend
npm install
```

### 2. Environment Variables

Create a `.env` file:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/findit

# JWT
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend URL (for CORS)
FRONTEND_URL=https://tade-jashwitha.github.io

# Keep-alive (set to the Render service URL in production)
BACKEND_URL=https://findit-backend-0v6p.onrender.com
```

### 3. Run Locally

```bash
npm run dev    # Development with nodemon
npm start      # Production
```

---

## 🤖 AI Auto-Matching

When a new item is reported, the system automatically:

1. Fetches up to 100 active items of the **opposite type** (lost ↔ found)
2. Scores each pair using `utils/matcher.js` (0–100% match score)
3. Saves top matches on both items
4. Notifies the owner of matched items via in-app notification

**Scoring factors:** title keywords, description keywords, category, location, date proximity, AI tags.

---

## 📋 2-Step Claim Verification

```
┌─────────────────────────────────────────────────────────┐
│                    CLAIM FLOW                           │
│                                                         │
│  1. Claimant sends claim (POST /items/:id/claim)        │
│     └─► Item owner gets notification                    │
│                                                         │
│  2. Finder approves (PATCH /items/:id/claim/:claimId)   │
│     └─► status: "approved", item.status: "claimed"      │
│     └─► Claimant gets notification                      │
│                                                         │
│  3. Claimant confirms receipt (.../confirm)             │
│     └─► claim.status: "confirmed"                       │
│     └─► item.status: "reunited"                         │
│     └─► Both parties notified 🎉                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🌐 CORS Configuration

The API allows requests from:
- `http://localhost:*` — local development
- `https://localhost:*` — Capacitor Android WebView
- `capacitor://` — Capacitor iOS
- `*.netlify.app` — Netlify deployments
- `*.onrender.com` — Render preview deployments
- `*.github.io` — GitHub Pages deployment
- Custom domain (via `FRONTEND_URL` env var)

---

## ♾️ Keep-Alive (Render Free Tier)

`utils/keepAlive.js` pings the `/api/health` endpoint every **10 minutes** to prevent Render's free tier from sleeping. This is automatically started in production.

---

## 🔒 Security

- Passwords hashed with **bcryptjs** (12 rounds)
- JWT tokens expire in **7 days**
- All mutation routes protected with `protect` middleware
- Input validation via **express-validator**
- Image uploads restricted by file type and size

---

## 📄 License

MIT License — feel free to fork and adapt for your campus!
