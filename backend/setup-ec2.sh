#!/bin/bash

# MyBean Backend EC2 Setup Script
# Run this on your EC2 instance to automatically set up the backend

set -e  # Exit on any error

echo "==================================="
echo "MyBean Backend Setup Script"
echo "==================================="

# Step 1: Update system
echo "Step 1: Updating system packages..."
sudo yum update -y 2>/dev/null || sudo apt update -y

# Step 2: Install Node.js
echo "Step 2: Installing Node.js and npm..."
if command -v node &> /dev/null; then
    echo "Node.js already installed: $(node --version)"
else
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - 2>/dev/null || \
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs npm 2>/dev/null || sudo apt install -y nodejs npm
fi

# Step 3: Install Git
echo "Step 3: Installing Git..."
sudo yum install -y git 2>/dev/null || sudo apt install -y git

# Step 4: Install PM2
echo "Step 4: Installing PM2..."
sudo npm install -g pm2

# Step 5: Clone or prepare backend
echo "Step 5: Preparing backend..."
cd ~
if [ ! -d "MyBean_App" ]; then
    echo "Cloning repository..."
    git clone https://github.com/Jana42-mohd/MyBean_App.git
fi

cd MyBean_App/backend

# Step 6: Install dependencies
echo "Step 6: Installing Node dependencies..."
npm install

# Step 7: Create .env file
echo "Step 7: Creating .env file..."
if [ ! -f ".env" ]; then
    cat > .env << 'ENVFILE'
PORT=4000
NODE_ENV=production
JWT_SECRET=your-very-secure-jwt-secret-change-this-in-production
DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/mybean_db
DB_SSL=true
ENVFILE
    echo "⚠️  .env file created. PLEASE UPDATE with your RDS credentials!"
    echo "Edit with: nano .env"
else
    echo ".env file already exists"
fi

echo ""
echo "==================================="
echo "✅ Setup Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Update .env with your RDS credentials"
echo "2. Test locally: npm start"
echo "3. Run with PM2: pm2 start server.js --name 'mybean-backend'"
echo "4. Check status: pm2 status"
echo "5. View logs: pm2 logs mybean-backend"
echo ""
