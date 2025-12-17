# Frontend Configuration for EC2 Backend

After deploying your backend to EC2, you need to update your React Native frontend to communicate with your EC2 instance instead of localhost.

## Quick Steps

### 1. Find Your EC2 Public IP

1. Go to AWS Console → EC2 → Instances
2. Select your instance
3. Copy the **Public IPv4 address** (looks like: `54.123.45.67`)

### 2. Update API Endpoint in Frontend

You need to replace all instances of:
```
http://localhost:4000
```

With:
```
http://YOUR_EC2_PUBLIC_IP:4000
```

### 3. Files to Update

Search these files in `frontend/` for `localhost:4000`:

1. **community.tsx** - Community posts API calls
2. **home.tsx** - Dashboard API calls  
3. **survey.tsx** - Survey submission
4. **Any custom API service files**

### 4. Example Changes

**BEFORE (Local Development):**
```typescript
const response = await fetch('http://localhost:4000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

**AFTER (EC2 Deployment):**
```typescript
const API_URL = 'http://54.123.45.67:4000'; // Use your EC2 IP

const response = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

### 5. (Recommended) Create Config File

Create `frontend/config/api.ts`:

```typescript
// Environment-specific API configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

// For production EC2
// const API_BASE_URL = 'http://54.123.45.67:4000';

export const API_ENDPOINTS = {
  auth: {
    signup: `${API_BASE_URL}/auth/signup`,
    login: `${API_BASE_URL}/auth/login`,
    profile: `${API_BASE_URL}/auth/profile`,
  },
  posts: {
    create: `${API_BASE_URL}/posts`,
    list: `${API_BASE_URL}/posts`,
    like: (postId: string) => `${API_BASE_URL}/likes/${postId}`,
    save: (postId: string) => `${API_BASE_URL}/saves/${postId}`,
  },
  survey: {
    get: (userId: string) => `${API_BASE_URL}/survey/${userId}`,
    create: `${API_BASE_URL}/survey`,
  },
};

export default API_ENDPOINTS;
```

Then use it in components:

```typescript
import API_ENDPOINTS from '@/config/api';

// Usage
const response = await fetch(API_ENDPOINTS.auth.login, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

### 6. Rebuild Frontend

After making changes:

```bash
# iOS
npm run ios

# Android
npm run android

# Expo Go
npm start
```

### 7. Test with EC2 Backend

Try signing up/logging in and creating a post. If successful, your frontend is now connected to EC2!

### 8. Next Steps

Once working locally against EC2:
- Build production APK/IPA for app stores
- Submit to Google Play and Apple App Store
- Monitor EC2 logs with: `ssh ... pm2 logs mybean-backend`

## Troubleshooting

### "Cannot reach server" error

1. Verify EC2 instance is running
2. Check backend is running: SSH into EC2, run `pm2 status`
3. Check security group allows port 4000 from your IP
4. Try curling from your machine: `curl http://YOUR_IP:4000`

### "Connection refused"

1. Backend might not be running: `ssh ... pm2 start server.js`
2. Check logs: `ssh ... pm2 logs mybean-backend`
3. Verify DATABASE_URL is correct

### "Network timeout"

1. Security group might be blocking port 4000
2. Edit security group to allow inbound traffic on port 4000
3. Check if EC2 instance has internet access

