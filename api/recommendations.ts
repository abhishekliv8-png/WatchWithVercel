import type { VercelRequest, VercelResponse } from '@vercel/node';

const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { participants } = req.body;
  const TMDB_API_KEY = process.env.TMDB_API_KEY || "a7d8da4c2aff8a41d4fffe15f1161fc5";

  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return res.status(400).json({ error: "Invalid participants data" });
  }

  try {
    const genreCounts: Record<number, number> = {};
    participants.forEach((p: any) => {
      (p.genres || []).forEach((gId: number) => {
        genreCounts[gId] = (genreCounts[gId] || 0) + 1;
      });
    });

    let topGenreIds = Object.keys(genreCounts)
      .map(Number)
      .filter(id => genreCounts[id] >= 2);

    if (topGenreIds.length === 0) {
      topGenreIds = Object.keys(genreCounts).map(Number);
    }

    const fetchMovies = async (page: number) => {
      let url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&vote_average.gte=6.0&vote_count.gte=100&sort_by=popularity.desc&page=${page}&watch_region=US`;
      if (topGenreIds.length > 0) {
        url += `&with_genres=${topGenreIds.join(",")}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error(`TMDB API returned ${response.status}`);
      return response.json();
    };

    const randomPages: number[] = [];
    while (randomPages.length < 3) {
      const p = Math.floor(Math.random() * 10) + 1;
      if (!randomPages.includes(p)) randomPages.push(p);
    }

    const pages = await Promise.all(randomPages.map(p => fetchMovies(p)));
    let candidateMovies = pages.flatMap(p => p.results || []);

    const seen = new Set();
    candidateMovies = candidateMovies.filter((m: any) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    if (candidateMovies.length === 0) {
      const popRes = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=1`);
      const popData = await popRes.json();
      const top5Pop = (popData.results || []).slice(0, 5).map((m: any) => ({
        id: m.id, title: m.title,
        poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        rating: m.vote_average,
        year: m.release_date ? m.release_date.substring(0, 4) : "N/A",
        overview: m.overview, matchScore: 75, genre_ids: m.genre_ids
      }));
      return res.json({ results: top5Pop });
    }

    const scoredMovies = candidateMovies.map((movie: any) => {
      const movieGenres = movie.genre_ids || [];
      const matchedGenres = movieGenres.filter((id: number) => topGenreIds.includes(id));
      const genreScore = topGenreIds.length > 0 ? Math.min(matchedGenres.length / topGenreIds.length, 1.0) : 0;
      const ratingScore = (movie.vote_average || 0) / 10;
      const popularityScore = Math.min((movie.popularity || 0) / 200, 1.0);
      const releaseYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : 0;
      const recencyBonus = releaseYear >= 2022 ? 0.1 : 0;
      const totalScore = (genreScore * 0.45) + (ratingScore * 0.30) + (popularityScore * 0.15) + recencyBonus;
      return { ...movie, totalScore, year: movie.release_date ? movie.release_date.substring(0, 4) : "N/A" };
    });

    const top30 = scoredMovies.sort((a: any, b: any) => b.totalScore - a.totalScore).slice(0, 30);

    const resultsWithAvailability = await Promise.all(top30.map(async (m: any) => {
      let availableOn: string[] = [];
      try {
        const providerRes = await fetch(`https://api.themoviedb.org/3/movie/${m.id}/watch/providers?api_key=${TMDB_API_KEY}`);
        const providerData = await providerRes.json();
        const usResults = providerData.results?.US || {};
        const providers = [...(usResults.flatrate || []), ...(usResults.rent || []), ...(usResults.buy || [])];
        availableOn = Array.from(new Set(providers.map((p: any) => p.provider_name))) as string[];
      } catch (e) { /* skip */ }

      return {
        id: m.id, title: m.title,
        poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        rating: m.vote_average, year: m.year, overview: m.overview,
        matchScore: Math.round(m.totalScore * 100),
        genreTags: (m.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
        availableOn, genre_ids: m.genre_ids
      };
    }));

    const availableMovies = resultsWithAvailability.filter(m => m.availableOn.length > 0);
    const moviesToUse = availableMovies.length > 0 ? availableMovies : resultsWithAvailability;
    const top15 = moviesToUse.slice(0, 15);
    const shuffled = top15.sort(() => Math.random() - 0.5);
    const results = shuffled.slice(0, 8);

    res.json({ results });
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
}
