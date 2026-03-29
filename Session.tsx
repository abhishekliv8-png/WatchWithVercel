import React, { useState, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, onSnapshot, updateDoc, collection, setDoc, getDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { Share2, Check, Users, Play, Tv, Film, ChevronRight, Loader2, Trophy, Star, Music, X, Download, Instagram, Twitter, MessageCircle, Facebook, ArrowRight, Heart, ExternalLink, RefreshCw, Copy } from "lucide-react";
import { cn } from "../lib/utils";
import confetti from "canvas-confetti";

const GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 10770, name: "TV Movie" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];

const SERVICES = [
  { id: "netflix", name: "Netflix" },
  { id: "amazon", name: "Amazon Prime Video" },
  { id: "disney", name: "Disney+" },
  { id: "hbo", name: "HBO Max" },
  { id: "hulu", name: "Hulu" },
  { id: "apple", name: "Apple TV+" },
  { id: "peacock", name: "Peacock" },
  { id: "paramount", name: "Paramount+" },
  { id: "crunchyroll", name: "Crunchyroll" },
];

export default function Session() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const [userId] = useState(() => {
    const param = searchParams.get("user");
    if (param) return param;
    const stored = localStorage.getItem(`watchwith_user_${sessionId}`);
    if (stored) return stored;
    const newId = "guest_" + Math.random().toString(36).substring(2, 6);
    localStorage.setItem(`watchwith_user_${sessionId}`, newId);
    return newId;
  });

  const [session, setSession] = useState<any>(null);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [myPrefs, setMyPrefs] = useState<any>(null);
  const [appUrl, setAppUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [movies, setMovies] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [fetchingMovies, setFetchingMovies] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [drumroll, setDrumroll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState("Copied!");
  const [randomBackdrop, setRandomBackdrop] = useState<string | null>(null);

  // Feedback Toast State
  const [showFeedbackToast, setShowFeedbackToast] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSharingRef = useRef(false);

  useEffect(() => {
    const fetchRandomBackdrop = async () => {
      try {
        const response = await fetch("/api/movies/popular");
        const data = await response.json();
        const movies = data.results || [];
        if (movies.length > 0) {
          const randomMovie = movies[Math.floor(Math.random() * movies.length)];
          setRandomBackdrop(randomMovie.backdrop_path);
        }
      } catch (error) {
        console.error("Failed to fetch random backdrop:", error);
      }
    };
    fetchRandomBackdrop();
  }, []);


  useEffect(() => {
    if (session?.status === "winner") {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f97316', '#ffffff', '#000000']
      });
    }
  }, [session?.status]);

  useEffect(() => {
    // Only trigger on the winner screen
    const isFinalScreen = session?.status === "winner";
    
    // Check if the actual content is visible (not loading)
    const isContentVisible = session?.status === "winner" && !!session.winner;

    if (isFinalScreen && isContentVisible && !feedbackSubmitted) {
      const timer = setTimeout(() => {
        setShowFeedbackToast(true);
        // Auto-hide after 15 seconds if no interaction
        feedbackTimerRef.current = setTimeout(() => {
          setShowFeedbackToast(false);
        }, 15000);
      }, 10000);
      
      return () => {
        clearTimeout(timer);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      };
    } else {
      // If status changes away from results/winner, hide toast and clear timers
      setShowFeedbackToast(false);
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    }
  }, [session?.status, feedbackSubmitted, fetchingMovies, session?.movies, session?.winner]);

  const handleStarTap = (rating: number) => {
    setFeedbackRating(rating);
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };

  const submitFeedback = async () => {
    if (feedbackRating === 0 || !sessionId) return;
    setIsSubmittingFeedback(true);
    try {
      await setDoc(doc(collection(db, "feedback")), {
        sessionId,
        rating: feedbackRating,
        comment: feedbackComment,
        userName: myPrefs?.userName || guestName || "Anonymous",
        createdAt: new Date().toISOString(),
      });
      setFeedbackSubmitted(true);
      setShowFeedbackToast(false);
      // @ts-ignore
      if (typeof window.gtag === 'function') {
        // @ts-ignore
        window.gtag('event', 'feedback_submitted');
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const getShareUrl = () => {
    const base = appUrl || window.location.origin;
    return `${base}/session/${sessionId}`;
  };

  const copyLink = () => {
    const url = getShareUrl();
    // @ts-ignore
    if (typeof window.gtag === 'function') {
      // @ts-ignore
      window.gtag('event', 'share_clicked');
    }
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy:", err);
    });
  };

  const handleShareInvite = async () => {
    if (isSharingRef.current) return;
    
    const url = getShareUrl();
    // @ts-ignore
    if (typeof window.gtag === 'function') {
      // @ts-ignore
      window.gtag('event', 'share_clicked');
    }
    const shareData = {
      title: "Join my Movie Night!",
      text: "Help me pick what we watch tonight on WatchWith!",
      url: url,
    };

    if (navigator.share) {
      isSharingRef.current = true;
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          // Fallback to clipboard if permission denied (common in iframes)
          copyLink();
        } else if (err instanceof Error && err.name !== 'AbortError') {
          console.error("Error sharing:", err);
          copyLink();
        }
      } finally {
        isSharingRef.current = false;
      }
    } else {
      copyLink();
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    const unsubSession = onSnapshot(doc(db, "sessions", sessionId), (doc) => {
      const data = doc.data();
      console.log("Session update:", data?.status, data);
      setSession(data);
      setLoading(false);
    });

    const unsubPrefs = onSnapshot(collection(db, "sessions", sessionId, "preferences"), (snapshot) => {
      const prefs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPreferences(prefs);
      const mine = prefs.find(p => p.id === userId);
      if (mine) setMyPrefs(mine);
    });

    const unsubVotes = onSnapshot(collection(db, "sessions", sessionId, "votes"), (snapshot) => {
      const v = snapshot.docs.map(d => ({ userId: d.id, ...d.data() }));
      setVotes(v);
    });

    // Fetch public app URL
    fetch("/api/config")
      .then(res => res.json())
      .then(data => setAppUrl(data.appUrl))
      .catch(console.error);

    return () => {
      unsubSession();
      unsubPrefs();
    };
  }, [sessionId, userId]);

  useEffect(() => {
    if (session?.status === "waiting" && session?.expectedParticipants === 1 && userId === "creator" && preferences.length > 0) {
      console.log("Solo night detected, auto-starting picking phase...");
      startPicking();
    }
  }, [session?.status, session?.expectedParticipants, userId, preferences.length]);

  useEffect(() => {
    const shouldFetch = 
      session?.status === "results" && 
      movies.length === 0 && 
      preferences.length > 0 && 
      !fetchingMovies;

    if (shouldFetch) {
      console.log("Auto-triggering fetchRecommendations...");
      fetchRecommendations();
    }
  }, [session?.status, preferences.length]); // Remove movies.length and fetchingMovies from deps to prevent loop

  const joinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !sessionId) return;
    setJoining(true);
    try {
      await setDoc(doc(db, "sessions", sessionId, "preferences", userId), {
        userName: guestName,
        genres: [],
        services: [],
        submitted: false,
      });
      // @ts-ignore
      if (typeof window.gtag === 'function') {
        // @ts-ignore
        window.gtag('event', 'friend_joined');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${sessionId}/preferences/${userId}`);
    } finally {
      setJoining(false);
    }
  };

  const toggleGenre = async (id: number) => {
    if (!myPrefs || myPrefs.submitted) return;
    const isSelected = myPrefs.genres.includes(id);
    
    if (!isSelected && myPrefs.genres.length >= 5) {
      alert("You can only pick up to 5 genres!");
      return;
    }

    const genres = isSelected
      ? myPrefs.genres.filter((g: number) => g !== id)
      : [...myPrefs.genres, id];
    try {
      await updateDoc(doc(db, "sessions", sessionId!, "preferences", userId), { genres });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}/preferences/${userId}`);
    }
  };

  const toggleService = async (id: string) => {
    if (!myPrefs || myPrefs.submitted) return;
    const services = myPrefs.services.includes(id)
      ? myPrefs.services.filter((s: string) => s !== id)
      : [...myPrefs.services, id];
    try {
      await updateDoc(doc(db, "sessions", sessionId!, "preferences", userId), { services });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}/preferences/${userId}`);
    }
  };

  const submitPrefs = async () => {
    if (!sessionId) return;
    try {
      await updateDoc(doc(db, "sessions", sessionId, "preferences", userId), { submitted: true });
      // @ts-ignore
      if (typeof window.gtag === 'function') {
        // @ts-ignore
        window.gtag('event', 'vote_submitted');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}/preferences/${userId}`);
    }
  };

  const fetchRecommendations = async () => {
    if (preferences.length === 0) return;
    setFetchingMovies(true);
    console.log("Fetching recommendations for participants:", preferences);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants: preferences }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch recommendations");
      }
      const data = await res.json();
      console.log("Received recommendations:", data.results);
      const recommendedMovies = data.results || [];
      setMovies(recommendedMovies);
      
      // @ts-ignore
      if (typeof window.gtag === 'function') {
        // @ts-ignore
        window.gtag('event', 'results_viewed');
      }

      // Host saves the initial movie list to the session
      if (userId === "creator") {
        await updateDoc(doc(db, "sessions", sessionId), { 
          movies: recommendedMovies
        });
      }
    } catch (error) {
      console.error("Recommendation fetch error:", error);
      alert(error instanceof Error ? error.message : "Failed to get recommendations. Please check your TMDB API key in Secrets.");
    } finally {
      setFetchingMovies(false);
    }
  };

  const voteForMovie = async (movieId: number) => {
    if (!sessionId || session?.status !== "voting") return;
    try {
      await setDoc(doc(db, "sessions", sessionId, "votes", userId), { movieId });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${sessionId}/votes/${userId}`);
    }
  };

  const calculateWinner = async () => {
    if (!sessionId || userId !== "creator" || votes.length === 0) {
      alert("No votes have been cast yet!");
      return;
    }
    setCalculating(true);
    setDrumroll(true);
    
    try {
      // Simulate drumroll suspense
      await new Promise(resolve => setTimeout(resolve, 3000));

      const voteCounts: Record<number, number> = {};
      votes.forEach(v => {
        if (v.movieId) {
          voteCounts[v.movieId] = (voteCounts[v.movieId] || 0) + 1;
        }
      });

      const counts = Object.values(voteCounts);
      if (counts.length === 0) {
        alert("No valid votes found!");
        return;
      }

      const maxVotes = Math.max(...counts);
      const winners = session.movies.filter((m: any) => voteCounts[m.id] === maxVotes);

      if (winners.length === 1) {
        // We have a single winner!
        await updateDoc(doc(db, "sessions", sessionId), {
          status: "winner",
          winner: winners[0]
        });
      } else {
        // It's a tie! Show only the tied movies and reset votes
        alert(`It's a tie between ${winners.length} movies! Starting a tie-breaker round with only the top picks.`);
        
        // Reset votes in Firestore
        const deletePromises = votes.map(v => 
          setDoc(doc(db, "sessions", sessionId, "votes", v.userId), { movieId: null })
        );
        await Promise.all(deletePromises);

        await updateDoc(doc(db, "sessions", sessionId), {
          movies: winners,
          status: "voting"
        });
      }
    } catch (error) {
      console.error("Failed to calculate winner:", error);
      alert("Something went wrong while calculating the winner.");
    } finally {
      setCalculating(false);
      setDrumroll(false);
    }
  };

  const startVoting = async () => {
    if (!sessionId || userId !== "creator") return;
    try {
      await updateDoc(doc(db, "sessions", sessionId), { status: "voting" });
    } catch (error) {
      console.error("Failed to start voting:", error);
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
    }
  };

  const startPicking = async () => {
    if (!sessionId) return;
    console.log("Host starting picking phase...");
    try {
      await updateDoc(doc(db, "sessions", sessionId), { status: "picking" });
      console.log("Session status updated to 'picking'");
    } catch (error) {
      console.error("Failed to start picking:", error);
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
    }
  };

  const showResults = async () => {
    if (!sessionId) return;
    await updateDoc(doc(db, "sessions", sessionId), { status: "results" });
  };

  const handleShare = async () => {
    if (!session?.winner || isSharingRef.current) return;
    
    const shareText = `🍿 We're watching ${session.winner.title} tonight! ${session.winner.matchScore}% group match on WatchWith. Pick your next movie night too 👉 ${window.location.origin}`;
    
    // @ts-ignore
    if (typeof window.gtag === 'function') {
      // @ts-ignore
      window.gtag('event', 'share_clicked');
    }

    if (navigator.share) {
      isSharingRef.current = true;
      try {
        await navigator.share({
          title: session.winner.title,
          text: shareText,
          url: window.location.origin,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          // Fallback to clipboard if permission denied (common in iframes)
          copyToClipboard(shareText);
        } else if (err instanceof Error && err.name !== 'AbortError') {
          console.error("Error sharing:", err);
          copyToClipboard(shareText);
        }
      } finally {
        isSharingRef.current = false;
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = (text: string, message: string = "Copied!") => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopyMessage(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      }).catch(err => {
        console.error("Failed to copy:", err);
        fallbackCopyToClipboard(text, message);
      });
    } else {
      fallbackCopyToClipboard(text, message);
    }
  };

  const fallbackCopyToClipboard = (text: string, message: string = "Copied!") => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setCopyMessage(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
  };

  const handleChallengeShare = async () => {
    if (!session?.winner) return;
    const shareText = `🏆 Our group scored ${session.winner.matchScore}% movie compatibility on WatchWith. Think your squad can beat that? Try it: ${window.location.origin}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'WatchWith Challenge',
          text: shareText,
          url: window.location.origin,
        });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          copyToClipboard(shareText, "Challenge copied! Send it to your squad.");
        }
      }
    } else {
      copyToClipboard(shareText, "Challenge copied! Send it to your squad.");
    }
  };

  const handleInstagramShare = () => {
    if (!session?.winner) return;
    const caption = `🍿 Tonight we're watching ${session.winner.title} — ${session.winner.matchScore}% group match on @watchwith_app! Stop arguing about what to watch 👉 ${window.location.origin} #WatchWith #MovieNight #GroupMovieNight`;
    copyToClipboard(caption, "Caption copied! 📋 Pro tip: Add a Link Sticker in your Instagram story with your WatchWith link for instant taps.");
  };

  const handleTwitterShare = () => {
    if (!session?.winner) return;
    const text = `🍿 My squad scored ${session.winner.matchScore}% movie compatibility on WatchWith. We're watching ${session.winner.title} tonight. What's your squad's score? 👉 ${window.location.origin} #WatchWith`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleWhatsAppShare = () => {
    if (!session?.winner) return;
    const text = `🍿 We just picked our movie night! Watching ${session.winner.title} — ${session.winner.matchScore}% group match. Try it with your group: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyShare = () => {
    if (!session?.winner) return;
    const text = `🍿 Tonight's pick: ${session.winner.title} ⭐ ${session.winner.rating}/10 on TMDB 🎯 ${session.winner.matchScore}% group match 🎬 Pick yours: ${window.location.origin}`;
    copyToClipboard(text, "Copied! Paste anywhere.");
  };

  const handleSocialShareInvite = (platform: string) => {
    const url = getShareUrl();
    const text = "Help me pick what we watch tonight on WatchWith!";
    const encodedText = encodeURIComponent(text + " " + url);
    
    let shareUrl = "";
    if (platform === 'whatsapp') shareUrl = `https://wa.me/?text=${encodedText}`;
    else if (platform === 'twitter') shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    else if (platform === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    
    if (shareUrl) window.open(shareUrl, '_blank');
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-black"><Loader2 className="animate-spin text-orange-500" /></div>;

  if (!session) return <div className="p-8 text-center bg-black h-screen flex items-center justify-center">Movie night not found.</div>;

  if (drumroll) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 0.2, 
            repeat: Infinity,
            ease: "linear"
          }}
          className="w-32 h-32 bg-orange-500 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(249,115,22,0.5)]"
        >
          <Music className="w-16 h-16 text-black" />
        </motion.div>
        <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-4 animate-pulse">Drumroll Please...</h2>
        <p className="text-zinc-500 font-mono uppercase tracking-widest">Calculating the ultimate group pick</p>
      </div>
    );
  }

  if (!myPrefs && !joining) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="max-w-md w-full bg-zinc-900 p-10 rounded-[2.5rem] border border-zinc-800 shadow-2xl shadow-black"
        >
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mb-6 rotate-3">
            <Film className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">You're Invited!</h2>
          <p className="text-zinc-400 mb-8 text-lg">
            <span className="text-white font-bold">{session.creatorName}</span> invited you to a movie night. Enter your name to join the group.
          </p>
          <form onSubmit={joinSession} className="space-y-4">
            <input
              type="text"
              placeholder="What's your name?"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              required
            />
            <button 
              type="submit" 
              disabled={joining || !guestName.trim()}
              className="w-full bg-white text-black font-black py-4 rounded-2xl text-lg uppercase tracking-tight hover:bg-orange-500 transition-colors disabled:opacity-50"
            >
              {joining ? "Joining..." : "Join Movie Night"}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      {/* Cinematic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {randomBackdrop && (
          <img
            src={`https://image.tmdb.org/t/p/original${randomBackdrop}`}
            alt="Background"
            className="w-full h-full object-cover opacity-30 grayscale-[0.3]"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-6 pb-24">
      <header className="relative flex items-center justify-between mb-12 z-10">
        <Link to="/" className="group hover:opacity-80 transition-opacity relative">
          {/* Ambient Glow behind logo */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(216,90,48,0.15)_0%,transparent_60%)] scale-[2.5] blur-xl pointer-events-none" />
          
          <h1 className="relative text-sm font-mono uppercase tracking-widest text-zinc-500 mb-1">Room code: {sessionId}</h1>
          <h2 className="relative text-3xl font-black italic uppercase tracking-tighter text-shadow-premium">WatchWith</h2>
        </Link>
        <button 
          onClick={handleShareInvite}
          className={cn(
            "p-3 rounded-2xl border transition-all",
            copied 
              ? "bg-green-500/20 border-green-500 text-green-500" 
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          )}
        >
          {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
        </button>
      </header>

      {session.status === "waiting" && (
        <div className="space-y-12">
          {session.expectedParticipants !== 1 && (
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Share2 className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-2">Invite your friends</h3>
                <p className="text-zinc-400 mb-6">Copy this link and send it to the people you want to watch with.</p>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-2 bg-black rounded-[2rem] border border-zinc-800">
                  <div className="flex-1 px-6 py-4 sm:py-0 text-zinc-500 font-mono text-sm truncate bg-zinc-950/50 rounded-xl sm:bg-transparent">
                    {getShareUrl()}
                  </div>
                  <div className="flex gap-2 p-1 sm:p-0">
                    <button 
                      onClick={copyLink}
                      className={cn(
                        "flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                        copied ? "bg-green-500 text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      )}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4 rotate-[-90deg]" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button 
                      onClick={handleShareInvite}
                      className="flex-1 sm:flex-none px-6 py-3 bg-white text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-500 transition-all flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-4">
                  <button 
                    onClick={() => handleSocialShareInvite('whatsapp')}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-full text-zinc-400 hover:text-green-500 hover:border-green-500/50 transition-all text-xs font-bold uppercase tracking-widest"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </button>
                  <button 
                    onClick={() => handleSocialShareInvite('twitter')}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-full text-zinc-400 hover:text-blue-400 hover:border-blue-400/50 transition-all text-xs font-bold uppercase tracking-widest"
                  >
                    <Twitter className="w-4 h-4" /> Twitter
                  </button>
                  <button 
                    onClick={() => handleSocialShareInvite('facebook')}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-full text-zinc-400 hover:text-blue-600 hover:border-blue-600/50 transition-all text-xs font-bold uppercase tracking-widest"
                  >
                    <Facebook className="w-4 h-4" /> Facebook
                  </button>
                </div>
                <p className="mt-4 text-[10px] text-zinc-600 font-mono uppercase tracking-widest text-center">
                  Tip: If friends can't open the link, use the "Share" button in the top right of AI Studio.
                </p>
              </div>
            </div>
          )}

          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Users className="text-orange-500" /> 
                {session.expectedParticipants === 1 ? "Solo movie night" : "Who's here?"}
                <span className="ml-2 px-2 py-0.5 bg-zinc-800 text-zinc-500 text-xs rounded-full">
                  {preferences.length}
                </span>
              </h3>
              {session?.expectedParticipants > 1 ? (
                <div className="text-right">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">
                    {preferences.length} of {session.expectedParticipants} have joined
                  </p>
                  <div className="w-32 h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((preferences.length / session.expectedParticipants) * 100, 100)}%` }}
                      className="h-full bg-orange-500"
                    />
                  </div>
                </div>
              ) : session?.expectedParticipants === 1 && (
                <div className="text-right">
                  <p className="text-[10px] font-mono text-orange-500 uppercase tracking-widest mb-1">
                    Solo movie night
                  </p>
                  <div className="w-32 h-1 bg-orange-500 rounded-full" />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <AnimatePresence>
                {preferences.map((p) => (
                  <motion.div 
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 flex items-center gap-4 group hover:border-orange-500/50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center font-black text-lg">
                      {p.userName[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{p.userName}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                        {p.id === "creator" ? "Host" : "Friend"}
                      </p>
                    </div>
                    {p.submitted && (
                      <div className="w-6 h-6 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          {userId === "creator" ? (
            <div className="pt-8 border-t border-zinc-900">
              <button 
                onClick={startPicking} 
                disabled={session.expectedParticipants === 1 ? preferences.length < 1 : preferences.length < 2}
                className={cn(
                  "w-full font-black py-5 rounded-2xl text-xl uppercase tracking-tight flex items-center justify-center gap-3 transition-all",
                  (session.expectedParticipants === 1 ? preferences.length >= 1 : preferences.length >= 2)
                    ? "bg-white text-black hover:bg-orange-500" 
                    : "bg-zinc-900 text-zinc-600 cursor-not-allowed opacity-50"
                )}
              >
                Find our movie <ChevronRight className="w-6 h-6" />
              </button>
              {session.expectedParticipants === 1 ? (
                <p className="text-center text-zinc-600 text-[10px] font-mono uppercase tracking-widest mt-4">
                  Ready to start solo!
                </p>
              ) : preferences.length < 2 ? (
                <p className="text-center text-zinc-600 text-[10px] font-mono uppercase tracking-widest mt-4">
                  Waiting for at least one friend to join...
                </p>
              ) : session?.expectedParticipants > preferences.length ? (
                <p className="text-center text-orange-500/60 text-[10px] font-mono uppercase tracking-widest mt-4 animate-pulse">
                  Still waiting for {session.expectedParticipants - preferences.length} more — start now or wait for everyone?
                </p>
              ) : (
                <p className="text-center text-zinc-600 text-[10px] font-mono uppercase tracking-widest mt-4">
                  Ready to start!
                </p>
              )}
            </div>
          ) : (
            <div className="pt-8 border-t border-zinc-900 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800 text-zinc-500 text-xs font-mono uppercase tracking-widest animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Waiting for host to start...
              </div>
            </div>
          )}
        </div>
      )}

      {session.status === "picking" && (
        <div className="space-y-12">
          <section>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Tv className="text-orange-500" /> Streaming Services
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SERVICES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleService(s.id)}
                  disabled={myPrefs.submitted}
                  className={cn(
                    "px-4 py-4 rounded-2xl border transition-all font-bold text-sm text-center flex items-center justify-center min-h-[4rem]",
                    myPrefs.services.includes(s.id) 
                      ? "bg-orange-500 border-orange-500 text-black shadow-lg shadow-orange-500/20" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Film className="text-orange-500" /> Favorite Genres
              </h3>
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                {myPrefs.genres.length}/5 Picked
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.id)}
                  disabled={myPrefs.submitted}
                  className={cn(
                    "px-3 py-4 rounded-2xl border transition-all text-xs font-bold uppercase tracking-tight",
                    myPrefs.genres.includes(g.id) 
                      ? "bg-white border-white text-black shadow-lg shadow-white/10" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </section>

          {!myPrefs.submitted ? (
            <div className="space-y-4">
              <button 
                onClick={submitPrefs} 
                disabled={myPrefs.genres.length === 0}
                className="w-full bg-orange-500 text-black font-black py-5 rounded-2xl text-xl uppercase tracking-tight hover:bg-white transition-all disabled:opacity-30 disabled:grayscale"
              >
                I'm ready
              </button>
              {myPrefs.genres.length === 0 && (
                <p className="text-center text-zinc-600 text-[10px] font-mono uppercase tracking-widest">
                  Pick at least one genre to continue
                </p>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl text-center">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="text-black" />
              </div>
              <h3 className="text-xl font-bold mb-2">
                {preferences.every(p => p.submitted) ? "Everyone is Ready!" : "Preferences Submitted!"}
              </h3>
              
                  {session?.expectedParticipants > 1 ? (
                    <div className="max-w-xs mx-auto mb-6">
                      <div className="flex justify-between items-end mb-2">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                          {preferences.filter(p => p.submitted).length} of {preferences.length} have voted
                        </p>
                        <p className="text-xs font-bold text-orange-500">
                          {Math.round(Math.min((preferences.filter(p => p.submitted).length / preferences.length) * 100, 100))}%
                        </p>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((preferences.filter(p => p.submitted).length / preferences.length) * 100, 100)}%` }}
                          className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                        />
                      </div>
                    </div>
                  ) : session?.expectedParticipants === 1 && (
                    <div className="max-w-xs mx-auto mb-6">
                      <p className="text-[10px] font-mono text-orange-500 uppercase tracking-widest mb-2">
                        Solo movie night
                      </p>
                      <div className="w-full h-1.5 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                    </div>
                  )}

              <p className="text-zinc-400">
                {preferences.every(p => p.submitted) ? "Host can now find the movie." : "Waiting for others to finish..."}
              </p>
              
              <div className="mt-8 flex justify-center gap-2">
                {preferences.map(p => (
                  <div key={p.id} className={cn("w-3 h-3 rounded-full", p.submitted ? "bg-green-500" : "bg-zinc-700")} />
                ))}
              </div>

              {userId === "creator" && (
                <div className="mt-8 flex flex-col items-center gap-4">
                  {(() => {
                    const votedCount = preferences.filter(p => p.submitted).length;
                    const totalJoined = preferences.length;
                    const isSolo = session.expectedParticipants === 1;

                    let message = "";
                    let buttonStyle = "";
                    let isDisabled = true;

                    if (votedCount === 0) {
                      message = "Pick your preferences first";
                      buttonStyle = "bg-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed";
                      isDisabled = true;
                    } else if (isSolo || totalJoined === 1) {
                      message = "Solo movie night — let's go!";
                      buttonStyle = "bg-orange-500 text-black hover:bg-white scale-110 shadow-[0_0_30px_rgba(249,115,22,0.3)]";
                      isDisabled = false;
                    } else if (votedCount === totalJoined) {
                      message = "Everyone's ready! 🍿";
                      buttonStyle = "bg-green-500 text-black hover:bg-white scale-110 shadow-[0_0_30px_rgba(34,197,94,0.3)]";
                      isDisabled = false;
                    } else {
                      message = `${votedCount} of ${totalJoined} have voted. Start now or wait for everyone?`;
                      buttonStyle = "bg-orange-500 text-black hover:bg-white scale-110 shadow-[0_0_30px_rgba(249,115,22,0.3)]";
                      isDisabled = false;
                    }

                    return (
                      <>
                        <div className="flex flex-col items-center gap-2 mb-2">
                          <p className={cn(
                            "font-mono text-[10px] uppercase tracking-widest text-center",
                            votedCount === totalJoined ? "text-green-500" : (votedCount > 0 ? "text-orange-500" : "text-zinc-500")
                          )}>
                            {message}
                          </p>
                        </div>
                        <button 
                          onClick={showResults} 
                          disabled={isDisabled}
                          className={cn(
                            "px-12 py-4 font-black rounded-2xl uppercase tracking-tight transition-all",
                            buttonStyle
                          )}
                        >
                          Find our movie
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {session.status === "results" && (
        <div className="space-y-12">
          <div className="text-center space-y-4">
            <h3 className="text-4xl font-black italic uppercase tracking-tighter text-shadow-premium">
              {session.expectedParticipants === 1 ? "Top Picks for You" : "Top Picks for Your Group"}
            </h3>
            <p className="text-zinc-500 font-mono text-xs uppercase tracking-[0.2em]">
              {session.expectedParticipants === 1 ? "Based on your preferences and streaming services" : "Based on your collective preferences and streaming services"}
            </p>
          </div>

          {fetchingMovies || !session.movies ? (
            <div className="flex flex-col items-center justify-center py-20 gap-6 bg-zinc-900/50 rounded-[3rem] border border-zinc-800/50">
              <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-orange-500" />
                <Film className="w-6 h-6 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg mb-1">{session.expectedParticipants === 1 ? "Analyzing your vibes..." : "Analyzing group vibes..."}</p>
                <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">{session.expectedParticipants === 1 ? "Fetching the best movies for you" : "Fetching the best movies for the group"}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {session.movies.map((movie: any) => (
                  <motion.div
                    key={movie.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative bg-zinc-950 rounded-[2.5rem] overflow-hidden border border-zinc-800 group hover:border-orange-500/30 transition-all shadow-2xl"
                  >
                    {/* Cinematic Card Background */}
                    <div className="absolute inset-0 z-0">
                      <img 
                        src={`https://image.tmdb.org/t/p/w780${movie.backdrop_path || movie.poster_path}`} 
                        alt=""
                        className="w-full h-full object-cover opacity-40 grayscale-[0.2]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent" />
                    </div>

                    <div className="relative z-10">
                      <div className="aspect-[2/3] relative overflow-hidden">
                        <img 
                          src={movie.poster} 
                          alt={movie.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />
                        <div className="absolute bottom-6 left-6 right-6">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-orange-500 text-black text-[10px] font-black rounded uppercase">
                              {movie.matchScore}% Match
                            </span>
                            <div className="flex items-center gap-1 text-orange-500">
                              <Star className="w-3 h-3 fill-current" />
                              <span className="text-[10px] font-bold">{movie.rating}</span>
                            </div>
                          </div>
                          <h4 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-shadow-premium">{movie.title}</h4>
                          <div className="flex flex-row gap-[6px] mt-2">
                            {movie.genre_ids?.slice(0, 3).map((id: number) => {
                              const genre = GENRES.find(g => g.id === id);
                              if (!genre) return null;
                              return (
                                <span key={id} className="bg-[rgba(255,255,255,0.15)] rounded-md text-white text-[11px] px-[10px] py-[4px] font-medium">
                                  {genre.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="p-8 space-y-6">
                        <div className="space-y-3">
                          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Available On</p>
                          <div className="flex flex-wrap gap-2">
                            {movie.availableOn && movie.availableOn.length > 0 ? (
                              movie.availableOn.slice(0, 3).map((s: string) => (
                                <span key={s} className="bg-zinc-800/80 backdrop-blur-sm px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-300 border border-zinc-700">
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">Check TMDB for availability</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {userId === "creator" && (
                <div className="flex flex-col items-center gap-6 pt-12 border-t border-zinc-900">
                  <div className="text-center">
                    <h4 className="text-xl font-bold mb-2">Ready to decide?</h4>
                    <p className="text-zinc-500 text-sm">Start the voting round to pick the final movie.</p>
                  </div>
                  <button 
                    onClick={startVoting}
                    className="w-full md:w-auto min-h-[48px] bg-white text-black px-8 py-4 rounded-2xl font-black uppercase tracking-tight hover:bg-orange-500 transition-all md:scale-110 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                  >
                    Start Voting Round
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(session.status === "voting" || session.status === "winner") && (
        <div className="space-y-8">
          <div className="text-center space-y-4 mb-12">
            <h3 className="text-4xl font-black italic uppercase tracking-tighter text-shadow-premium">
              {session.status === "winner" 
                ? (session.expectedParticipants === 1 ? "Your Winner!" : "We Have a Winner!") 
                : (session.expectedParticipants === 1 ? "Top Picks for You" : "Top Picks for Your Group")}
            </h3>
            {session.status === "voting" && (
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-[0.2em]">
                {session.expectedParticipants === 1 ? "Vote for the movie you want to watch tonight" : "Vote for the movie you want to watch tonight"}
              </p>
            )}
          </div>
          
          {session.status === "voting" && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 px-8 py-4 rounded-[2rem] flex items-center gap-4 shadow-xl">
                <div className="flex -space-x-2">
                  {votes.filter(v => v.movieId).slice(0, 5).map((v, i) => (
                    <div key={v.userId} className="w-8 h-8 rounded-full bg-orange-500 border-2 border-black flex items-center justify-center text-[10px] font-black">
                      {i + 1}
                    </div>
                  ))}
                </div>
                <span className="font-bold text-sm tracking-tight">
                  {session.expectedParticipants === 1 
                    ? (votes.filter(v => v.movieId).length > 0 ? "You've voted!" : "Waiting for your vote...")
                    : `${votes.filter(v => v.movieId).length} of ${preferences.length} have voted`}
                </span>
              </div>
              {userId === "creator" && (
                <button 
                  onClick={calculateWinner}
                  disabled={calculating || votes.filter(v => v.movieId).length < preferences.length}
                  className="w-full md:w-auto min-h-[48px] group relative bg-white text-black px-8 py-4 rounded-[2rem] font-black uppercase tracking-tighter hover:bg-orange-500 transition-all disabled:opacity-50 disabled:grayscale overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {calculating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
                    {calculating ? "Processing..." : "End Voting & Reveal Winner"}
                  </span>
                </button>
              )}
            </div>
          )}

          {session.status === "winner" && session.winner && (
            <div className="space-y-6 mb-12">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto bg-orange-500 text-black p-1 rounded-[3rem] shadow-[0_0_50px_rgba(249,115,22,0.4)]"
              >
                <div className="bg-zinc-950 rounded-[2.8rem] overflow-hidden p-6 md:p-8 flex flex-col md:flex-row gap-8">
                  <div className="w-full md:w-48 aspect-[2/3] rounded-2xl overflow-hidden flex-shrink-0">
                    <img src={session.winner.poster} alt={session.winner.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-grow text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-orange-500 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase">Winner</span>
                      <span className="text-zinc-400 font-mono text-xs">{session.winner.year}</span>
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter mb-2">{session.winner.title}</h2>
                    <div className="flex flex-row gap-[6px] mb-4">
                      {session.winner.genre_ids?.slice(0, 3).map((id: number) => {
                        const genre = GENRES.find(g => g.id === id);
                        if (!genre) return null;
                        return (
                          <span key={id} className="bg-[rgba(255,255,255,0.15)] rounded-md text-white text-[11px] px-[10px] py-[4px] font-medium">
                            {genre.name}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-zinc-400 text-sm mb-6 line-clamp-4">{session.winner.overview}</p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {session.winner.availableOn && session.winner.availableOn.length > 0 ? (
                        session.winner.availableOn.map((s: string) => (
                          <span key={s} className="bg-zinc-800 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-zinc-300 border border-zinc-700">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">Check TMDB for availability</span>
                      )}
                    </div>
                    <a 
                      href={`https://www.themoviedb.org/movie/${session.winner.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-tight hover:bg-orange-500 transition-colors flex items-center justify-center gap-2"
                    >
                      Where to watch <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </motion.div>
              
              <div className="space-y-8 max-w-2xl mx-auto">
                {/* Section 1: Main Share */}
                <div className="flex justify-center">
                  <button 
                    onClick={handleShare}
                    className="flex items-center gap-2 px-12 py-5 bg-white text-black rounded-[2rem] font-black uppercase tracking-tight hover:bg-orange-500 transition-all shadow-[0_20px_40px_rgba(0,0,0,0.3)] group"
                  >
                    <Share2 className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    Share tonight's pick 🍿
                  </button>
                </div>

                {/* Section 2: Challenge Card */}
                <div className="bg-zinc-900 border-2 border-orange-500/30 rounded-[2.5rem] p-8 text-center space-y-4 shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trophy className="w-8 h-8 text-orange-500" />
                    </div>
                    <h4 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                      Your group scored {session.winner.matchScore}% compatibility
                    </h4>
                    <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
                      Challenge another group to beat it!
                    </p>
                    <button 
                      onClick={handleChallengeShare}
                      className="mt-6 px-8 py-3 bg-orange-500 text-black rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white transition-all flex items-center gap-2 mx-auto"
                    >
                      Send challenge 🏆
                    </button>
                  </div>
                </div>

                {/* Section 3: Post your pick */}
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-zinc-800" />
                    <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] whitespace-nowrap">Post your pick 📱</h4>
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <button 
                      onClick={handleInstagramShare}
                      className="flex flex-col items-center gap-3 p-6 bg-zinc-900 rounded-3xl border border-zinc-800 hover:border-pink-500/50 hover:bg-pink-500/5 transition-all group"
                    >
                      <Instagram className="w-6 h-6 text-zinc-500 group-hover:text-pink-500 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white">Instagram</span>
                    </button>
                    
                    <button 
                      onClick={handleTwitterShare}
                      className="flex flex-col items-center gap-3 p-6 bg-zinc-900 rounded-3xl border border-zinc-800 hover:border-blue-400/50 hover:bg-blue-400/5 transition-all group"
                    >
                      <Twitter className="w-6 h-6 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white">Twitter</span>
                    </button>
                    
                    <button 
                      onClick={handleWhatsAppShare}
                      className="flex flex-col items-center gap-3 p-6 bg-zinc-900 rounded-3xl border border-zinc-800 hover:border-green-500/50 hover:bg-green-500/5 transition-all group"
                    >
                      <MessageCircle className="w-6 h-6 text-zinc-500 group-hover:text-green-500 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white">WhatsApp</span>
                    </button>
                    
                    <button 
                      onClick={handleCopyShare}
                      className="flex flex-col items-center gap-3 p-6 bg-zinc-900 rounded-3xl border border-zinc-800 hover:border-white/50 hover:bg-white/5 transition-all group"
                    >
                      <Copy className="w-6 h-6 text-zinc-500 group-hover:text-white transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white">Copy</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(session.movies || []).map((movie: any) => {
              const movieVotes = votes.filter(v => v.movieId === movie.id).length;
              const isMyVote = votes.find(v => v.userId === userId)?.movieId === movie.id;
              
              return (
                <motion.div
                  key={movie.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "relative bg-zinc-950 rounded-3xl overflow-hidden border transition-all group shadow-2xl",
                    isMyVote ? "border-orange-500 ring-1 ring-orange-500" : "border-zinc-800"
                  )}
                >
                  {/* Cinematic Card Background */}
                  <div className="absolute inset-0 z-0">
                    <img 
                      src={`https://image.tmdb.org/t/p/w780${movie.backdrop_path || movie.poster_path}`} 
                      alt=""
                      className="w-full h-full object-cover opacity-30 grayscale-[0.2]"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent" />
                  </div>

                  <div className="relative z-10">
                    <div className="aspect-[2/3] relative overflow-hidden">
                      <img 
                        src={movie.poster} 
                        alt={movie.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60" />
                      
                      {session.status === "voting" && (
                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                          <Users className="w-3 h-3 text-orange-500" />
                          <span className="text-xs font-bold">{movieVotes}</span>
                        </div>
                      )}

                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-orange-500 text-black text-[10px] font-bold rounded uppercase">
                            {movie.matchScore}% Match
                          </span>
                          <span className="text-[10px] font-mono text-zinc-300 uppercase">
                            {movie.year}
                          </span>
                        </div>
                        <h4 className="text-xl font-bold leading-tight text-shadow-premium">{movie.title}</h4>
                        <div className="flex flex-row gap-[6px] mt-2">
                          {movie.genre_ids?.slice(0, 3).map((id: number) => {
                            const genre = GENRES.find(g => g.id === id);
                            if (!genre) return null;
                            return (
                              <span key={id} className="bg-[rgba(255,255,255,0.15)] rounded-md text-white text-[11px] px-[10px] py-[4px] font-medium">
                                {genre.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="mb-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Available On</p>
                        <div className="flex flex-wrap gap-1">
                          {movie.availableOn && movie.availableOn.length > 0 && (
                            movie.availableOn.slice(0, 3).map((s: string) => (
                              <span key={s} className="text-[8px] font-bold bg-zinc-800/50 border border-zinc-700 px-2 py-0.5 rounded text-zinc-300">
                                {s}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {session.status === "voting" && (
                        <button 
                          onClick={() => voteForMovie(movie.id)}
                          className={cn(
                            "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                            isMyVote 
                              ? "bg-orange-500 text-black" 
                              : "bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
                          )}
                        >
                          {isMyVote ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                          {isMyVote ? "Voted" : "Vote"}
                        </button>
                      )}

                      {(session.status === "results" || session.status === "winner") && (
                        <a 
                          href={`https://www.themoviedb.org/movie/${movie.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                        >
                          Where to watch <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {session.status === "results" && (
            <div className="flex justify-center mt-12 px-4 md:px-0">
              <button
                onClick={fetchRecommendations}
                disabled={fetchingMovies}
                className="w-full md:w-auto min-h-[48px] group flex items-center justify-center gap-3 px-10 py-4 bg-zinc-900 border border-zinc-800 rounded-[2rem] text-zinc-400 hover:text-white hover:border-orange-500/50 transition-all font-black uppercase tracking-tighter text-sm overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                {fetchingMovies ? (
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                ) : (
                  <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500 text-orange-500" />
                )}
                <span className="relative z-10">
                  {fetchingMovies ? "Refreshing..." : "Shuffle picks"}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-orange-500 text-black px-6 py-4 rounded-2xl font-bold shadow-[0_20px_40px_rgba(249,115,22,0.3)] flex items-center gap-3 w-[90%] max-w-md"
          >
            <div className="flex-shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <p className="text-sm leading-tight">
              {copyMessage}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFeedbackToast && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFeedbackToast(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <button
                onClick={() => setShowFeedbackToast(false)}
                className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              {!feedbackSubmitted ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <h4 className="text-xl font-black italic uppercase tracking-tighter text-white">
                      🍿 How was your experience?
                    </h4>
                  </div>
                  
                  <div className="flex gap-3 justify-center py-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleStarTap(star)}
                        className="transition-transform hover:scale-125 active:scale-95"
                      >
                        <Star 
                          className={cn(
                            "w-10 h-10 transition-all duration-300",
                            star <= feedbackRating 
                              ? "fill-orange-500 text-orange-500 filter drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" 
                              : "text-zinc-800 hover:text-zinc-600"
                          )} 
                        />
                      </button>
                    ))}
                  </div>

                  {feedbackRating > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-4 overflow-hidden"
                    >
                      <textarea
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="Any thoughts? (optional)"
                        className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-white placeholder:text-zinc-600 resize-none"
                        rows={2}
                      />
                      <button
                        onClick={submitFeedback}
                        disabled={isSubmittingFeedback}
                        className="w-full bg-white text-black font-black py-4 rounded-2xl uppercase tracking-tight hover:bg-orange-500 transition-all disabled:opacity-50 shadow-xl"
                      >
                        {isSubmittingFeedback ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Submit"}
                      </button>
                    </motion.div>
                  )}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <p className="text-white font-black italic uppercase tracking-tighter text-2xl">
                    Thanks! Enjoy movie night 🎬
                  </p>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
}
