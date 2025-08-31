# 🚀 Deployment Guide

## GitHub Pages Setup

### 1. Update package.json
Update the `homepage` field in `package.json` with your GitHub username:
```json
"homepage": "https://YOUR-USERNAME.github.io/f1-live-dashboard"
```

### 2. Manual Deployment
```bash
npm run deploy
```

### 3. Automatic Deployment (Recommended)
Push to `main` or `master` branch - GitHub Actions will automatically build and deploy.

### 4. GitHub Repository Settings
1. Go to your repository settings
2. Navigate to "Pages" section
3. Set source to "Deploy from a branch"
4. Select branch: `gh-pages`
5. Select folder: `/ (root)`

## Alternative Deployment Options

### Vercel
1. Connect your GitHub repository to Vercel
2. Set build command: `npm run build`
3. Set output directory: `build`

### Netlify
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build` 
3. Set publish directory: `build`

## Environment Variables
No environment variables required - the app uses the free OpenF1 API.

## Build Output
- Production build is created in the `build/` directory
- Optimised for performance and ready for deployment
- Static files that can be served from any web server

## Notes
- The app is fully static and doesn't require a backend server
- All F1 data is fetched client-side from the OpenF1 API
- Mobile responsive and optimised for all devices
