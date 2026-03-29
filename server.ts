import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

dotenv.config();

// Initialize Firebase for server-side OG tag fetching
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to get the public URL for sharing
  app.get("/api/config", (req, res) => {
    res.json({
      appUrl: process.env.APP_URL || `http://localhost:${PORT}`,
    });
  });

  // TMDB Service Mapping (Provider IDs)
  const SERVICE_MAP: Record<string, number> = {
    netflix: 8,
    amazon: 119, // Amazon Prime Video
    disney: 337,
    hbo: 1899, // Max (formerly HBO Max)
    hulu: 15,
    apple: 350,
    peacock: 386,
    paramount: 531,
    crunchyroll: 283,
  };

  // Recommendation API
  app.post("/api/recommendations", async (req, res) => {
    const { participants } = req.body;
    let TMDB_API_KEY = process.env.TMDB_API_KEY;

    // Fallback to the key provided by the user in the prompt if not in environment
    if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY") {
      TMDB_API_KEY = "a7d8da4c2aff8a41d4fffe15f1161fc5";
    }

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: "Invalid participants data" });
    }

    try {
      // Step 1: Collect all genre votes and rank them
      const genreCounts: Record<number, number> = {};
      participants.forEach(p => {
        (p.genres || []).forEach((gId: number) => {
          genreCounts[gId] = (genreCounts[gId] || 0) + 1;
        });
      });

      // Top genres are any selected by at least 2 people, or all if no overlap
      let topGenreIds = Object.keys(genreCounts)
        .map(Number)
        .filter(id => genreCounts[id] >= 2);

      if (topGenreIds.length === 0) {
        topGenreIds = Object.keys(genreCounts).map(Number);
      }

      // Step 2: Collect streaming service selections (for future use)
      const serviceCounts: Record<string, number> = {};
      participants.forEach(p => {
        (p.services || []).forEach((sId: string) => {
          serviceCounts[sId] = (serviceCounts[sId] || 0) + 1;
        });
      });

      // Step 3: Fetch movies from TMDB (3 random pages from 1-10)
      const fetchMovies = async (page: number) => {
        let url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&vote_average.gte=6.0&vote_count.gte=100&sort_by=popularity.desc&page=${page}&watch_region=US`;
        
        if (topGenreIds.length > 0) {
          url += `&with_genres=${topGenreIds.join(",")}`;
        }

        console.log(`Fetching TMDB Page ${page}: ${url.replace(TMDB_API_KEY, "REDACTED")}`);
        const response = await fetch(url);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`TMDB API Error (Page ${page}):`, response.status, errorText);
          throw new Error(`TMDB API returned ${response.status}`);
        }
        return response.json();
      };

      const randomPages: number[] = [];
      while (randomPages.length < 3) {
        const p = Math.floor(Math.random() * 10) + 1;
        if (!randomPages.includes(p)) randomPages.push(p);
      }

      let pages = await Promise.all(randomPages.map(p => fetchMovies(p)));
      let candidateMovies = pages.flatMap(p => p.results || []);

      // Remove duplicates
      const seen = new Set();
      candidateMovies = candidateMovies.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });

      // Fallback: If no movies found, use popular endpoint
      if (candidateMovies.length === 0) {
        console.log("No movies found with filters, falling back to popular movies...");
        const popRes = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=1`);
        const popData = await popRes.json();
        const top5Pop = (popData.results || []).slice(0, 5).map((m: any) => ({
          id: m.id,
          title: m.title,
          poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
          rating: m.vote_average,
          year: m.release_date ? m.release_date.substring(0, 4) : "N/A",
          overview: m.overview,
          matchScore: 75,
          genre_ids: m.genre_ids
        }));
        return res.json({ results: top5Pop });
      }

      // Step 4: Score each movie
      const scoredMovies = candidateMovies.map(movie => {
        const movieGenres = movie.genre_ids || [];
        const matchedGenres = movieGenres.filter((id: number) => topGenreIds.includes(id));
        
        // genreScore = matched / total top genres, cap at 1.0
        const genreScore = topGenreIds.length > 0 ? Math.min(matchedGenres.length / topGenreIds.length, 1.0) : 0;
        
        // ratingScore = vote_average / 10
        const ratingScore = (movie.vote_average || 0) / 10;

        // popularityScore = min(popularity / 200, 1.0)
        const popularityScore = Math.min((movie.popularity || 0) / 200, 1.0);

        // recencyBonus = 0.1 if year >= 2022
        const releaseYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : 0;
        const recencyBonus = releaseYear >= 2022 ? 0.1 : 0;

        // totalScore = (genreScore * 0.45) + (ratingScore * 0.30) + (popularityScore * 0.15) + recencyBonus
        const totalScore = (genreScore * 0.45) + (ratingScore * 0.30) + (popularityScore * 0.15) + recencyBonus;

        return {
          ...movie,
          totalScore,
          year: movie.release_date ? movie.release_date.substring(0, 4) : "N/A",
        };
      });

      // Step 5: Sort by totalScore descending and take top 30 to check for availability
      const top30 = scoredMovies
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 30);

      // Step 6: Fetch streaming availability and filter
      const resultsWithAvailability = await Promise.all(top30.map(async (m) => {
        const GENRE_MAP: Record<number, string> = {
          28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
          99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
          27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
          10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
        };

        let availableOn: string[] = [];
        try {
          const providerRes = await fetch(`https://api.themoviedb.org/3/movie/${m.id}/watch/providers?api_key=${TMDB_API_KEY}`);
          const providerData = await providerRes.json();
          const usResults = providerData.results?.US || {};
          
          // Combine flatrate, rent, and buy for better coverage
          const providers = [
            ...(usResults.flatrate || []),
            ...(usResults.rent || []),
            ...(usResults.buy || [])
          ];
          
          // Get unique provider names
          const uniqueProviderNames = Array.from(new Set(providers.map((p: any) => p.provider_name)));
          availableOn = uniqueProviderNames;
        } catch (e) {
          console.error(`Failed to fetch providers for ${m.id}`);
        }

        return {
          id: m.id,
          title: m.title,
          poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
          rating: m.vote_average,
          year: m.year,
          overview: m.overview,
          matchScore: Math.round(m.totalScore * 100),
          genreTags: (m.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
          availableOn,
          genre_ids: m.genre_ids
        };
      }));

      // Filter out movies with no streaming availability
      const availableMovies = resultsWithAvailability.filter(m => m.availableOn.length > 0);

      // Take top 15, shuffle them, and pick 8
      const top15 = availableMovies.slice(0, 15);
      const shuffled = top15.sort(() => Math.random() - 0.5);
      const results = shuffled.slice(0, 8);

      res.json({ results });
    } catch (error) {
      console.error("Recommendation error:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  // TMDB Proxy (Legacy/Simple)
  app.get("/api/movies", async (req, res) => {
    const { genres, services } = req.query;
    const TMDB_API_KEY = process.env.TMDB_API_KEY || "a7d8da4c2aff8a41d4fffe15f1161fc5";

    try {
      // This is a simplified recommendation logic.
      // In a real app, you'd use genres and watch providers.
      const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genres}&sort_by=popularity.desc`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movies" });
    }
  });

  // Get Popular Movies for Backgrounds
  app.get("/api/movies/popular", async (req, res) => {
    const TMDB_API_KEY = process.env.TMDB_API_KEY || "a7d8da4c2aff8a41d4fffe15f1161fc5";
    try {
      const response = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=1`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch popular movies" });
    }
  });

  // Helper to inject OG tags
  const injectOGTags = async (html: string, sessionId: string) => {
    let title = "WatchWith - Movie Night";
    let description = "Join and help pick what we watch!";
    
    try {
      const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
      if (sessionDoc.exists()) {
        const data = sessionDoc.data();
        if (data.creatorName) {
          title = `${data.creatorName}'s movie night`;
        }
      }
    } catch (e) {
      console.error("Error fetching session for OG tags:", e);
    }

    const ogTags = `
      <title>${title}</title>
      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${description}" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
    `;

    return html.replace("<title>My Google AI Studio App</title>", ogTags);
  };

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    // Custom route for session pages to inject OG tags in dev
    app.get("/session/:sessionId", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        const html = await injectOGTags(template, req.params.sessionId);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Custom route for session pages to inject OG tags in prod
    app.get("/session/:sessionId", async (req, res) => {
      try {
        const template = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
        const html = await injectOGTags(template, req.params.sessionId);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        res.status(500).send("Internal Server Error");
      }
    });

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
