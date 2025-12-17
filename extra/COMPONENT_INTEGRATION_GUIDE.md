# MyBean App - Complete Component Integration Guide

## 1. APPLICATION COMPONENTS & DATA FLOW

### 1.1 How Components Fit Together

```
USER OPENS APP
    ↓
[FRONTEND - React Native/Expo App]
    • Detects if user is logged in (JWT token in AsyncStorage)
    • If not logged in → Show login/signup screens
    • If logged in → Show main dashboard
    ↓
[LOCAL STORAGE - AsyncStorage]
    • Stores user profile, activities, community posts locally
    • Enables full offline functionality
    • Syncs to backend when internet available
    ↓
[BACKEND - Express.js Server on EC2]
    • Validates all requests with JWT tokens
    • Queries PostgreSQL database
    • Returns JSON responses
    ↓
[DATABASE - PostgreSQL on RDS]
    • Persists user data, activities, community posts
    • Enforces data integrity
    • Supports complex queries
    ↓
[STORAGE - Amazon S3]
    • Stores profile photos
    • Stores activity export PDFs
    • Stores database backups
```

### 1.2 Complete User Journey with Data Flow

**Step 1: Signup Process**
```
Frontend (signup.tsx)
  ↓ [User enters email, password]
  ↓ [Validates: 8+ chars, uppercase, lowercase, number, special char]
  ↓ POST /api/auth/signup → Backend
  
Backend (routes/auth.js)
  ↓ [Receives { name, email, password }]
  ↓ [Hashes password with bcrypt (10 rounds)]
  ↓ INSERT into PostgreSQL users table
  ↓ Generates JWT token (7-day expiration)
  ↓ Returns { user, token }
  
Frontend
  ↓ [Stores token in AsyncStorage]
  ↓ [Stores user data locally]
  ↓ Routes to survey.tsx (onboarding)
```

**Step 2: Onboarding Survey**
```
Frontend (survey.tsx)
  ↓ [Collects: parent name, baby name, birth date, relationship, feeding method]
  ↓ POST /api/survey → Backend
  
Backend (routes/survey.js)
  ↓ [Verifies JWT token]
  ↓ [Stores in user_profiles table as JSONB]
  ↓ Returns confirmation
  
Frontend
  ↓ [Stores survey data in AsyncStorage]
  ↓ Routes to home.tsx (dashboard)
```

**Step 3: Activity Logging (Offline-First)**
```
Frontend (track.tsx)
  ↓ [User logs activity: Feeding, Diaper, Sleep, etc.]
  ↓ Activity saved to AsyncStorage immediately
  ↓ 
  ├─ OFFLINE: App continues working normally
  │  └─ Data remains in AsyncStorage
  │
  └─ ONLINE: Auto-sync triggered
     ↓ POST /api/activities → Backend
     
Backend (routes/activities.js - future)
  ↓ [Verifies JWT token]
  ↓ INSERT into activities table
  ↓ Returns { id, timestamp, details }
  
Frontend
  ↓ [Clears from AsyncStorage once synced]
  ↓ [Updates dashboard with new activity]
```

**Step 4: Community Interaction**
```
Frontend (community.tsx)
  ↓ [User creates post: title, content, tags]
  ↓ POST /api/posts → Backend
  
Backend (routes/posts.js)
  ↓ [Verifies JWT token]
  ↓ [Validates: title & excerpt required]
  ↓ INSERT into posts table
  ↓ INSERT into user_posts junction table
  ↓ Returns { post_id, created_at, likes_count, saves_count }
  
Frontend
  ↓ [Stores post locally in AsyncStorage]
  ↓ [Displays in community feed]
  
User2 Views Post and Likes
  ↓ POST /api/posts/{id}/like → Backend
  
Backend
  ↓ [Verifies JWT token (User2's token)]
  ↓ INSERT into post_likes table (user2_id, post_id)
  ↓ UPDATE posts table likes_count++
  ↓ Returns { likes_count }
  
Frontend
  ↓ [Updates like count in real-time]
```

---

## 2. DATA MANAGEMENT

### 2.1 Data Format & Structure

