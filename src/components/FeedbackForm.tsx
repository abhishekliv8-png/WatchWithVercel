import React, { useState } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Star, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface FeedbackFormProps {
  sessionId?: string;
  userName?: string;
  onSuccess?: () => void;
  className?: string;
}

export default function FeedbackForm({ sessionId, userName, onSuccess, className }: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    if (!comment.trim()) {
      setError("Please share your thoughts with us.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, "feedback"), {
        sessionId: sessionId || null,
        rating,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
        userName: userName || "Anonymous",
      });
      setSubmitted(true);
      // @ts-ignore
      if (typeof window.gtag === 'function') {
        // @ts-ignore
        window.gtag('event', 'feedback_submitted');
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      setError("Something went wrong. Please try again.");
      handleFirestoreError(err, OperationType.WRITE, "feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("text-center p-8 bg-zinc-900/50 border border-zinc-800 rounded-[2rem]", className)}
      >
        <p className="text-xl font-bold italic text-white flex items-center justify-center gap-2">
          🎬 Thanks for the feedback! Enjoy your movie night.
        </p>
      </motion.div>
    );
  }

  return (
    <div className={cn("bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2rem] shadow-xl", className)}>
      <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-6 flex items-center gap-2">
        How was your experience? 🍿
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110 focus:outline-none"
            >
              <Star
                className={cn(
                  "w-8 h-8 transition-colors",
                  (hoveredRating || rating) >= star
                    ? "fill-orange-500 text-orange-500"
                    : "text-zinc-700"
                )}
              />
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what you loved or what we can improve..."
            rows={3}
            className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all placeholder:text-zinc-600 text-white resize-none"
          />
        </div>

        {error && (
          <p className="text-red-500 text-xs font-bold text-center animate-pulse">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-white text-black font-black uppercase tracking-tight py-4 rounded-2xl hover:bg-orange-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Submit feedback"
          )}
        </button>
      </form>
    </div>
  );
}
