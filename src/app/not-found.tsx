import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="card-warm max-w-xl w-full p-7 text-center">
        <h1 className="font-serif text-xl font-bold text-warm-900 mb-2">
          Page not found
        </h1>
        <p className="text-warm-600 text-sm mb-5">
          That shelf or book does not exist anymore.
        </p>
        <Link
          href="/library"
          className="inline-flex bg-warm-700 text-cream px-4 py-2 rounded-lg font-medium hover:bg-warm-800 transition-colors text-sm"
        >
          Back to Library
        </Link>
      </div>
    </div>
  );
}