**User Data (users table)**
```json
{
  "id": 1,
  "name": "Sarah Johnson",
  "email": "sarah@example.com",
  "password_hash": "$2a$10$...[encrypted with bcrypt]...",
  "profile_photo": "s3://mybean-bucket/profile-photos/user1.jpg",
  "created_at": "2024-12-01T10:30:00Z"
}
```

**User Profile Data (user_profiles table) - JSONB format**
```json
{
  "user_id": 1,
  "data": {
    "baby_name": "Emma",
    "baby_birth_date": "2024-10-15",
    "parent_relationship": "Mother",
    "feeding_method": "Breastfeeding",
    "parent_pronouns": "she/her",
    "timezone": "EST"
  },
  "updated_at": "2024-12-01T11:00:00Z"
}
```

**Activity Data (activities table) - Type varies by activity**
```json
{
  "id": 101,
  "user_id": 1,
  "type": "feeding",
  "timestamp": "2024-12-16T14:30:00Z",
  "details": {
    "method": "breastfed",
    "duration_minutes": 15,
    "breast_side": "right",
    "quantity_ml": null
  },
  "notes": "Baby seemed hungry",
  "created_at": "2024-12-16T14:30:00Z"
}
```

**Activity Types & Data Schemas**

1. **Feeding**
```json
{
  "method": "breast|bottle|mixed",
  "duration_minutes": 20,
  "quantity_ml": 120,
  "breast_side": "left|right|both"
}
```

2. **Diaper Change**
```json
{
  "type_of_output": "wet|dirty|both",
  "color": "yellow|brown|green",
  "consistency": "loose|normal|hard"
}
```

3. **Sleep/Nap**
```json
{
  "duration_minutes": 45,
  "quality": "restful|restless|uninterrupted",
  "location": "crib|parent_bed|carrier"
}
```

4. **Pumping**
```json
{
  "duration_minutes": 25,
  "quantity_ml": 180,
  "breast_side": "left|right|both"
}
```

5. **Milestone**
```json
{
  "milestone_name": "First smile",
  "category": "social|motor|cognitive|physical",
  "notes": "Smiled at Mom for first time"
}
```

6. **Mood/Behavior**
```json
{
  "mood": "happy|fussy|sleepy|calm",
  "behavior": "crying|playing|feeding",
  "duration_minutes": 30,
  "intensity": "mild|moderate|severe"
}
```

**Community Post Data (posts table)**
```json
{
  "id": 50,
  "user_id": 1,
  "title": "Tips for nighttime feeding",
  "excerpt": "Keep the lights dim and maintain a calm environment...",
  "tags": ["feeding", "sleep", "tips"],
  "likes_count": 15,
  "saves_count": 8,
  "created_at": "2024-12-10T09:15:00Z",
  "updated_at": "2024-12-10T09:15:00Z"
}
```

### 2.2 Data Storage Solutions

**Local Storage: AsyncStorage (Mobile Device)**
- **Format**: Key-value store (JSON serialized)
- **Capacity**: ~10 MB per app
- **Storage Keys**:
  ```
  user_profile        → { parentName, babyName, birthDate, ... }
  auth_token          → JWT token string
  logs_feeding        → [ { id, timestamp, details, notes }, ... ]
  logs_diaper         → [ { id, timestamp, details, notes }, ... ]
  logs_sleep          → [ { id, timestamp, details, notes }, ... ]
  logs_pumping        → [ { id, timestamp, details, notes }, ... ]
  logs_milestone      → [ { id, timestamp, details, notes }, ... ]
  logs_mood           → [ { id, timestamp, details, notes }, ... ]
  communityPosts      → [ { id, user_id, title, content, tags, ... }, ... ]
  userLikes           → [ postId1, postId2, ... ]
  userSaves           → [ postId1, postId2, ... ]
  pending_sync        → [ { action, data, timestamp }, ... ]
  ```

**Database: PostgreSQL on AWS RDS**
- **Capacity**: 20 GB (t3.micro)
- **Tables**:
  ```
  users (5 MB - stores ~100K users at 50 bytes each)
  ├─ id, name, email, password_hash, profile_photo, created_at
  
  user_profiles (10 MB - JSONB flexible schema)
  ├─ user_id, data (JSON), updated_at
  
  activities (50 MB - grows over time)
  ├─ id, user_id, type, timestamp, details (JSON), notes, created_at
  
  posts (5 MB)
  ├─ id, user_id, title, excerpt, tags (JSON), likes_count, saves_count, created_at
  
  post_likes (3 MB - junction table)
  ├─ id, post_id, user_id, created_at
  
  post_saves (3 MB - junction table)
  ├─ id, post_id, user_id, created_at
  ```

