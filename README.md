# 🎒 CampusFind — Backend API

> This is the server-side (backend) for CampusFind — an AI-powered Lost & Found platform for campuses.  
> It handles user authentication, item storage, image uploads, and AI-powered tag generation.

---

## 📌 What does this backend do?

This is a **REST API** — it receives requests from the frontend app and responds with data.

It is responsible for:
- ✅ Registering and logging in users (email + Google)
- ✅ Storing lost/found item reports in MongoDB
- ✅ Uploading item photos to Cloudinary
- ✅ Generating AI tags using Google Gemini
- ✅ Protecting private routes using JWT tokens
- ✅ Returning search/filter results to the frontend

---

## 🌐 Live API

**Base URL:** `https://findit-backend-0v6p.onrender.com/api`

Test it's working:
```
GET https://findit-backend-0v6p.onrender.com/api/health
```
Expected response:
```json
{ "success": true, "message": "FindIt API is running 🎒" }
```

---

## 🧰 Tech Stack

| Tool | Why it's used |
|------|--------------|
| **Node.js** | JavaScript runtime for the server |
| **Express.js** | Web framework — handles routes and requests |
| **MongoDB Atlas** | Cloud database — stores users and items |
| **Mongoose** | Makes it easy to work with MongoDB in Node.js |
| **JWT (jsonwebtoken)** | Creates secure login tokens |
| **bcryptjs** | Hashes passwords so they're never stored as plain text |
| **Google Gemini AI** | Generates smart search tags for items |
| **Cloudinary** | Stores uploaded images in the cloud |
| **Multer** | Handles file uploads (images) in Express |
| **express-validator** | Validates form inputs before processing |
| **dotenv** | Loads secret keys from `.env` file |
| **Nodemon** | Auto-restarts server when code changes (dev only) |
| **Render** | Cloud platform that hosts this backend |

---

## 📁 Folder Structure Explained

```
backend/
│
├── server.js               ← App entry point
│                             Sets up Express, CORS, middleware, and routes
│
├── config/
│   ├── db.js               ← Connects to MongoDB Atlas using MONGODB_URI
│   └── cloudinary.js       ← Sets up Cloudinary + Multer for image upload
│
├── routes/
│   ├── auth.js             ← Handles /api/auth/* (register, login, Google, me)
│   ├── items.js            ← Handles /api/items/* (report, browse, delete, stats)
│   └── ai.js               ← Handles /api/ai/* (generate tags, image match)
│
├── models/
│   ├── User.js             ← MongoDB schema for users
│   └── Item.js             ← MongoDB schema for lost/found items
│
├── middleware/
│   └── auth.js             ← JWT protect middleware
│                             Checks the Authorization header before protected routes
│
├── .env                    ← Secret environment variables (NOT in git)
├── .env.example            ← Template showing what variables are needed
└── package.json            ← Project info + dependencies
```

---

## 📡 All API Endpoints

### 🔐 Auth Routes — `/api/auth`

| Method | Endpoint | Who can use | What it does |
|--------|----------|-------------|--------------|
| `POST` | `/register` | Anyone | Create a new account with name, email, password |
| `POST` | `/login` | Anyone | Login → returns a JWT token + user info |
| `POST` | `/google` | Anyone | Login/register via Google OAuth (sends name, email, picture) |
| `GET` | `/me` | Logged-in users only | Returns the current logged-in user's info |

