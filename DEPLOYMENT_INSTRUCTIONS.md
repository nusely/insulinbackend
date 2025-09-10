# 🚀 InsulinLog Backend Deployment Instructions

## 📋 Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Verify `.env` file has correct production values
- [ ] Ensure `NODE_ENV=production`
- [ ] Verify `FRONTEND_URL=https://insulin.batistasimons.com`
- [ ] Check MongoDB Atlas connection string
- [ ] Verify SMS and Email API credentials

### 2. Server Requirements
- [ ] Node.js installed (version 16+ recommended)
- [ ] npm or yarn package manager
- [ ] MongoDB Atlas connection (already configured)
- [ ] SSL certificate for HTTPS

## 🏗️ Deployment Steps

### Step 1: Upload Files
1. Upload all files in this folder to your server
2. Ensure file permissions are correct (755 for directories, 644 for files)

### Step 2: Install Dependencies
```bash
npm install --production
```

### Step 3: Start the Application
```bash
# Option 1: Direct start
node server.js

# Option 2: Using npm start
npm start

# Option 3: Using PM2 (recommended for production)
npm install -g pm2
pm2 start server.js --name "insulinlog-backend"
pm2 startup
pm2 save
```

### Step 4: Configure Web Server
Set up reverse proxy to route:
- `/api/*` → Backend server (port 5000)
- `/*` → Frontend build files

## 🔧 Environment Variables

The `.env` file contains:
```env
NODE_ENV=production
FRONTEND_URL=https://insulin.batistasimons.com
BASE_URL=https://insulin.batistasimons.com
PORT=5000
# ... other production settings
```

## 📱 Testing After Deployment

1. **Health Check:**
   ```bash
   curl https://insulin.batistasimons.com/api/health
   ```

2. **API Endpoints:**
   - Test registration: `POST /api/auth/register`
   - Test login: `POST /api/auth/login`
   - Test dose logging: `POST /api/doses`

3. **Frontend Integration:**
   - Visit: `https://insulin.batistasimons.com`
   - Test user registration and login
   - Test dose logging functionality

## 🚨 Troubleshooting

### Common Issues:
1. **CORS Errors:** Check FRONTEND_URL in .env
2. **Database Connection:** Verify MongoDB Atlas whitelist
3. **SMS/Email Issues:** Check API credentials
4. **Port Conflicts:** Ensure port 5000 is available

### Logs:
- Check application logs in `logs/` directory
- Monitor server console output
- Check PM2 logs: `pm2 logs insulinlog-backend`

## 📞 Support

- Check server logs for errors
- Verify environment variables
- Test API endpoints individually
- Monitor database connections

## 🔒 Security Notes

- CORS is configured for production domain only
- JWT secrets are properly configured
- API rate limiting is enabled
- Input validation is in place

---

**Deployment Package Created:** $(date)
**Version:** Production Ready
**Domain:** insulin.batistasimons.com