**Cloud Storage: Amazon S3**
- **Bucket**: `mybean-app-bucket`
- **Stored Objects**:
  ```
  /profile-photos/
    user1.jpg (200 KB average)
    user2.jpg
    ...
  
  /activity-exports/
    user1_2024-12-01_to_2024-12-16.pdf (500 KB)
    user1_2024-11-01_to_2024-11-30.pdf
    ...
  
  /database-backups/
    mybean-db-backup-2024-12-16.sql.gz (2 MB)
    mybean-db-backup-2024-12-15.sql.gz
    ...
  ```

### 2.3 Data Size & Growth Estimates

**Per User Monthly Data Generation**
```
Activity Logs (conservative estimate):
- 8 feedings/day × 30 days = 240 entries
- 6 diaper changes/day × 30 days = 180 entries
- 2-3 naps/day × 30 days = 75 entries
- 2 pumping sessions/day × 30 days = 60 entries
- ~5 milestones/month = 5 entries
- Mood logging variable = 30 entries
Total: ~590 activities/month per user

Data per activity: ~500 bytes (id, timestamp, details, notes)
Monthly per user: 590 × 500 bytes = 295 KB
Yearly per user: 3.54 MB

For 10,000 users:
- Activities: 35.4 GB/year
- Community posts: ~5 posts/month × 10K users = 50K posts/year = 500 MB
- Total growth: ~36 GB/year
```

**Database Sizing**
```
Initial deployment (100 users):
- Users: 5 KB
- Activities (3 months): 30 MB
- Posts: 1 MB
- Total: ~35 MB (well within 20 GB)

Growth projection:
- After 1 year (1000 users): 350 MB
- After 5 years (10K users): 3.5 GB
- Still under 20 GB capacity
- Scale up to db.t3.small when reaching 10+ GB
```

---

## 3. PROGRAMMING LANGUAGES & TECHNOLOGY STACK

### 3.1 Language Selection & Rationale

**Frontend: TypeScript + React Native + Expo**

| Language | Why | Where Used |
|----------|-----|-----------|
| **TypeScript** | Static typing prevents runtime errors. Critical for medical data accuracy. Self-documenting code. IDE autocomplete. | `.tsx` files in frontend/ (all components, screens) |
| **JavaScript/JSX** | React's templating language. Declarative UI syntax. Reactive state management. | Component rendering, JSX syntax |
| **CSS-in-JS** | Platform-agnostic styling. Dynamic theme support (light/dark mode). | `themed-text.tsx`, `themed-view.tsx` |

**Why React Native?**
- Write once, deploy to iOS, Android, and Web
- Native performance (not webview-based like Cordova)
- Large ecosystem (1000s of community libraries)
- Excellent offline support (AsyncStorage)
- Hot module reload during development

**Backend: JavaScript (Node.js) + Express.js**

| Language | Why | Where Used |
|----------|-----|-----------|
| **JavaScript** | Single language across full stack (frontend & backend) | `server.js`, all `routes/*.js` |
| **Node.js** | Async I/O for handling concurrent requests. Non-blocking database queries. | Runtime environment for Express server |

**Why Express.js?**
- Minimal framework (not opinionated like Django)
- Excellent middleware ecosystem
- Easy debugging and logging
- Fast to prototype
- Perfect for MVP

**Database: SQL (PostgreSQL)**

| Language | Why | Where Used |
|----------|-----|-----------|
| **SQL** | Structured query language for relational data. Complex joins. ACID guarantees. | `pool.query(...)` in all routes |
| **JSON** | Flexible schema for survey data and activity details. Stored as JSONB in PostgreSQL. | `user_profiles.data`, `activities.details`, `posts.tags` |

**Why PostgreSQL?**
- ACID transactions (critical for medical records)
- JSON/JSONB column types (flexible schema)
- Free and open source
- Free tier on AWS RDS
- Advanced features (window functions, full-text search)

