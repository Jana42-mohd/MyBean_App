# MyBean EC2 Deployment Checklist

Complete this checklist to successfully deploy MyBean backend to EC2 and connect frontend.

---

## ✅ Pre-Deployment Checklist

- [ ] AWS Account created
- [ ] EC2 instance launched (t3.micro recommended)
- [ ] RDS PostgreSQL instance created
- [ ] Security groups configured
- [ ] SSH key pair downloaded (.pem file)
- [ ] You have your EC2 public IP address
- [ ] You have your RDS endpoint and credentials

---

## ✅ Backend Deployment (On Your Local Machine)

- [ ] `backend/package.json` exists in your project
- [ ] Pushed code to GitHub (optional but recommended)

### Run These Commands:

```bash
cd backend
npm install  # Install dependencies locally first to test
npm start    # Test that server starts without errors (Ctrl+C to stop)
```

---

## ✅ EC2 Setup (On Your EC2 Instance)

### Open Terminal and SSH into EC2:

```bash
ssh -i your-key-file.pem ec2-user@your-ec2-ip
```

### Run Setup Script:

```bash
# Option 1: Auto setup (recommended)
cd ~
curl -O https://raw.githubusercontent.com/Jana42-mohd/MyBean_App/main/backend/setup-ec2.sh
chmod +x setup-ec2.sh
./setup-ec2.sh

# Option 2: Manual setup (follow EC2_DEPLOYMENT_GUIDE.md)
```

### Configure Environment:

```bash
# Edit .env file with your RDS credentials
nano ~/.env

# Or if backend is in MyBean_App:
cd ~/MyBean_App/backend
nano .env
```

**Required in .env:**
```
PORT=4000
NODE_ENV=production
JWT_SECRET=your-secure-random-string
DATABASE_URL=postgresql://your-username:your-password@your-rds-endpoint:5432/mybean_db
DB_SSL=true
```

---

## ✅ Test Backend on EC2

```bash
# Test locally on EC2
npm start

# You should see: "Server is running on port 4000"

# Press Ctrl+C to stop
```

---

## ✅ Start Backend with PM2 (Production)

```bash
# Start backend with PM2
pm2 start server.js --name "mybean-backend"

# Make it auto-restart on reboot
pm2 startup
pm2 save

# Check status
pm2 status

# View logs
pm2 logs mybean-backend
```

---

## ✅ Test Backend from Outside EC2

From your local machine:

```bash
curl http://your-ec2-ip:4000
```

Should see a response (or 404 is fine, means server is reachable).

---

## ✅ Update Frontend Configuration

In your local frontend code:

- [ ] Find all `http://localhost:4000` references
- [ ] Replace with `http://YOUR_EC2_PUBLIC_IP:4000`

**Quick search in VSCode:**
- Press `Ctrl+Shift+F`
- Search: `localhost:4000`
- Replace all with your EC2 IP

**Files to check:**
- `frontend/app/community.tsx`
- `frontend/app/home.tsx`
- `frontend/app/survey.tsx`
- Any API utility files

---

## ✅ Test Frontend Connection

```bash
# In frontend directory
npm start

# On your phone or emulator, test:
# - Sign up with a new account
# - Create a community post
# - Log history should be saved

# Check EC2 logs to see requests coming in:
# ssh ... pm2 logs mybean-backend
```

---

## ✅ Verify Everything Works

**Backend:**
```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Check if running
pm2 status

# View logs for errors
pm2 logs mybean-backend --lines 50
```

**Frontend:**
- Open app on phone/emulator
- Create account and post
- Check data appears in activity history

**Database:**
```bash
# From EC2, connect to RDS
psql -h your-rds-endpoint -U postgres -d mybean_db -c "SELECT * FROM users;"
```

---

## ✅ Security Hardening (Optional)

Once everything works, consider:

- [ ] Remove hardcoded EC2 IP from frontend, use environment variables
- [ ] Set up HTTPS with AWS Certificate Manager + ALB
- [ ] Use AWS Secrets Manager for environment variables
- [ ] Enable VPC flow logs for debugging
- [ ] Set up CloudWatch alarms for backend health

---

## 📋 Quick Reference: Important Information

Save this information:

| Item | Value |
|------|-------|
| EC2 Public IP | _________________ |
| EC2 Instance ID | _________________ |
| RDS Endpoint | _________________ |
| RDS Username | _________________ |
| SSH Key File | _________________ |
| API Endpoint (Frontend) | http://______:4000 |

---

## 🔧 Common Commands

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# View backend logs
pm2 logs mybean-backend

# Stop backend
pm2 stop mybean-backend

# Restart backend (after config changes)
pm2 restart mybean-backend

# View PM2 process details
pm2 info mybean-backend

# Delete backend from PM2
pm2 delete mybean-backend

# Exit SSH session
exit
```

---

## 📚 Additional Resources

- EC2 Deployment Guide: `EC2_DEPLOYMENT_GUIDE.md`
- Frontend Config: `FRONTEND_CONFIG_FOR_EC2.md`
- Backend README: `backend/README.md`
- Backend Setup: `backend/SETUP.md`
- API Examples: `backend/EXAMPLES.md`

---

## ❓ Need Help?

If you encounter issues:

1. Check logs: `pm2 logs mybean-backend`
2. Verify .env file: `cat ~/.env`
3. Test database: `psql -h ... -U ... -d mybean_db`
4. Check security group allows port 4000
5. Verify backend is running: `pm2 status`

---

**Last Updated:** December 15, 2025  
**Status:** Ready for Deployment ✅
