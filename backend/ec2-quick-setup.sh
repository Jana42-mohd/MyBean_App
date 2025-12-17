#!/bin/bash
# Quick EC2 Setup Script for MyBean Backend

echo "Installing Node.js and npm..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

echo "Installing git..."
sudo yum install -y git

echo "Installing PM2 globally..."
sudo npm install -g pm2

echo "Checking versions..."
node --version
npm --version
git --version
pm2 --version

echo "Setup complete!"