---

### 3.2 Code Organization & Modules

**Frontend Structure**
```
frontend/
├── app/                        # Expo Router screens
│   ├── _layout.tsx            # Root layout with theme provider
│   ├── (tabs)/                # Tab-based navigation
│   │   ├── home.tsx           # Dashboard (390 lines)
│   │   ├── track.tsx          # Activity logging (595 lines)
│   │   ├── community.tsx       # Community posts (748 lines)
│   │   ├── history.tsx        # Activity history (250+ lines)
│   │   ├── login.tsx          # Authentication (175 lines)
│   │   ├── signup.tsx         # Registration (246 lines)
│   │   └── survey.tsx         # Onboarding (372 lines)
│   ├── modal.tsx              # Modal for new posts
│   └── info.tsx               # Help/info screen
│
├── components/                 # Reusable UI components
│   ├── themed-text.tsx        # Responsive text with theme
│   ├── themed-view.tsx        # Responsive container
│   ├── Survey.tsx             # Survey form component
│   └── ui/
│       ├── collapsible.tsx    # Expandable sections
│       └── icon-symbol.tsx    # Icon system
│
├── config/
│   └── api.ts                 # Backend endpoint configuration (55 lines)
│
├── context/                   # React Context for global state (if needed)
├── hooks/
│   ├── use-color-scheme.ts    # Theme detection hook
│   └── use-theme-color.ts     # Color theme hook
│
├── constants/
│   └── theme.ts               # Color palette definitions
│
├── assets/
│   └── images/                # App images/icons
│
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── app.json                   # Expo configuration
```

**Backend Structure**
```
backend/
├── server.js                  # Main entry point (110 lines)
│   ├─ Express app setup
│   ├─ PostgreSQL pool config
│   ├─ Schema initialization
│   └─ Route mounting
│
├── routes/
│   ├── auth.js               # Authentication endpoints (50+ lines)
│   │   ├─ POST /auth/signup
│   │   ├─ POST /auth/login
│   │   └─ GET /auth/profile
│   │
│   ├── posts.js              # Community features (266 lines)
│   │   ├─ POST /posts (create)
│   │   ├─ GET /posts (list)
│   │   ├─ POST /posts/:id/like
│   │   └─ POST /posts/:id/save
│   │
│   ├── survey.js             # User profile data
│   │   ├─ POST /survey
│   │   └─ GET /survey
│   │
│   └── user.js               # User profile management
│       ├─ GET /user/profile
│       └─ PUT /user/profile
│
├── uploads/                   # User-uploaded files
│   └── profile-photos/       # Profile photos (served via `/uploads`)
│
├── package.json              # Dependencies: express, pg, bcryptjs, jwt
└── .env (not in repo - hardcoded in server.js for MVP)
```

**Key File Purposes**

| File | Lines | Language | Purpose |
|------|-------|----------|---------|
| `frontend/app/(tabs)/home.tsx` | 390 | TypeScript/React | Dashboard: greeting, stats, quick buttons |
| `frontend/app/(tabs)/track.tsx` | 595 | TypeScript/React | Activity logging forms (6 types) |
| `frontend/app/(tabs)/community.tsx` | 748 | TypeScript/React | Social: posts, likes, saves, tags |
| `frontend/app/(tabs)/history.tsx` | 250+ | TypeScript/React | Activity audit log, filtering, export |
| `frontend/config/api.ts` | 55 | TypeScript | Backend URL and endpoint definitions |
| `backend/server.js` | 110 | JavaScript | Express app, database init, route mounting |
| `backend/routes/auth.js` | 50+ | JavaScript | Signup, login, JWT generation |
| `backend/routes/posts.js` | 266 | JavaScript | Create, retrieve, like, save community posts |
| `backend/routes/survey.js` | ~100 | JavaScript | Onboarding survey storage |

---

## 4. CLOUD DEPLOYMENT

### 4.1 Deployment Architecture

**Current Production Setup**

