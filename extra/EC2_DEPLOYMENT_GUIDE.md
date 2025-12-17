# EC2 Deployment Guide for MyBean Backend

## Prerequisites

Before starting, make sure you have:
1. An AWS EC2 instance running (t3.micro recommended)
2. SSH key pair (.pem file) for your EC2 instance
3. RDS PostgreSQL instance running (or local PostgreSQL)
4. Node.js installed on your local machine
5. Git installed on your local machine

---

## Step 1: Create Backend package.json

Your backend needs a package.json file. Create one in your `backend/` directory with these dependencies:

```json
{
  "name": "mybean-backend",
  "version": "1.0.0",
  "description": "MyBean Express backend server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.9.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.1.0",
    "cors": "^2.8.5",
    "body-parser": "^1.20.0"
  },
  "keywords": ["mybean", "baby-tracking", "express"],
  "author": "Janam",
  "license": "MIT"
}
```

---

## Step 2: Prepare Your EC2 Instance

### 2a. SSH into Your EC2 Instance

```bash
# Replace your-ec2-ip with your actual EC2 public IP
# Replace path-to-key.pem with your actual key file path
ssh -i path-to-key.pem ec2-user@your-ec2-ip

# Or if using Ubuntu AMI:
ssh -i path-to-key.pem ubuntu@your-ec2-ip
```

### 2b. Update System and Install Dependencies

```bash
# Update package manager
sudo yum update -y    # For Amazon Linux
# OR
sudo apt update && sudo apt upgrade -y    # For Ubuntu

# Install Node.js and npm
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -    # Amazon Linux
sudo yum install -y nodejs npm

# OR for Ubuntu:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs npm

# Install Git
sudo yum install git -y    # Amazon Linux
# OR
sudo apt install git -y    # Ubuntu

# Install PM2 (to keep server running)
sudo npm install -g pm2
```

### 2c. Configure Security Group

In AWS Console:
1. Go to EC2 → Security Groups
2. Find your security group
3. Add Inbound Rules:
   - Port 4000 (your API) - Source: 0.0.0.0/0 (or your IP for security)
   - Port 22 (SSH) - Source: Your IP
   - Port 5432 (PostgreSQL if needed) - Source: Internal only

---

## Step 3: Deploy Code to EC2

### 3a. Clone Your Repository (Recommended)

```bash
# On your EC2 instance
cd ~
git clone https://github.com/Jana42-mohd/MyBean_App.git
cd MyBean_App/backend
```

### 3b. OR Copy Files Directly

From your local machine:

```bash
# Copy backend files to EC2
scp -i path-to-key.pem -r C:\Users\Janam\Desktop\projects\MyBean_App\backend/* ec2-user@your-ec2-ip:~/mybean-backend/

# SSH into EC2
ssh -i path-to-key.pem ec2-user@your-ec2-ip
cd ~/mybean-backend
```

---

## Step 4: Install Dependencies

```bash
# On EC2, in your backend directory
npm install

# Verify installation
npm list
```

---

## Step 5: Configure Environment Variables

Create a `.env` file on your EC2 instance:

```bash
# On EC2
cat > ~/.env << 'EOF'
PORT=4000
NODE_ENV=production
JWT_SECRET=your-very-secure-jwt-secret-change-this-in-production
DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/mybean_db
DB_SSL=true
EOF

# Make sure to replace:
# - username: Your RDS master username
# - password: Your RDS master password
# - your-rds-endpoint: Your RDS endpoint (without port)
```

### Finding Your RDS Connection Details:

1. Go to AWS RDS Console
2. Find your PostgreSQL instance
3. Note:
   - **Endpoint**: Copy this (remove `:5432`)
   - **Master Username**: Your DB username
   - **Master Password**: Your DB password
   - **Database Name**: Should be `mybean_db` (or create it)

### Create Database (if needed):

```bash
# From EC2, connect to RDS
psql -h your-rds-endpoint -U postgres -c "CREATE DATABASE mybean_db;"
```

---

## Step 6: Test Backend Locally (on EC2)

```bash
# Source environment variables
source ~/.env

# Start the server
npm start

# You should see:
# "Server is running on port 4000"

# In another terminal on EC2, test the API:
curl http://localhost:4000
```

If successful, press `Ctrl+C` to stop.

---

## Step 7: Run Backend with PM2 (Production)

```bash
# On EC2
pm2 start server.js --name "mybean-backend"

# Make PM2 start on reboot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs mybean-backend
```

---

## Step 8: Update Your Frontend to Use EC2

In your React Native frontend (`frontend/` directory), update API calls to use your EC2 instance:

**Replace:** `http://localhost:4000`  
**With:** `http://your-ec2-public-ip:4000`

Find all API calls in your codebase and update them. Example locations:
- `community.tsx` - Community post API calls
- `home.tsx` - Dashboard API calls
- Any component making fetch requests

Example change:

```typescript
// OLD (local development)
const response = await fetch('http://localhost:4000/auth/login', {

// NEW (EC2 production)
const response = await fetch('http://your-ec2-public-ip:4000/auth/login', {
```

---

## Step 9: Test API from Outside EC2

From your local machine:

```bash
# Test that backend is accessible
curl http://your-ec2-public-ip:4000

# Test signup endpoint
curl -X POST http://your-ec2-public-ip:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"TestPass123!"}'

# Test login
curl -X POST http://your-ec2-public-ip:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
```

---

## Step 10: Optional - Set Up Custom Domain

If you have a domain, use Route 53 or your domain registrar to point it to your EC2 instance's public IP.

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
pm2 logs mybean-backend

# Check if port 4000 is in use
sudo netstat -tuln | grep 4000

# Kill process on port 4000 if needed
sudo lsof -ti:4000 | xargs kill -9
```

### Can't connect to RDS

```bash
# Test RDS connection from EC2
psql -h your-rds-endpoint -U postgres -d mybean_db
```

### Frontend can't reach backend

1. Verify EC2 security group allows port 4000
2. Check backend is running: `pm2 status`
3. Test from EC2: `curl http://localhost:4000`
4. Verify frontend has correct IP address

### Environment variables not loading

```bash
# Make sure .env file exists and has correct permissions
ls -la ~/.env

# Source the file manually before running
source ~/.env
node server.js
```

---

## Quick Commands Reference

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ip

# View backend logs
pm2 logs mybean-backend

# Restart backend
pm2 restart mybean-backend

# Stop backend
pm2 stop mybean-backend

# Start backend
pm2 start mybean-backend

# Exit SSH
exit
```

---

## Next Steps

1. After verifying backend works, update your frontend code with the EC2 IP
2. Rebuild and deploy frontend to app stores or test with Expo Go
3. Monitor logs regularly: `pm2 logs mybean-backend`
4. Set up CloudWatch monitoring for your EC2 instance
5. Consider HTTPS with AWS Certificate Manager + ALB

