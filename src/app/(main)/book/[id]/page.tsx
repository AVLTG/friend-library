"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ArrowLeft,
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
import { ApiError, apiErrorMessage, apiFetch } from "@/lib/api-client";
import type { BookDetailDto, RelationshipDto } from "@/lib/api-types";

type RelationshipMutation = "status" | "review" | "clear" | "remove";

type Feedback = {
  type: "success" | "error";
  message: string;
};

export default function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const routeIdRef = useRef(id);
  routeIdRef.current = id;
  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef<AbortController | null>(null);
  const relationshipPendingRef = useRef<RelationshipMutation | null>(null);
  const [book, setBook] = useState<BookDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [relationshipPending, setRelationshipPending] =
    useState<RelationshipMutation | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => {
    routeIdRef.current = id;
    setBook(null);
    setLoading(true);
    setNotFound(false);
    setLoadError(null);
    setFeedback(null);
    setShowReviewForm(false);
    setReviewText("");
    setReviewRating(null);
    setShowDeleteConfirm(false);
    setShowRemoveConfirm(false);
    void fetchBook(id, true, true);

    return () => {
      activeRequestRef.current?.abort();
      requestSequenceRef.current += 1;
    };
  }, [id]);

  async function fetchBook(
    requestedId: string,
    initializeDraft = false,
    showLoading = false,
  ) {
    if (routeIdRef.current !== requestedId) return null;

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    const sequence = ++requestSequenceRef.current;
    activeRequestRef.current = controller;
    if (showLoading) setLoading(true);
    setLoadError(null);

    try {
      const data = await apiFetch<BookDetailDto>(`/api/books/${requestedId}`, {
        signal: controller.signal,
      });
      if (
        sequence !== requestSequenceRef.current ||
        routeIdRef.current !== requestedId
      ) {
        return null;
      }

      setBook(data);
      setNotFound(false);
      if (initializeDraft) {
        setReviewText(data.currentUserBook?.review ?? "");
        setReviewRating(data.currentUserBook?.rating ?? null);
      }
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return null;
      }
      if (
        sequence !== requestSequenceRef.current ||
        routeIdRef.current !== requestedId
      ) {
        return null;
      }

      if (error instanceof ApiError && error.status === 404) {
        setBook(null);
        setNotFound(true);
        setLoadError(null);
      } else {
        setLoadError(apiErrorMessage(error, "Unable to load this book"));
      }
      return null;
    } finally {
      if (
        sequence === requestSequenceRef.current &&
        routeIdRef.current === requestedId
      ) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  function beginRelationshipMutation(kind: RelationshipMutation) {
    if (relationshipPendingRef.current || deleting) return false;
    relationshipPendingRef.current = kind;
    setRelationshipPending(kind);
    setFeedback(null);
    return true;
  }

  function finishRelationshipMutation() {
    relationshipPendingRef.current = null;
    setRelationshipPending(null);
  }

  function applyRelationship(
    requestedId: string,
    relationship: RelationshipDto,
  ) {
    if (routeIdRef.current !== requestedId) return;
    setBook((currentBook) =>
      currentBook?.id === requestedId
        ? {
            ...currentBook,
            currentUserBook: relationship,
            permissions: {
              ...currentBook.permissions,
              canRemoveRelationship: true,
            },
          }
        : currentBook,
    );
  }

  function mutationError(error: unknown, fallback: string) {
    const message = apiErrorMessage(error, fallback);
    return error instanceof ApiError && error.status === 404
      ? `${message}. Return to the library and choose another book.`
      : `${message}. Please try again.`;
  }

  async function toggleStatus(
    field: "owned" | "read" | "currentlyReading" | "annotated",
  ) {
    if (!book) return;
    if (!beginRelationshipMutation("status")) return;

    const requestedId = id;
    const current = book.currentUserBook?.[field] ?? false;
    const next = !current;
    const statusLabels = {
      owned: "ownership",
      read: "read status",
      currentlyReading: "reading status",
      annotated: "annotation status",
    } as const;

    try {
      const relationship = await apiFetch<RelationshipDto>(
        `/api/books/${requestedId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: next }),
        },
      );
      if (routeIdRef.current !== requestedId) return;
      applyRelationship(requestedId, relationship);
      setFeedback({
        type: "success",
        message: `${statusLabels[field][0].toUpperCase()}${statusLabels[field].slice(1)} updated.`,
      });
      await fetchBook(requestedId);
    } catch (error) {
      if (routeIdRef.current === requestedId) {
        setFeedback({
          type: "error",
          message: mutationError(error, `Unable to update ${statusLabels[field]}`),
        });
      }
    } finally {
      finishRelationshipMutation();
    }
  }

  async function submitReview() {
    if (reviewText.trim() && reviewRating === null) {
      setFeedback({
        type: "error",
        message: "Choose a rating before saving a written review.",
      });
      return;
    }
    if (reviewRating === null || !beginRelationshipMutation("review")) return;

    const requestedId = id;
    try {
      const relationship = await apiFetch<RelationshipDto>(
        `/api/books/${requestedId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: reviewRating, review: reviewText }),
        },
      );
      if (routeIdRef.current !== requestedId) return;
      applyRelationship(requestedId, relationship);
      setReviewText(relationship.review ?? "");
      setReviewRating(relationship.rating);
      setShowReviewForm(false);
      setFeedback({ type: "success", message: "Rating and review saved." });
      await fetchBook(requestedId);
    } catch (error) {
      if (routeIdRef.current === requestedId) {
        setFeedback({
          type: "error",
          message: mutationError(error, "Unable to save your rating and review"),
        });
      }
    } finally {
      finishRelationshipMutation();
    }
  }

  async function clearReview() {
    if (!beginRelationshipMutation("clear")) return;

    const requestedId = id;
    try {
      const relationship = await apiFetch<RelationshipDto>(
        `/api/books/${requestedId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: null, review: null }),
        },
      );
      if (routeIdRef.current !== requestedId) return;
      applyRelationship(requestedId, relationship);
      setReviewText("");
      setReviewRating(null);
      setFeedback({ type: "success", message: "Rating and review cleared." });
      await fetchBook(requestedId);
    } catch (error) {
      if (routeIdRef.current === requestedId) {
        setFeedback({
          type: "error",
          message: mutationError(error, "Unable to clear your rating and review"),
        });
      }
    } finally {
      finishRelationshipMutation();
    }
  }

  async function deleteBook() {
    if (deleting || relationshipPendingRef.current) return;
    const requestedId = id;
    setDeleting(true);
    setFeedback(null);
    try {
      await apiFetch<{ success: true }>(`/api/books/${requestedId}`, {
        method: "DELETE",
      });
      if (routeIdRef.current === requestedId) {
        setFeedback({
          type: "success",
          message: "Book deleted. Returning to the library...",
        });
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      }
      if (routeIdRef.current === requestedId) {
        router.push("/library");
      } else {
        setDeleting(false);
      }
    } catch (error) {
      if (routeIdRef.current === requestedId) {
        setFeedback({
          type: "error",
          message: mutationError(error, "Unable to delete this book"),
        });
      }
      setDeleting(false);
    }
  }

  async function removeRelationship() {
    if (!beginRelationshipMutation("remove")) return;

    const requestedId = id;
    try {
      await apiFetch<{ success: true }>(
        `/api/books/${requestedId}/relationship`,
        { method: "DELETE" },
      );
      if (routeIdRef.current !== requestedId) return;
      setBook((currentBook) =>
        currentBook?.id === requestedId
          ? {
              ...currentBook,
              currentUserBook: null,
              permissions: {
                ...currentBook.permissions,
                canRemoveRelationship: false,
              },
            }
          : currentBook,
      );
      setShowReviewForm(false);
      setReviewText("");
      setReviewRating(null);
      setFeedback({ type: "success", message: "Your activity was removed." });
      await fetchBook(requestedId);
      if (routeIdRef.current === requestedId) {
        setShowRemoveConfirm(false);
      }
    } catch (error) {
      if (routeIdRef.current === requestedId) {
        setFeedback({
          type: "error",
          message: mutationError(error, "Unable to remove your activity"),
        });
      }
    } finally {
      finishRelationshipMutation();
    }
  }

  if (loading || (book !== null && book.id !== id)) {
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

  if (notFound) {
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

  if (!book) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 text-center">
        <p className="font-medium text-warm-800">Unable to load this book</p>
        <p className="mt-2 text-sm text-warm-500">
          {loadError ?? "BookShare could not complete the request."}
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <button
            onClick={() => void fetchBook(id, true, true)}
            className="text-warm-700 hover:underline"
          >
            Try again
          </button>
          <button
            onClick={() => router.back()}
            className="text-warm-500 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const userBook = book.currentUserBook;
  const relationshipLocked = relationshipPending !== null || deleting;

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

      {loadError && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{loadError}. The displayed details may be out of date.</span>
          <button
            onClick={() => void fetchBook(id)}
            className="font-medium underline hover:text-red-800"
          >
            Retry refresh
          </button>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

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
                disabled={relationshipLocked}
              />
              <StatusButton
                active={userBook?.currentlyReading ?? false}
                icon={<BookMarked className="w-4 h-4" />}
                label="Currently reading"
                onClick={() => toggleStatus("currentlyReading")}
                disabled={relationshipLocked}
              />
              <StatusButton
                active={userBook?.read ?? false}
                icon={<Eye className="w-4 h-4" />}
                label="I've read this"
                onClick={() => toggleStatus("read")}
                disabled={relationshipLocked}
              />
              <StatusButton
                active={userBook?.annotated ?? false}
                icon={<PenLine className="w-4 h-4" />}
                label="I've annotated this"
                onClick={() => toggleStatus("annotated")}
                disabled={relationshipLocked}
              />
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                disabled={relationshipLocked}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Star className="w-4 h-4" />
                {userBook?.rating ? "Edit Review" : "Rate & Review"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {book.permissions.canRemoveRelationship && (
                <button
                  onClick={() => setShowRemoveConfirm(true)}
                  disabled={relationshipLocked}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-warm-500 hover:text-warm-700 hover:bg-warm-100 transition-colors text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Remove my activity
                </button>
              )}
              {book.permissions.canDeleteGlobally && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={relationshipLocked}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete from shared library
                </button>
              )}
            </div>

            <AnimatePresence>
              {showRemoveConfirm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-4"
                >
                  <div className="p-4 bg-warm-50 border border-warm-200 rounded-lg">
                    <p className="text-warm-800 text-sm font-medium mb-1">
                      Remove your activity for &quot;{book.title}&quot;?
                    </p>
                    <p className="text-warm-600 text-xs mb-3">
                      Your statuses, rating, and review will be removed. The book and everyone else&apos;s activity will remain.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={removeRelationship}
                        disabled={relationshipLocked}
                        className="flex items-center gap-2 px-4 py-2 bg-warm-700 text-white rounded-lg text-sm font-medium hover:bg-warm-800 transition-colors disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        {relationshipPending === "remove"
                          ? "Removing..."
                          : "Remove my activity"}
                      </button>
                      <button
                        onClick={() => setShowRemoveConfirm(false)}
                        disabled={relationshipLocked}
                        className="px-4 py-2 text-warm-600 hover:bg-warm-100 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                      Delete &quot;{book.title}&quot; from the shared library?
                    </p>
                    <p className="text-red-600 text-xs mb-3">
                      This will remove the book and all associated reviews, ratings, and ownership records for everyone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={deleteBook}
                        disabled={deleting || relationshipPending !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deleting ? "Deleting..." : "Yes, delete it"}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleting}
                        className="px-4 py-2 text-warm-600 hover:bg-warm-100 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
                    disabled={relationshipLocked}
                    className="text-warm-400 hover:text-warm-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-warm-700 mb-2">
                    Rating
                  </label>
                  <div className={relationshipLocked ? "opacity-50" : undefined}>
                    <StarRating
                      value={reviewRating}
                      onChange={setReviewRating}
                      readonly={relationshipLocked}
                      size="lg"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-warm-700 mb-2">
                    Review (optional)
                  </label>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    disabled={relationshipLocked}
                    rows={4}
                    maxLength={5000}
                    className="w-full px-4 py-3 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 placeholder-warm-400 resize-none text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="What did you think of this book?"
                  />
                </div>

                {reviewText.trim() && reviewRating === null && (
                  <p className="mb-3 text-sm text-red-600" role="alert">
                    Choose a rating before saving a written review.
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={submitReview}
                    disabled={relationshipLocked || reviewRating === null}
                    className="bg-warm-700 text-cream px-6 py-2.5 rounded-lg font-medium hover:bg-warm-800 transition-colors disabled:opacity-50 text-sm"
                  >
                    {relationshipPending === "review"
                      ? "Saving..."
                      : "Save Review"}
                  </button>
                  {userBook &&
                    (userBook.rating !== null || userBook.review !== null) && (
                      <button
                        onClick={clearReview}
                        disabled={relationshipLocked}
                        className="px-4 py-2.5 rounded-lg border border-warm-200 text-warm-600 hover:bg-warm-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50 text-sm font-medium"
                      >
                        {relationshipPending === "clear"
                          ? "Clearing..."
                          : "Clear rating & review"}
                      </button>
                    )}
                </div>
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
                  key={r.user.id}
                  className="flex gap-4 pb-4 border-b border-warm-100 last:border-0 last:pb-0"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: r.user.avatarColor }}
                  >
                    {r.user.firstName[0]}
                    {r.user.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-warm-900 text-sm">
                        {r.user.firstName} {r.user.lastName}
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
  disabled,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
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