```
┌─────────────────────────────────────────────────────────┐
│                    INTERNET                             │
└────┬────────────────────────────────────────────────────┘
     │ HTTPS Port 443 (Mobile Client)
     │
┌────▼──────────────────────────────────────────────────────┐
│                    AWS VPC (us-east-1)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         PUBLIC SUBNET                                │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  EC2 Instance (t3.micro) - Free Tier            │ │ │
│  │  │  • Express.js Server running on Port 4000       │ │ │
│  │  │  • Public IP: 50.16.100.244                      │ │ │
│  │  │  • Security Group: Allow inbound 4000            │ │ │
│  │  │  • 1 vCPU, 1 GB RAM                             │ │ │
│  │  │  • Linux AMI (Ubuntu 22.04 LTS)                 │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │           │ (SQL Port 5432)                           │ │
│  │           │                                            │ │
│  │  ┌────────▼─────────────────────────────────────────┐ │ │
│  │  │         PRIVATE SUBNET                            │ │ │
│  │  │                                                   │ │ │
│  │  │  ┌──────────────────────────────────────────┐   │ │ │
│  │  │  │ RDS Instance (db.t3.micro) - Free Tier  │   │ │ │
│  │  │  │ • PostgreSQL Database                   │   │ │ │
│  │  │  │ • Endpoint: user-information...         │   │ │ │
│  │  │  │ • Port 5432 (Private - no internet)     │   │ │ │
│  │  │  │ • 20 GB storage                         │   │ │ │
│  │  │  │ • Automated daily backups               │   │ │ │
│  │  │  │ • 35-day retention                      │   │ │ │
│  │  │  └──────────────────────────────────────────┘   │ │ │
│  │  └────────────────────────────────────────────────── │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │            S3 BUCKET (ANY REGION)                     │ │
│  │  • Stores: Profile photos, PDFs, backups             │ │
│  │  • Versioning enabled                                │ │
│  │  • Lifecycle: 90d → Glacier (cost optimization)      │ │
│  │  • Accessed by EC2 via IAM role                       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Deployment Steps

**Step 1: EC2 Instance Setup**
```bash
# 1. Launch EC2 Instance
- Type: t3.micro (Free Tier eligible)
- AMI: Ubuntu 22.04 LTS
- Security Group: Allow SSH (22), HTTP (80), HTTPS (443), Port 4000
- Elastic IP: 50.16.100.244 (assigned)

# 2. SSH into instance
ssh -i mybean-key.pem ec2-user@50.16.100.244

# 3. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Clone repository
git clone https://github.com/Jana42-mohd/MyBean_App.git
cd MyBean_App/backend

# 5. Install dependencies
npm install
# Installs: express, pg, bcryptjs, jsonwebtoken, cors, body-parser, multer

# 6. Set environment variables (or hardcode in server.js)
export DATABASE_URL="postgresql://postgres:Jenny22072004@user-information.cellg5n8wcin.us-east-1.rds.amazonaws.com:5432/MyBean"
export PORT=4000
export JWT_SECRET="mybean-super-secure-jwt-secret-key-2024"

# 7. Start server (production: use PM2)
npm start
# OR with PM2 for process management:
npm install -g pm2
pm2 start server.js --name "mybean-backend"
pm2 startup
pm2 save
```

**Step 2: RDS PostgreSQL Setup**
```bash
# 1. Create RDS instance via AWS Console
- Database: PostgreSQL
- Instance: db.t3.micro (Free Tier)
- Storage: 20 GB
- Public accessible: No (only from EC2)
- VPC: Same as EC2

# 2. Security Group configuration
- Allow inbound: Port 5432 from EC2 security group only
- No internet access (private subnet)

# 3. Create database
# Via pgAdmin or command line:
psql -h user-information.cellg5n8wcin.us-east-1.rds.amazonaws.com -U postgres
CREATE DATABASE MyBean;

# 4. Database schemas auto-created by server.js on first run
# ensureSchema() function creates tables
```

**Step 3: S3 Bucket Setup**
```bash
# 1. Create S3 bucket
aws s3 mb s3://mybean-app-bucket --region us-east-1

# 2. Enable versioning
aws s3api put-bucket-versioning \
  --bucket mybean-app-bucket \
  --versioning-configuration Status=Enabled

