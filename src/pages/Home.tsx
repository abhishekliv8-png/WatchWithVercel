import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { Film, ArrowRight, Clapperboard, X, ExternalLink, HelpCircle, Users, Sparkles, MessageCircle, ArrowLeft, Share2, Tv, CheckCircle2, Play } from "lucide-react";
import FeedbackForm from "../components/FeedbackForm";

export default function Home() {
  const [name, setName] = useState("");
  const [expectedParticipants, setExpectedParticipants] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [backdrops, setBackdrops] = useState<string[]>([]);
  const [posters, setPosters] = useState<string[]>([]);
  const [currentBackdropIndex, setCurrentBackdropIndex] = useState(0);
  const [showMadeByModal, setShowMadeByModal] = useState(false);
  const [showFeedbackInModal, setShowFeedbackInModal] = useState(false);
  const navigate = useNavigate();
  const howItWorksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showMadeByModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showMadeByModal]);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const response = await fetch("/api/movies/popular");
        const data = await response.json();
        const movies = data.results || [];
        
        // Get 10 backdrops for carousel
        setBackdrops(movies.slice(0, 10).map((m: any) => m.backdrop_path).filter(Boolean));
        
        // Get 8 posters for floating decoration
        setPosters(movies.slice(10, 18).map((m: any) => m.poster_path).filter(Boolean));
      } catch (error) {
        console.error("Failed to fetch background movies:", error);
      }
    };
    fetchMovies();
  }, []);

  useEffect(() => {
    if (backdrops.length === 0) return;
    const interval = setInterval(() => {
      setCurrentBackdropIndex((prev) => (prev + 1) % backdrops.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [backdrops]);

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const sessionId = Math.random().toString(36).substring(2, 10);
    const sessionRef = doc(db, "sessions", sessionId);

    try {
      await setDoc(sessionRef, {
        id: sessionId,
        creatorName: name,
        createdAt: new Date().toISOString(),
        status: "waiting",
        expectedParticipants: expectedParticipants === null ? null : expectedParticipants,
      });

      const prefRef = doc(db, "sessions", sessionId, "preferences", "creator");
      await setDoc(prefRef, {
        userName: name,
        genres: [],
        services: [],
        submitted: false,
      });

      // @ts-ignore
      if (typeof window.gtag === 'function') {
        // @ts-ignore
        window.gtag('event', 'session_created');
      }

      navigate(`/session/${sessionId}?user=creator`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${sessionId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-5 py-6 text-center overflow-hidden">
        {/* Cinematic Backdrop Carousel */}
        <div className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            {backdrops[currentBackdropIndex] && (
              <motion.div
                key={currentBackdropIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5 }}
                className="absolute inset-0"
              >
                <img
                  src={`https://image.tmdb.org/t/p/w1280${backdrops[currentBackdropIndex]}`}
                  alt="Background"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Dark Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/40" />
        </div>

        {/* Floating Movie Posters Decoration */}
        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden md:block hidden">
          {posters.map((path, i) => {
            const positions = [
              { top: "10%", left: "5%" },
              { top: "15%", right: "8%" },
              { bottom: "20%", left: "10%" },
              { bottom: "15%", right: "5%" },
              { top: "40%", left: "2%" },
              { bottom: "45%", right: "3%" },
              { top: "5%", left: "45%" },
              { bottom: "5%", left: "30%" },
            ];
            const pos = positions[i % positions.length];
            const rotation = Math.floor(Math.random() * 30) - 15;
            const delay = i * 0.8;
            const duration = 6 + Math.random() * 2;

            return (
              <div
                key={i}
                className="absolute animate-float opacity-[0.15] blur-[2px]"
                style={{
                  ...pos,
                  "--rotate": `${rotation}deg`,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                } as any}
              >
                <img
                  src={`https://image.tmdb.org/t/p/w154${path}`}
                  alt="Poster"
                  className="w-24 h-auto rounded-lg shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-20 max-w-md w-full px-5 md:px-0"
        >
          <div className="flex items-center justify-center mb-2 gap-3 relative">
            {/* Ambient Glow behind logo */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(216,90,48,0.15)_0%,transparent_60%)] scale-[2.5] blur-xl" />
            
            <div className="relative p-3 bg-orange-500 rounded-2xl rotate-3 shadow-lg shadow-orange-500/20">
              <Film className="w-8 h-8 text-black" />
            </div>
            <h1 className="relative text-4xl font-black tracking-tighter uppercase italic text-shadow-premium">
              WatchWith
            </h1>
          </div>

          <p className="text-zinc-300 mb-12 text-lg leading-relaxed text-shadow-premium font-medium">
            🎬We pick the movie. You make the popcorn.🍿
          </p>

          <form onSubmit={createSession} className="space-y-4">
            <div className="relative group">
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all placeholder:text-zinc-500 text-white"
                required
              />
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-left ml-2">How many friends are joining?</p>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, "5+"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setExpectedParticipants(num === "5+" ? 5 : Number(num))}
                    className={cn(
                      "flex-1 py-3 rounded-xl border font-bold transition-all text-sm",
                      expectedParticipants === (num === "5+" ? 5 : Number(num))
                        ? "bg-orange-500 border-orange-500 text-black shadow-lg shadow-orange-500/20"
                        : "bg-black/40 border-white/10 text-zinc-400 hover:border-white/30"
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full min-h-[48px] bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-orange-500 hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-xl shadow-black/20"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Start movie night
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
            <button
              onClick={scrollToHowItWorks}
              className="w-full sm:flex-1 min-h-[48px] bg-zinc-900/50 backdrop-blur-sm text-white font-bold py-3 px-4 rounded-xl border border-white/10 hover:bg-zinc-800 transition-all text-sm flex items-center justify-center gap-2"
            >
              <HelpCircle className="w-4 h-4" />
              How it works
            </button>
            <button
              onClick={() => setShowMadeByModal(true)}
              className="w-full sm:flex-1 min-h-[48px] bg-transparent text-white font-bold py-3 px-4 rounded-xl border border-white hover:bg-white/10 transition-all text-sm flex items-center justify-center gap-2"
            >
              Made by
            </button>
          </div>

          <div className="mt-16 pt-8 border-t border-white/10 flex items-center justify-center gap-8 opacity-50 grayscale">
            <Clapperboard className="w-6 h-6" />
            <span className="text-xs font-mono uppercase tracking-widest">Powered by TMDB</span>
          </div>
        </motion.div>
      </div>

      {/* How It Works Section */}
      <section ref={howItWorksRef} className="relative z-20 py-24 px-5 md:px-6 bg-zinc-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4">How it works</h2>
            <div className="w-20 h-1 bg-orange-500 mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2rem] hover:border-orange-500/50 transition-all group">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Film className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold mb-4">Step 1: Start a movie night 🎬</h3>
              <p className="text-zinc-400 leading-relaxed">
                Enter your name, pick how many friends are joining (or go solo), and create your room in one tap.
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2rem] hover:border-orange-500/50 transition-all group">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Share2 className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold mb-4">Step 2: Share with your squad 🔗</h3>
              <p className="text-zinc-400 leading-relaxed">
                Share the room link with friends via WhatsApp, text, or any app. They join instantly — no downloads, no signups.
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2rem] hover:border-orange-500/50 transition-all group">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Tv className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold mb-4">Step 3: Everyone picks their vibe 🎭</h3>
              <p className="text-zinc-400 leading-relaxed">
                Each person selects the streaming services they have (Netflix, Hulu, Disney+, etc.) and the genres they are in the mood for tonight.
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2rem] hover:border-orange-500/50 transition-all group">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold mb-4">Step 4: Watch the votes come in 🗳️</h3>
              <p className="text-zinc-400 leading-relaxed">
                See who has voted in realtime. The host can start once everyone is ready, or jump ahead — you are always in control. Track progress live: 3 of 4 friends have voted.
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2rem] hover:border-orange-500/50 transition-all group lg:col-span-1 md:col-span-2 lg:col-start-2">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold mb-4">Step 5: Get your perfect pick 🍿</h3>
              <p className="text-zinc-400 leading-relaxed">
                Our algorithm finds movies available on services your group shares, matched to the genres everyone wants. No more scrolling. No more arguing. Just press play.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Made By Modal */}
      <AnimatePresence>
        {showMadeByModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md overflow-y-auto pt-10 pb-20 px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl mx-auto rounded-[2.5rem] p-8 md:p-12 relative shadow-2xl"
            >
              <button
                onClick={() => setShowMadeByModal(false)}
                className="absolute top-6 right-6 p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-10">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">
                  {showFeedbackInModal ? "We'd Love Your Feedback" : "The Creators"}
                </h2>
                <div className="w-12 h-1 bg-orange-500 mx-auto rounded-full" />
              </div>

              {showFeedbackInModal ? (
                <div className="space-y-6">
                  <button 
                    onClick={() => setShowFeedbackInModal(false)}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Creators
                  </button>
                  <FeedbackForm className="bg-black/40 border-zinc-800" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                    <div className="bg-black/40 border border-zinc-800 p-6 rounded-3xl text-center flex flex-col items-center">
                      <h3 className="text-2xl font-bold mb-1">Abhishek</h3>
                      <p className="text-zinc-500 text-sm mb-6">MBA Candidate at NYU Stern</p>
                      <a
                        href="https://www.linkedin.com/in/abhishek-abh/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                      >
                        LinkedIn <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="bg-black/40 border border-zinc-800 p-6 rounded-3xl text-center flex flex-col items-center">
                      <h3 className="text-2xl font-bold mb-1">Aashi Aditi</h3>
                      <p className="text-zinc-500 text-sm mb-6">MBA Candidate at NYU Stern</p>
                      <a
                        href="https://www.linkedin.com/in/aashi-aditi/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                      >
                        LinkedIn <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-6">
                    <p className="text-center text-zinc-400 italic text-sm">
                      "Built for every group that's spent more time picking a movie than watching one."
                    </p>
                    
                    <button 
                      onClick={() => setShowFeedbackInModal(true)}
                      className="text-orange-500 hover:text-orange-400 transition-colors text-sm font-bold uppercase tracking-widest flex items-center gap-2 py-2 px-4 rounded-full bg-orange-500/10 border border-orange-500/20"
                    >
                      Give feedback <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
