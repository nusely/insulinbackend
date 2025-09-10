# 🚀 Railway Deployment Guide for InsulinLog Backend

## 📋 Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Push your code to GitHub
3. **MongoDB Atlas**: Already configured
4. **Domain**: `insulin.batistasimons.com` (optional)

## 🏗️ Deployment Steps

### Step 1: Prepare GitHub Repository

1. **Create a new repository** on GitHub
2. **Upload the deployment files** to the repository
3. **Ensure these files are included:**
   - `server.js`
   - `package.json`
   - `railway.json`
   - `Procfile`
   - All source code files
   - **DO NOT include** `node_modules/`, `.env`, or `logs/`

### Step 2: Deploy to Railway

1. **Go to Railway Dashboard**: [railway.app/dashboard](https://railway.app/dashboard)
2. **Click "New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Choose your repository**
5. **Railway will automatically detect Node.js and deploy**

### Step 3: Configure Environment Variables

In Railway Dashboard, go to your project → Variables tab and add:

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://cimons:%23Cimon%241insulin@insulin-tracker-cluster.v67627s.mongodb.net/test?retryWrites=true&w=majority&appName=insulin-tracker-cluster
JWT_SECRET=9857bc87a057c2227bb1d0c9cec4629a30bd59229351547961e0f30f86f01f68c57c46d3ba83e6df00ebde7a14ec6a971f79ff8df0c0e4cb1e524095cf3d61ed
JWT_EXPIRE=7d
FRONTEND_URL=https://insulin.batistasimons.com
BASE_URL=https://your-railway-app.railway.app
FISH_AFRICA_APP_ID=7hMq66UXLGEUzxSCyJvq6
FISH_AFRICA_APP_SECRET=mwM_fhBsN1HXiSIvFClsS77u4iHuW6yBVZHP
FISH_AFRICA_SENDER_ID=CimonsTech
FISH_AFRICA_API_URL=https://api.letsfish.africa/v1/sms
FISH_AFRICA_TIMEOUT=30000
SMS_ENABLED=true
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=cimonstechnologies@gmail.com
EMAIL_PASS=pkhw zpxg qvlf bstk
EMAIL_FROM=cimonstechnologies@gmail.com
ADMIN_EMAIL=admin@insulinlog.com
SUPERADMIN_EMAIL=superadmin@insulinlog.com
```

### Step 4: Update URLs After Deployment

1. **Get your Railway domain** (e.g., `https://your-app.railway.app`)
2. **Update these environment variables:**
   - `BASE_URL=https://your-app.railway.app`
   - Keep `FRONTEND_URL=https://insulin.batistasimons.com`

### Step 5: Test the Deployment

1. **Health Check:**
   ```bash
   curl https://your-app.railway.app/api/health
   ```

2. **Test API Endpoints:**
   ```bash
   curl https://your-app.railway.app/api/auth/register
   ```

## 🔧 Railway Configuration

### Automatic Configuration:
- **Port**: Railway automatically sets `PORT` environment variable
- **Build**: Uses `package.json` and `railway.json`
- **Start**: Uses `Procfile` or `npm start`
- **Health Check**: Uses `/api/health` endpoint

### Custom Domain (Optional):
1. **Go to Railway Dashboard** → Your Project → Settings
2. **Add Custom Domain**: `api.insulin.batistasimons.com`
3. **Update DNS** to point to Railway
4. **Update environment variables** with new domain

## 📱 Frontend Integration

Update your frontend to use the Railway API:

```javascript
// In your frontend code
const API_BASE_URL = 'https://your-app.railway.app/api';
// or
const API_BASE_URL = 'https://api.insulin.batistasimons.com/api';
```

## 🚨 Troubleshooting

### Common Issues:

1. **Build Fails:**
   - Check `package.json` dependencies
   - Ensure all required files are in repository
   - Check Railway build logs

2. **Environment Variables:**
   - Verify all variables are set in Railway dashboard
   - Check variable names match exactly
   - Ensure no extra spaces or quotes

3. **Database Connection:**
   - Verify MongoDB Atlas whitelist includes Railway IPs
   - Check connection string format
   - Test connection locally first

4. **CORS Issues:**
   - Update `FRONTEND_URL` in Railway environment
   - Check CORS configuration in `server.js`

### Railway Logs:
- **View logs**: Railway Dashboard → Your Project → Deployments → View Logs
- **Real-time logs**: Railway CLI or Dashboard

## 🎯 Benefits of Railway

✅ **Automatic Deployments**: Deploys on every Git push
✅ **Zero Configuration**: Works out of the box
✅ **Automatic HTTPS**: SSL certificates included
✅ **Environment Variables**: Easy configuration
✅ **Custom Domains**: Professional URLs
✅ **Scaling**: Automatic scaling based on traffic
✅ **Monitoring**: Built-in metrics and logs

## 📞 Support

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Check logs** in Railway dashboard for errors

---

**Ready to deploy! Follow these steps and your backend will be live on Railway.** 🚀
