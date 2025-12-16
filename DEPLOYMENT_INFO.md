# MyBean Deployment Information

## Your AWS Details

**EC2 Instance:**
- Public IP: `50.16.100.244`
- Port: `4000`
- Full URL: `http://50.16.100.244:4000`

**RDS Database:**
- Endpoint: `user-information.cellg5n8wcin.us-east-1.rds.amazonaws.com`
- Port: `5432`
- Database: `mybean_db`

**Connection String Format:**
```
postgresql://username:password@user-information.cellg5n8wcin.us-east-1.rds.amazonaws.com:5432/mybean_db
```

---

## Next Steps

### 1. SSH into EC2 and Deploy Backend

```bash
# SSH into your EC2 instance
ssh -i your-key-file.pem ec2-user@50.16.100.244

# Clone your repository or upload backend files
git clone https://github.com/Jana42-mohd/MyBean_App.git
cd MyBean_App/backend

# Install dependencies
npm install

# Create .env file with your RDS credentials
nano .env
```

**Add these to .env:**
```
PORT=4000
NODE_ENV=production
JWT_SECRET=your-secure-random-string-here
DATABASE_URL=postgresql://postgres:your-password@user-information.cellg5n8wcin.us-east-1.rds.amazonaws.com:5432/mybean_db
DB_SSL=true
```

### 2. Start Backend with PM2

```bash
# Start the backend
pm2 start server.js --name "mybean-backend"

# Enable auto-restart on reboot
pm2 startup
pm2 save

# Check status
pm2 status

# View logs
pm2 logs mybean-backend
```

### 3. Test Backend Connection

From your local machine:
```bash
curl http://50.16.100.244:4000
```

### 4. Update Frontend Code

Replace all instances of `localhost:4000` with `50.16.100.244:4000`:

**Files to update:**
- `frontend/app/(tabs)/community.tsx`
- `frontend/app/(tabs)/home.tsx`
- `frontend/app/(tabs)/track.tsx`

**Quick Find & Replace in VSCode:**
1. Press `Ctrl+Shift+H` (Find and Replace)
2. Find: `localhost:4000`
3. Replace: `50.16.100.244:4000`
4. Click "Replace All"

Or create a config file:

**frontend/config/api.ts** (NEW):
```typescript
export const API_BASE_URL = 
  process.env.NODE_ENV === 'production' 
    ? 'http://50.16.100.244:4000'
    : 'http://localhost:4000';
```

Then import and use throughout frontend:
```typescript
import { API_BASE_URL } from '../config/api';

const response = await fetch(`${API_BASE_URL}/auth/signup`, {...})
```

### 5. Test Frontend

```bash
cd frontend
npm start
```

Test on your phone/emulator:
- Create account
- Create community post
- Check logs to see data flow

---

## Troubleshooting

**Backend won't start:**
```bash
# Check if port 4000 is already in use
pm2 logs mybean-backend

# Check database connection
psql -h user-information.cellg5n8wcin.us-east-1.rds.amazonaws.com -U postgres -d mybean_db
```

**Frontend can't connect to backend:**
- Verify EC2 security group allows port 4000 inbound
- Check firewall isn't blocking traffic
- Verify .env DATABASE_URL is correct
- Try: `curl http://50.16.100.244:4000`

**Database connection fails:**
- Verify RDS password is correct
- Check RDS security group allows port 5432 from EC2
- Confirm database name is `mybean_db`

---

**Ready to start? Follow the steps above in order!**
