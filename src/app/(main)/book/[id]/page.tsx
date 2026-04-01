"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ArrowLeft,
  Users,
  Eye,
  PenLine,
  Star,
  Calendar,
  Hash,
  Layers,
  Check,
  X,
  Trash2,
  BookMarked,
} from "lucide-react";
import StarRating from "@/components/StarRating";

interface BookDetail {
  id: string;
  title: string;
  authors: string[];
  description?: string;
  coverUrl?: string;
  isbn?: string;
  pageCount?: number;
  publishedDate?: string;
  categories: string[];
  spineColor: string;
  averageRating: number | null;
  owners: Array<{
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarColor: string;
  }>;
  readers: Array<{
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarColor: string;
  }>;
  annotators: Array<{
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarColor: string;
  }>;
  currentlyReading: Array<{
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarColor: string;
  }>;
  ratings: Array<{
    userId: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarColor: string;
    rating: number;
    review?: string;
    updatedAt: string;
  }>;
  currentUserBook: {
    owned: boolean;
    read: boolean;
    currentlyReading: boolean;
    annotated: boolean;
    rating: number | null;
    review: string | null;
  } | null;
}

export default function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchBook();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchBook() {
    try {
      const res = await fetch(`/api/books/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBook(data);
        if (data.currentUserBook) {
          setReviewText(data.currentUserBook.review || "");
          setReviewRating(data.currentUserBook.rating);
        }
      }
    } catch (error) {
      console.error("Failed to fetch book:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(field: "owned" | "read" | "currentlyReading" | "annotated") {
    if (!book) return;
    const current = book.currentUserBook?.[field] ?? false;

    try {
      await fetch(`/api/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !current }),
      });
      fetchBook();
    } catch (error) {
      console.error("Failed to update:", error);
    }
  }

  async function submitReview() {
    setSaving(true);
    try {
      await fetch(`/api/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: reviewRating, review: reviewText }),
      });
      setShowReviewForm(false);
      fetchBook();
    } catch (error) {
      console.error("Failed to submit review:", error);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBook() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/library");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-center h-[400px]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <BookOpen className="w-8 h-8 text-warm-500" />
          </motion.div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 text-center">
        <p className="text-warm-500">Book not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-warm-700 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const userBook = book.currentUserBook;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-warm-500 hover:text-warm-700 transition-colors mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to library
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Book header */}
        <div className="flex flex-col md:flex-row gap-8 mb-10">
          {/* Cover */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            <motion.div
              initial={{ rotateY: -15 }}
              animate={{ rotateY: 0 }}
              transition={{ duration: 0.6, type: "spring" }}
              className="relative"
              style={{ perspective: 1000 }}
            >
              {book.coverUrl ? (
                <div className="relative w-[200px] h-[300px] rounded-lg overflow-hidden shadow-2xl">
                  <Image
                    src={book.coverUrl}
                    alt={book.title}
                    fill
                    className="object-cover"
                    sizes="200px"
                    priority
                  />
                  {/* Book edge effect */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-r from-black/20 to-transparent" />
                </div>
              ) : (
                <div
                  className="w-[200px] h-[300px] rounded-lg flex items-center justify-center shadow-2xl"
                  style={{ backgroundColor: book.spineColor }}
                >
                  <span className="text-white font-serif text-lg text-center px-4">
                    {book.title}
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-3xl font-bold text-warm-900 mb-2">
              {book.title}
            </h1>
            <p className="text-warm-600 text-lg mb-4">
              by {book.authors.join(", ")}
            </p>

            {/* Rating */}
            {book.averageRating && (
              <div className="flex items-center gap-3 mb-4">
                <StarRating value={book.averageRating} readonly size="md" />
                <span className="text-warm-600 font-medium">
                  {book.averageRating.toFixed(1)}
                </span>
                <span className="text-warm-400 text-sm">
                  ({book.ratings.length}{" "}
                  {book.ratings.length === 1 ? "review" : "reviews"})
                </span>
              </div>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap gap-4 text-sm text-warm-500 mb-6">
              {book.pageCount && (
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  {book.pageCount} pages
                </span>
              )}
              {book.publishedDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {book.publishedDate}
                </span>
              )}
              {book.isbn && (
                <span className="flex items-center gap-1.5">
                  <Hash className="w-4 h-4" />
                  {book.isbn}
                </span>
              )}
            </div>

            {/* Categories */}
            {book.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {book.categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-3 py-1 bg-warm-100 text-warm-600 rounded-full text-xs font-medium"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mb-3">
              <StatusButton
                active={userBook?.owned ?? false}
                icon={<BookOpen className="w-4 h-4" />}
                label="I own this"
                onClick={() => toggleStatus("owned")}
              />
              <StatusButton
                active={userBook?.currentlyReading ?? false}
                icon={<BookMarked className="w-4 h-4" />}
                label="Currently reading"
                onClick={() => toggleStatus("currentlyReading")}
              />
              <StatusButton
                active={userBook?.read ?? false}
                icon={<Eye className="w-4 h-4" />}
                label="I've read this"
                onClick={() => toggleStatus("read")}
              />
              <StatusButton
                active={userBook?.annotated ?? false}
                icon={<PenLine className="w-4 h-4" />}
                label="I've annotated this"
                onClick={() => toggleStatus("annotated")}
              />
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors text-sm font-medium"
              >
                <Star className="w-4 h-4" />
                {userBook?.rating ? "Edit Review" : "Rate & Review"}
              </button>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove from library
            </button>

            {/* Delete confirmation */}
            <AnimatePresence>
              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-4"
                >
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm font-medium mb-1">
                      Remove &quot;{book.title}&quot; from the shared library?
                    </p>
                    <p className="text-red-600 text-xs mb-3">
                      This will remove the book and all associated reviews, ratings, and ownership records for everyone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={deleteBook}
                        disabled={deleting}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deleting ? "Removing..." : "Yes, remove it"}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 text-warm-600 hover:bg-warm-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Review form */}
        <AnimatePresence>
          {showReviewForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="card-warm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-lg font-bold text-warm-900">
                    Your Review
                  </h3>
                  <button
                    onClick={() => setShowReviewForm(false)}
                    className="text-warm-400 hover:text-warm-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-warm-700 mb-2">
                    Rating
                  </label>
                  <StarRating
                    value={reviewRating}
                    onChange={setReviewRating}
                    size="lg"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-warm-700 mb-2">
                    Review (optional)
                  </label>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 placeholder-warm-400 resize-none text-sm"
                    placeholder="What did you think of this book?"
                  />
                </div>

                <button
                  onClick={submitReview}
                  disabled={saving || !reviewRating}
                  className="bg-warm-700 text-cream px-6 py-2.5 rounded-lg font-medium hover:bg-warm-800 transition-colors disabled:opacity-50 text-sm"
                >
                  {saving ? "Saving..." : "Save Review"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Description */}
        {book.description && (
          <div className="card-warm p-6 mb-8">
            <h2 className="font-serif text-lg font-bold text-warm-900 mb-3">
              About this book
            </h2>
            <p className="text-warm-700 text-sm leading-relaxed whitespace-pre-line">
              {book.description.replace(/<[^>]*>/g, "")}
            </p>
          </div>
        )}

        {/* People sections */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <PeopleCard
            title="Owned by"
            icon={<BookOpen className="w-4 h-4" />}
            people={book.owners}
          />
          <PeopleCard
            title="Currently reading"
            icon={<BookMarked className="w-4 h-4" />}
            people={book.currentlyReading}
          />
          <PeopleCard
            title="Read by"
            icon={<Eye className="w-4 h-4" />}
            people={book.readers}
          />
          <PeopleCard
            title="Annotated by"
            icon={<PenLine className="w-4 h-4" />}
            people={book.annotators}
          />
        </div>

        {/* Reviews */}
        {book.ratings.length > 0 && (
          <div className="card-warm p-6">
            <h2 className="font-serif text-lg font-bold text-warm-900 mb-4">
              Reviews
            </h2>
            <div className="space-y-4">
              {book.ratings.map((r) => (
                <div
                  key={r.userId}
                  className="flex gap-4 pb-4 border-b border-warm-100 last:border-0 last:pb-0"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: r.avatarColor }}
                  >
                    {r.firstName[0]}
                    {r.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-warm-900 text-sm">
                        {r.firstName} {r.lastName}
                      </span>
                      <StarRating value={r.rating} readonly size="sm" />
                    </div>
                    {r.review && (
                      <p className="text-warm-600 text-sm leading-relaxed">
                        {r.review}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function StatusButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
        active
          ? "bg-warm-700 text-cream border-warm-700"
          : "bg-warm-50 text-warm-600 border-warm-200 hover:bg-warm-100"
      }`}
    >
      {active ? <Check className="w-4 h-4" /> : icon}
      {label}
    </button>
  );
}

function PeopleCard({
  title,
  icon,
  people,
}: {
  title: string;
  icon: React.ReactNode;
  people: Array<{
    id: string;
    firstName: string;
    lastName: string;
    avatarColor: string;
  }>;
}) {
  return (
    <div className="card-warm p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-warm-500">{icon}</span>
        <h3 className="font-serif font-bold text-warm-900 text-sm">{title}</h3>
        <span className="ml-auto text-warm-400 text-xs">{people.length}</span>
      </div>
      {people.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-cream rounded-full"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: p.avatarColor }}
              >
                {p.firstName[0]}
              </div>
              <span className="text-xs text-warm-700 font-medium">
                {p.firstName}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-warm-400 text-xs italic">No one yet</p>
      )}
    </div>
  );
}
