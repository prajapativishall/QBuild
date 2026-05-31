# QRating Deployment Guide

This guide provides step-by-step instructions for deploying the QRating project to GitHub and setting up the database.

## Table of Contents

- [Prerequisites](#prerequisites)
- [GitHub Setup](#github-setup)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [Deployment Steps](#deployment-steps)
- [Production Deployment](#production-deployment)

## Prerequisites

Before deploying, ensure you have:

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- Git installed
- GitHub account
- Code editor (VS Code recommended)

## GitHub Setup

### 1. Create GitHub Repository

1. Log in to GitHub (https://github.com)
2. Click the "+" icon in the top-right corner
3. Select "New repository"
4. Fill in repository details:
   - Repository name: `QRating`
   - Description: `Quality Rating System with Multi-level Approval Workflow`
   - Public/Private: Choose based on your preference
   - Initialize with: **DO NOT** initialize with README, .gitignore, or license
5. Click "Create repository"

### 2. Initialize Local Git Repository

Open terminal in the project root directory:

```bash
cd /home/monk/Downloads/QRating
git init
```

### 3. Add Remote Repository

```bash
git remote add origin https://github.com/prajapativishall/QRating.git
```

### 4. Stage and Commit Files

```bash
# Add all files (respecting .gitignore)
git add .

# Commit changes
git commit -m "Initial commit: QRating system with manager approval flow"
```

### 5. Push to GitHub

```bash
# Push main branch
git branch -M main
git push -u origin main
```

**Note:** You will be prompted for your GitHub username and password. Use your personal access token instead of your regular password for authentication.

### 6. Create Personal Access Token (for authentication)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`
4. Generate token and copy it
5. Use this token when prompted for password during git push

## Database Setup

### 1. Create Database

Option 1: Using MySQL Command Line

```bash
mysql -u root -p
```

Then run:

```sql
CREATE DATABASE qrating CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

Option 2: Using phpMyAdmin or MySQL Workbench

- Create a new database named `qrating`
- Set character set to `utf8mb4` and collation to `utf8mb4_unicode_ci`

### 2. Run Migration Script

Navigate to the backend directory and run the migration:

```bash
cd /home/monk/Downloads/QRating/backend
mysql -u root -p qrating < migrations/init.sql
```

Or using MySQL Workbench/phpMyAdmin:
- Open the `migrations/init.sql` file
- Execute the SQL script on the `qrating` database

### 3. Verify Database Setup

```bash
mysql -u root -p qrating -e "SHOW TABLES;"
```

You should see all the tables created (users, projects, domains, sub_domains, etc.)

## Environment Configuration

### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cd /home/monk/Downloads/QRating/backend
cp .env.example .env
```

Or create `.env` manually with the following content:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=qrating

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

**Important:** The `.env` file is already in `.gitignore`, so it won't be committed to GitHub.

### Frontend Environment Variables

Create a `.env` file in the `QRating-Web` directory:

```bash
cd /home/monk/Downloads/QRating/QRating-Web
```

Create `.env` with:

```env
VITE_API_URL=http://localhost:3000/api
```

## Deployment Steps

### Local Development Setup

1. **Clone the repository** (on a new machine):

```bash
git clone https://github.com/prajapativishall/QRating.git
cd QRating
```

2. **Install Backend Dependencies**:

```bash
cd backend
npm install
```

3. **Configure Backend Environment**:

```bash
# Create .env file with your database credentials
nano .env
```

4. **Start Backend Server**:

```bash
npm run dev
```

Backend will run on `http://localhost:3000`

5. **Install Frontend Dependencies**:

```bash
cd ../QRating-Web
npm install
```

6. **Configure Frontend Environment**:

```bash
# Create .env file
echo "VITE_API_URL=http://localhost:3000/api" > .env
```

7. **Start Frontend Development Server**:

```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

## Production Deployment

### Option 1: Vercel (Frontend) + Render/Railway (Backend)

#### Frontend Deployment (Vercel)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy frontend:
```bash
cd QRating-Web
vercel
```

3. Follow the prompts and set environment variable:
   - `VITE_API_URL`: Your backend production URL

#### Backend Deployment (Render)

1. Create a `render.yaml` file in backend directory:

```yaml
services:
  - type: web
    name: qrating-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DB_HOST
        value: your-db-host
      - key: DB_USER
        value: your-db-user
      - key: DB_PASSWORD
        value: your-db-password
      - key: DB_NAME
        value: qrating
      - key: JWT_SECRET
        value: your-jwt-secret
```

2. Push to GitHub and connect to Render

### Option 2: Self-Hosted (VPS)

1. **Set up VPS** (DigitalOcean, AWS EC2, etc.)
2. **Install Node.js and MySQL**
3. **Clone repository**
4. **Install dependencies**
5. **Configure environment variables**
6. **Build frontend**:
```bash
cd QRating-Web
npm run build
```
7. **Serve with PM2**:
```bash
npm install -g pm2
pm2 start backend/src/app.js --name qrating-backend
pm2 start "npx serve -s QRating-Web/dist -l 80" --name qrating-frontend
```

8. **Set up Nginx reverse proxy** (optional but recommended)

### Option 3: Docker Deployment

1. **Create Dockerfile for backend**:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

2. **Create Dockerfile for frontend**:

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

3. **Build and run containers**:
```bash
docker build -t qrating-backend ./backend
docker build -t qrating-frontend ./QRating-Web
docker run -p 3000:3000 qrating-backend
docker run -p 80:80 qrating-frontend
```

## Database Migration for Production

When deploying to production:

1. **Backup existing database** (if any):
```bash
mysqldump -u root -p qrating > backup.sql
```

2. **Run migration script**:
```bash
mysql -u root -p qrating < backend/migrations/init.sql
```

3. **Verify tables**:
```bash
mysql -u root -p qrating -e "SHOW TABLES;"
```

## Security Best Practices

1. **Never commit `.env` files** - They are in `.gitignore`
2. **Use strong passwords** for database and JWT secret
3. **Change default admin password** after first login
4. **Enable HTTPS** in production
5. **Use environment-specific secrets**
6. **Regular database backups**
7. **Keep dependencies updated**

## Troubleshooting

### Git Push Issues

**Problem:** Authentication failed
**Solution:** Use Personal Access Token instead of password

**Problem:** Remote already exists
**Solution:**
```bash
git remote remove origin
git remote add origin https://github.com/prajapativishall/QRating.git
```

### Database Issues

**Problem:** Connection refused
**Solution:** Check MySQL service is running and credentials are correct

**Problem:** Table already exists
**Solution:** Drop database and recreate, or modify migration script

### Build Issues

**Problem:** Module not found
**Solution:** Run `npm install` in both backend and frontend directories

**Problem:** Port already in use
**Solution:** Change PORT in `.env` file

## Post-Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] Database created and migrated
- [ ] Environment variables configured
- [ ] Backend server running
- [ ] Frontend server running
- [ ] Admin user created and password changed
- [ ] HTTPS enabled (production)
- [ ] Database backups configured
- [ ] Monitoring/logging set up
- [ ] Tests passing

## Additional Resources

- [GitHub Documentation](https://docs.github.com)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Render Deployment Guide](https://render.com/docs)

## Support

For issues or questions:
- Check the TESTING.md for testing information
- Review the code comments for implementation details
- Check GitHub Issues for known problems