**Login response example:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "data": {
    "_id": "abc123",
    "name": "Jashwitha",
    "email": "jashwitha@campus.edu"
  }
}
```

---

### 📦 Item Routes — `/api/items`

| Method | Endpoint | Auth needed | What it does |
|--------|----------|-------------|--------------|
| `GET` | `/` | ❌ No | Get all items. Supports query: `?type=lost&category=Electronics&search=bag` |
| `GET` | `/stats` | ❌ No | Returns `{ lost, found, reunited }` counts for the homepage |
| `GET` | `/my` | ✅ Yes | Returns only the current user's reported items |
| `GET` | `/:id` | ❌ No | Get one specific item by its ID |
| `POST` | `/` | ✅ Yes | Report a new lost/found item (send as `multipart/form-data` with optional image) |
| `PATCH` | `/:id/status` | ✅ Yes | Update item status to `resolved` or `claimed` |
| `DELETE` | `/:id` | ✅ Yes | Delete an item (only the owner can do this) |

**Creating an item — required fields:**
```
title, type (lost/found), category, description, building, date, contactEmail
Optional: image (file)
```

---

### 🤖 AI Routes — `/api/ai`

| Method | Endpoint | What it does |
|--------|----------|--------------|
| `POST` | `/tags` | Send `{ title, description, category }` → Gemini returns 8-10 search tags |
| `POST` | `/match` | Send an image file → Gemini describes it → matches against DB items |

> If `GEMINI_API_KEY` is not set, `/tags` falls back to keyword extraction (never crashes).

---

## 🔐 How JWT Middleware Works

Think of it like a **security badge check** at an office:

```
Protected route request arrives
        ↓
JWT Middleware reads the Authorization header:
  "Bearer eyJhbGciOiJIUzI1NiJ9..."
        ↓
Decodes the token using JWT_SECRET
        ↓
Finds the user in the database
        ↓
Attaches user to req.user
        ↓
Route handler runs (now knows who the user is)

If token is missing/invalid → 401 Unauthorized
```

---

## 🗄️ Database Models

### User Model
```
name         → Full name
email        → Unique email address
password     → Hashed (never stored as plain text)
picture      → Profile photo URL (from Google)
loginMethod  → "email" or "google"
role         → "user" or "admin"
lastLogin    → When they last logged in
```

### Item Model
```
title        → Item name (e.g. "Black Sony Earphones")
type         → "lost" or "found"
category     → Electronics, Keys, Bags, ID & Cards, etc.
description  → Detailed description
location     → { building, specificArea }
date         → When it was lost/found
image        → Cloudinary URL (optional)
contactEmail → How to reach the reporter
status       → "active", "resolved", or "claimed"
reportedBy   → Reference to User who reported it
tags         → AI-generated search tags
```

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js v18+ installed
- MongoDB Atlas account (free tier works)
- Cloudinary account (free tier works)
- Google Gemini API key (free at aistudio.google.com)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/tade-jashwitha/findit-backend.git
cd findit-backend

# 2. Install packages
npm install --legacy-peer-deps

# 3. Create .env file (copy from .env.example and fill in values)
cp .env.example .env

# 4. Start the dev server
npm run dev
# Runs at http://localhost:5000
```

---

## 🔑 All Environment Variables

| Variable | What it is | Where to get it |
|----------|-----------|----------------|
| `MONGODB_URI` | MongoDB connection string | MongoDB Atlas → Connect → Drivers |
| `PORT` | Server port (default: 5000) | Set to `5000` |
| `NODE_ENV` | Environment name | `development` locally, `production` on Render |
| `JWT_SECRET` | Secret key to sign tokens | Any long random string |
| `JWT_EXPIRES_IN` | How long tokens last | e.g. `7d` |
| `GEMINI_API_KEY` | Google Gemini AI key | [aistudio.google.com](https://aistudio.google.com) |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Cloudinary dashboard |
| `FRONTEND_URL` | Your Netlify app URL | Needed for CORS |

---

## 🌍 How to Deploy on Render

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Set:
   - **Start command:** `node server.js`
   - **Environment:** `Node`
5. Add all environment variables from the table above
6. Click Deploy

> ✅ Render auto-redeploys every time you push to `main`

---

## 🔗 Related
- **Frontend Repo:** [findit-frontend](https://github.com/tade-jashwitha/findit-frontend)

---

## 👩‍💻 Author
Made by **Jashwitha Tade**
