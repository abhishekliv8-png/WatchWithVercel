# WatchWith - Movie Night Picker

WatchWith is a group movie night picker that helps you and your friends decide what to watch tonight.

## Features
- Create a movie night session.
- Share with friends via a simple link.
- Everyone picks their preferred genres and streaming services.
- Real-time voting on recommendations.
- Final winner selection based on group consensus.

## Local Development

1. **Clone the repository.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up environment variables:**
   Copy `.env.example` to `.env` and fill in your API keys:
   - `TMDB_API_KEY`: Get one from [TMDB](https://www.themoviedb.org/documentation/api).
   - `FIREBASE_*`: Your Firebase project configuration.
4. **Run the development server:**
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

To deploy this full-stack Express + Vite app to Vercel, follow these steps:

### 1. Prepare for Vercel
Vercel works best with a specific structure for Express apps. You may need to add a `vercel.json` file to the root of your project:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.ts",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server.ts"
    },
    {
      "src": "/session/(.*)",
      "dest": "server.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
```

### 2. Set Environment Variables
In the Vercel dashboard, go to your project settings and add the environment variables defined in your `.env` file.

### 3. Deploy
You can deploy using the Vercel CLI:
```bash
vercel
```
Or by connecting your GitHub repository to Vercel for automatic deployments.

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, Motion.
- **Backend:** Express.js.
- **Database:** Firebase Firestore.
- **Icons:** Lucide React.
- **Animations:** Canvas Confetti.
