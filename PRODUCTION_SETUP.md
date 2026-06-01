# QBuild — Production Server Setup Guide

## Pulling the latest code on a production server

### First time setup on a new server:

```bash
# 1. Install prerequisites (Ubuntu/Debian)
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nodejs npm mysql-server nginx certbot python3-certbot-nginx

# 2. Clone the repository
git clone https://github.com/prajapativishall/QBuild.git
cd QBuild

# 3. Setup backend
cd backend
cp .env.example .env
nano .env   # Edit DB credentials + JWT secret
npm install
npm start   # Or: pm2 start src/app.js --name qbuild-backend

# 4. Setup web frontend
cd ../QBuild-Web
cp .env.example .env
nano .env   # Set VITE_API_URL=http://your-server-ip:3000/api
npm install
npm run build
pm2 start "npx serve -s dist -l 80" --name qbuild-frontend

# 5. Setup database
mysql -u root -p -e "CREATE DATABASE qbuild CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p qbuild < database/database.sql

# 6. Save PM2 process list
pm2 save
pm2 startup
```

### Updating existing production server with new code:

```bash
# Pull latest changes from GitHub
cd /home/monk/Downloads/QBuild
git pull origin main

# Update backend
cd backend
npm install
pm2 restart qbuild-backend

# Update frontend
cd ../QBuild-Web
npm install
npm run build
pm2 restart qbuild-frontend

# Check status
pm2 status
```

## Environment file (.env) template for production:

```env
# backend/.env
PORT=3000
NODE_ENV=production
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_secure_password
DB_NAME=qbuild
JWT_SECRET=your_random_secret_here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-domain.com
```

```env
# QBuild-Web/.env
VITE_API_URL=https://api.your-domain.com/api