# 3. Create lifecycle policy (90 day archive)
# Upload JSON policy file with:
{
  "Rules": [{
    "Id": "ArchiveOldObjects",
    "Filter": {"Prefix": ""},
    "Transitions": [{
      "Days": 90,
      "StorageClass": "GLACIER"
    }],
    "Status": "Enabled"
  }]
}

# 4. Create IAM role for EC2 to access S3
# Attach policy: AmazonS3FullAccess (or custom policy)
```

**Step 4: Frontend Configuration**
```typescript
// frontend/config/api.ts
const EC2_IP = '50.16.100.244';
const API_PORT = '4000';
export const API_BASE_URL = `http://${EC2_IP}:${API_PORT}`;
// (Update to HTTPS in production)

// Build and deploy to Expo
npx expo build:android
npx expo build:ios
# Or use Expo Go app for testing
```

### 4.3 Component Integration on Cloud

**User Makes Request From Mobile App**

```
1. Frontend User Action
   └─ User opens app, clicks "Log Feeding"
   
2. Local Processing (Offline-First)
   └─ Frontend saves activity to AsyncStorage immediately
   └─ Shows confirmation: "Saved locally"
   
3. Internet Detection
   └─ App detects network connectivity
   └─ AsyncStorage changes queued for sync
   
4. API Request to Backend
   └─ Frontend: POST /api/activities (with JWT token)
   └─ HTTPS: Secure encryption in transit
   └─ Backend receives request on port 4000
   
5. Backend Validation
   └─ Express.js middleware verifies JWT token
   └─ Validates request body (required fields)
   └─ Checks authorization (token user_id matches)
   
6. Database Interaction
   └─ Backend: INSERT INTO activities table
   └─ PostgreSQL enforces schema and constraints
   └─ Returns activity ID and timestamp
   
7. Response to Frontend
   └─ Backend: Returns 200 OK with { id, timestamp, ... }
   └─ Frontend: Clears from AsyncStorage pending queue
   └─ Frontend: Updates dashboard in real-time
   
8. Optional: File Storage
   └─ User clicks "Export as PDF"
   └─ Backend generates PDF report
   └─ Uploads to S3 bucket
   └─ Returns download URL
```

### 4.4 Scaling Strategy

**Current Configuration (MVP)**
```
Users Supported: ~1000-2000 concurrent
Request/sec: ~100-200 RPS
Database Size: <1 GB
Storage: <1 GB
Monthly Cost: ~$25 (EC2 $10 + RDS $10 + S3 $5)
```

**Scale to 10K Users**
```
Step 1: Upgrade EC2
- From t3.micro (1 vCPU) → t3.small (2 vCPU)
- Cost: +$15/month

Step 2: Upgrade RDS
- From db.t3.micro (1 GB RAM) → db.t3.small (2 GB RAM)
- Cost: +$20/month

Step 3: Add Caching Layer
- ElastiCache Redis for frequently accessed data
- Cost: +$20/month

Step 4: Add Load Balancer
- Elastic Load Balancer distributes across multiple EC2 instances
- Cost: +$15/month

Step 5: Auto-scaling
- Auto Scaling Group: Spin up more EC2 instances as load increases
- Multiple availability zones for redundancy

