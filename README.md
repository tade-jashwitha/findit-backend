# 🔧 CampusFind — Backend API

> **RESTful API for the CampusFind Lost & Found platform**  
> Built with Node.js · Express · MongoDB Atlas · Deployed on Render

![Node](https://img.shields.io/badge/Node.js-18-339933?logo=node.js)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)
![Render](https://img.shields.io/badge/Deployed-Render-46E3B7)

---

## 🌐 Live API

```
Base URL: https://findit-backend-0v6p.onrender.com/api
Health:   https://findit-backend-0v6p.onrender.com/api/health
```

---

## ✨ Features

### 🤖 Auto-Match Engine (`utils/matcher.js`)
- Runs automatically on every new item submission
- Compares against all opposite-type active items (max 100)
- 6-signal weighted scoring system:
  - **Title word overlap** — 30%
  - **Description word overlap** — 20%
  - **Category exact match** — 20%
  - **Location similarity** — 15%
  - **Date proximity** — 10%
  - **AI tag overlap** — 5%
- Stores top 5 matches on both items
- Creates in-app notifications for matched item owners

### 📩 Claim System
- `POST /api/items/:id/claim` — Send a claim request with message
- `PATCH /api/items/:id/claim/:claimId` — Approve / Reject a claim
- Auto-notifies both parties on every status change
- Updates item status to `"claimed"` on approval

### 🔔 Notifications System
- Notification types: `match_found` · `claim_received` · `claim_approved` · `claim_rejected`
- `GET /api/notifications` — paginated, unread-first
- `PATCH /api/notifications/read-all` — mark all as read

### 🔐 Auth
- JWT-based login with `7d` expiry
- Google OAuth 2.0 (returns JWT, same as email login)
- Protected routes via `protect` middleware
- Optional auth via `optionalAuth` for anonymous reports

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                EXPRESS APPLICATION                       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  /auth   │  │  /items  │  │   /ai    │  │/notifs │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│                      │                                  │
│         ┌────────────▼──────────────┐                  │
│         │   utils/matcher.js        │                  │
│         │   Auto-match engine       │                  │
│         └───────────────────────────┘                  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │                Middleware                        │  │
│  │  CORS · Helmet · Morgan · JWT Auth · Multer      │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│ MongoDB │  │Cloudinary│  │ Gemini   │
│  Atlas  │  │ (Images) │  │   AI     │
└─────────┘  └──────────┘  └──────────┘
```

---

## 📁 Project Structure

```
backend/
├── config/
│   └── cloudinary.js         # Multer + Cloudinary upload config
├── middleware/
│   └── auth.js               # JWT protect + optionalAuth
├── models/
│   ├── User.js               # User schema (email + Google)
│   ├── Item.js               # Item schema with matches[] + claimRequests[]
│   └── Notification.js       # In-app notification schema
├── routes/
│   ├── auth.js               # Register · Login · Google OAuth
│   ├── items.js              # CRUD + Auto-match + Claims + Smart sort
│   ├── ai.js                 # Gemini vision + tag generation
│   └── notifications.js      # Get + Mark read
├── utils/
│   └── matcher.js            # 🤖 Item matching engine (no external API)
├── server.js                 # Express app + CORS + routes
├── .env                      # Secret keys (not committed)
└── .env.example              # Template for env setup
```

---

## ⚙️ Environment Variables

Create a `.env` file:

```env
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/findit

# JWT
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d

# Cloudinary (image hosting)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Server
PORT=5000
NODE_ENV=development
```

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Start dev server with nodemon
npm run dev        # http://localhost:5000

# Start production
npm start
```

---

## 📡 API Endpoints

### 🔐 Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/register` | ❌ | Register with name, email, password |
| `POST` | `/login` | ❌ | Login → returns `{ token, data: user }` |
| `POST` | `/google` | ❌ | Google OAuth → returns `{ token, data: user }` |
| `GET` | `/me` | ✅ JWT | Get current user |

**Login Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": { "_id": "...", "name": "...", "email": "...", "role": "student" }
}
```

---

### 📦 Items — `/api/items`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ❌ | Browse with filters + smart sort |
| `GET` | `/stats` | ❌ | Dashboard statistics |
| `GET` | `/my` | ✅ | My reported items |
| `GET` | `/:id` | ❌ | Item detail with match data |
| `POST` | `/` | Optional | Create item → **auto-match runs** |
| `PATCH` | `/:id/status` | ✅ | Update item status |
| `DELETE` | `/:id` | ✅ | Delete item (owner/admin) |
| `POST` | `/:id/claim` | ✅ | Send claim request |
| `PATCH` | `/:id/claim/:claimId` | ✅ | Approve/reject claim |

**Browse Query Params:**
```
?type=lost|found
?category=Electronics
?search=water bottle
?building=library
?sort=recent|matches
?page=1&limit=20
```

**Create Item Response (with auto-match):**
```json
{
  "success": true,
  "data": { /* created item */ },
  "matches": [
    {
      "item": { "title": "Blue water bottle", "type": "found" },
      "score": 78,
      "reasons": ["Similar title", "Same location: Library"]
    }
  ],
  "matchCount": 1
}
```

---

### 🤖 AI — `/api/ai`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/match` | ❌ | Image-based AI item matching |
| `POST` | `/tags` | ❌ | Generate descriptive tags |

---

### 🔔 Notifications — `/api/notifications`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ✅ | Get all notifications (unread first) |
| `PATCH` | `/read-all` | ✅ | Mark all as read |
| `PATCH` | `/:id/read` | ✅ | Mark one as read |

---

## 📊 Data Models

### Item Schema
```js
{
  type:          "lost" | "found",
  title:         String,
  description:   String,
  category:      String,            // Electronics, Keys, etc.
  location: {
    building:    String,
    specificArea: String,
  },
  date:          Date,
  aiTags:        [String],
  matches: [{                       // 🆕 Auto-match results
    itemId:      ObjectId,
    score:       Number,            // 0-100
    reasons:     [String],
    matchedAt:   Date,
  }],
  claimRequests: [{                 // 🆕 Structured claim flow
    requesterId: ObjectId,
    message:     String,
    status:      "pending" | "approved" | "rejected",
  }],
  status:        "active" | "claimed" | "reunited" | "closed",
  reportedBy:    ObjectId → User,
  contactEmail:  String,
}
```

### Notification Schema
```js
{
  userId:   ObjectId → User,
  type:     "match_found" | "claim_received" | "claim_approved" | "claim_rejected",
  message:  String,
  itemId:   ObjectId → Item,
  matchId:  ObjectId → Item,
  read:     Boolean,
}
```

---

## 🌍 Render Deployment

### Environment Variables (set in Render Dashboard)
```
MONGODB_URI        = mongodb+srv://...
JWT_SECRET         = your_secret
CLOUDINARY_*       = your_cloudinary_keys
GEMINI_API_KEY     = your_gemini_key
NODE_ENV           = production
PORT               = 10000
```

### CORS Configuration
The backend accepts requests from:
- `http://localhost:3000` (local dev)
- `*.netlify.app` (all Netlify deployments)
- Render's own domain

---

## 🔌 CORS Setup (`server.js`)

```js
const allowedOrigins = [
  "http://localhost:3000",
  /\.netlify\.app$/,
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o =>
      typeof o === "string" ? o === origin : o.test(origin)
    )) cb(null, true);
    else cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
```

---

## 👩‍💻 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18 |
| Framework | Express 4 |
| Database | MongoDB Atlas (Mongoose) |
| Authentication | JWT (`jsonwebtoken`) + bcryptjs |
| File Upload | Multer + Cloudinary |
| AI | Google Gemini 1.5 Flash |
| Validation | express-validator |
| Hosting | Render.com |
| CI/CD | GitHub → Render auto-deploy |

---

## 👥 Team

**CampusFind** — Built for the college lost & found problem.  
Department Project · 2025–2026
