# OrbitHub - Deployment Guide

## 🚀 Quick Deploy to Render

### Step 1: Prepare Repository
```bash
git clone https://github.com/Maks1122n/OrbitHub.git
cd OrbitHub
```

### Step 2: Create Render Web Service
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `orbithub`
   - **Environment**: `Node`
   - **Region**: `Oregon (US West)`
   - **Branch**: `main`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`

### Step 3: Set Environment Variables
In Render Dashboard → Environment:

**Required Variables:**
```
NODE_ENV=production
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_refresh_secret_key
ENCRYPTION_KEY=your_32_character_encryption_key
DROPBOX_ACCESS_TOKEN=your_dropbox_token
```

**Optional Variables:**
```
ADSPOWER_HOST=http://local.adspower.net:50325
MAX_POSTS_PER_DAY=10
MIN_DELAY_BETWEEN_POSTS=3600
MAX_DELAY_BETWEEN_POSTS=7200
```

### Step 4: Setup MongoDB Atlas
1. Create account at [MongoDB Atlas](https://cloud.mongodb.com)
2. Create new cluster (FREE tier available)
3. Create database user
4. Get connection string
5. Add to Render environment variables

### Step 5: Deploy
1. Click "Create Web Service"
2. Wait for build and deployment (5-10 minutes)
3. Your app will be available at: `https://your-app-name.onrender.com`

## 🔧 Local Development

```bash
# Install dependencies
npm run install:all

# Start development
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📊 Health Check

After deployment, check health status:
```
GET https://your-app.onrender.com/health
```

Should return:
```json
{
  "status": "OK",
  "environment": "production",
  "services": {
    "database": "connected",
    "adspower": "disconnected",
    "dropbox": "connected",
    "automation": "running"
  }
}
```

## 🔑 First Login

Default admin credentials:
- **Email**: `admin@orbithub.com`
- **Password**: `admin123456`

**⚠️ Change these credentials immediately after first login!**

## 🐛 Troubleshooting

### Common Issues:

**Build fails:**
- Check Node.js version (>=18.0.0)
- Verify all dependencies are listed
- Check for TypeScript errors

**App crashes:**
- Check environment variables
- Verify MongoDB connection
- Check logs in Render dashboard

**Automation not starting:**
- Ensure you have active accounts
- Check AdsPower connection (will be disconnected in cloud)
- Verify Dropbox token

### Getting Help:
1. Check Render logs in dashboard
2. Visit `/health` endpoint for status
3. Check browser console for frontend errors

## 🔄 Updates

To update your deployment:
1. Push changes to GitHub
2. Render will automatically redeploy
3. Check health endpoint after deployment

## 🎯 Production Checklist

- [ ] MongoDB Atlas configured
- [ ] Environment variables set
- [ ] Health check returns OK
- [ ] Can login with admin credentials
- [ ] Dropbox token updated in UI
- [ ] Test account creation
- [ ] Verify automation system

## 🌟 Features

- ✅ Instagram account management
- ✅ AdsPower integration (local only)
- ✅ Dropbox video management
- ✅ Automated posting with scheduling
- ✅ Real-time monitoring
- ✅ Analytics and reporting
- ✅ Responsive web interface

## 📈 Scaling

For production use:
- Upgrade to Render Standard plan
- Use MongoDB Atlas M10+ cluster
- Consider Redis for caching
- Set up monitoring and alerts

## 🔒 Security Notes

- Change default admin credentials immediately
- Use strong JWT secrets (generate them in Render)
- Keep Dropbox tokens secure
- Monitor logs for suspicious activity
- Update dependencies regularly

## 🎉 Success!

After successful deployment, you'll have:
- 🌐 Live OrbitHub application
- 🔐 Secure authentication system
- 📊 MongoDB database in the cloud
- 📁 Dropbox integration working
- 🤖 Automation system ready
- 📱 Responsive interface on all devices

Your OrbitHub is now ready for Instagram automation! 