New Monthly Cost: ~$100-150/month (for 10K users)
```

---

## 5. INTEGRATION SUMMARY: HOW COMPONENTS WORK TOGETHER

### Complete Application Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    MYBEAN COMPLETE ARCHITECTURE                   │
└──────────────────────────────────────────────────────────────────┘

                            MOBILE APP
                      (React Native/Expo)
                             │
                  TypeScript Components:
                  • Screens (home, track, community, history)
                  • Reusable UI components
                  • Navigation (Tab + Stack)
                             │
                ┌────────────┴────────────┐
                │                         │
            OFFLINE                   ONLINE
          AsyncStorage              Network Request
          (10 MB Cache)             (HTTPS)
                │                         │
                ├─────────────────────────┤
                │                         │
         ┌──────▼──────────────────────────▼──────┐
         │      EXPRESS.JS SERVER (Node.js)        │
         │      Port 4000 on EC2 Instance          │
         │                                         │
         │  Middleware:                            │
         │  • JWT Verification                     │
         │  • CORS                                 │
         │  • Body-Parser                          │
         │  • Error Handling                       │
         │                                         │
         │  Routes:                                │
         │  • /auth (signup, login)                │
         │  • /posts (community)                   │
         │  • /survey (onboarding)                 │
         │  • /user (profile)                      │
         │  • /activities (future)                 │
         └──────┬──────────────────────────────────┘
                │
        ┌───────┴────────────┬──────────────┐
        │                    │              │
    PostgreSQL           S3 Bucket      CloudWatch
    (RDS - Private)    (Public Object  (Monitoring)
                        Storage)
        │
    Tables:
    • users (auth)
    • user_profiles (survey data)
    • activities (logs)
    • posts (community)
    • post_likes (engagement)
    • post_saves (engagement)

DATA LIFECYCLE:
1. Create: Frontend → AsyncStorage (immediate) → Backend → PostgreSQL
2. Read: Frontend → AsyncStorage (offline) or Backend → PostgreSQL
3. Update: Frontend → AsyncStorage → Backend → PostgreSQL → S3 backup
4. Delete: Frontend → Backend → PostgreSQL (soft delete or hard delete)

SECURITY LAYERS:
1. Frontend: JWT token stored in AsyncStorage (encrypted at rest)
2. Network: HTTPS for all API communication
3. Backend: JWT verification on every request
4. Database: Password hashing with bcrypt, no plain-text storage
5. Cloud: RDS in private subnet, no internet access
6. IAM: EC2 instance has role to access S3 only
```

### Technology Matrix

| Component | Technology | Purpose | Why This Choice |
|-----------|-----------|---------|-----------------|
| **Mobile App** | React Native + TypeScript | Cross-platform iOS/Android | Single codebase, native performance |
| **Frontend Framework** | Expo | Development & deployment | Fast iteration, handles native builds |
| **State Management** | AsyncStorage | Local offline cache | Simple, persistent, no dependencies |
| **Backend Framework** | Express.js | REST API server | Minimal, fast, excellent middleware |
| **Backend Runtime** | Node.js | JavaScript execution | Async I/O, single language full-stack |
| **Database** | PostgreSQL | Relational data storage | ACID, JSON columns, advanced features |
| **Compute** | EC2 (t3.micro) | Backend hosting | Cost-effective, free tier, full control |
| **Database Host** | RDS (db.t3.micro) | Managed database | Automated backups, no admin overhead |
| **File Storage** | S3 | Object storage | Unlimited scalability, cheap, versioned |
| **Authentication** | JWT | Stateless tokens | Scalable, no server-side session storage |
| **Password Hashing** | bcryptjs | Secure password storage | Industry standard, resistant to GPU attacks |
| **Deployment Region** | us-east-1 | AWS region | Lowest cost, best free tier support |

### Cost Breakdown (Annual)

```
Frontend:
- Development: $0 (Expo is free)
- Distribution: $0 (App Store/Google Play fees = $100/year one-time)

Backend (Infrastructure):
- EC2 t3.micro: $0 (free tier, or $50/month after)
- RDS db.t3.micro: $0 (free tier, or $60/month after)
- S3: ~$10/month (at 1 GB storage with 1000 objects)
- Data transfer: ~$20/month (1 GB/day outbound)
- Total: ~$30/month ongoing, $300/year

Development:
- Domain name: $12/year
- SSL certificate: $0 (Let's Encrypt free)
- Monitoring: $0 (CloudWatch free tier)
- Total: $12/year

**First Year Total: ~$600 (including app store fees)**
**Ongoing Annual: ~$360 (after free tier expires)**
```

---

## 6. CONCLUSION

MyBean integrates these components into a cohesive full-stack application:

✅ **Frontend** captures user input efficiently with offline capability
✅ **AsyncStorage** enables uninterrupted service without internet
✅ **Backend** validates, authenticates, and persists all data
✅ **PostgreSQL** maintains data integrity and enables complex queries
✅ **S3** provides scalable file storage for exports and backups
✅ **AWS Cloud** provides reliable, auto-scaling infrastructure
✅ **Security** is layered across network, application, and database

The architecture prioritizes **user experience** (offline-first) and **data integrity** (ACID transactions) while maintaining **operational simplicity** (free tier, minimal maintenance) during the MVP phase, with clear scaling paths for enterprise growth.
