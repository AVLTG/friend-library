type LoadErrorProps = {
  title: string;
  message: string;
  onRetry: () => void;
  retryLabel?: string;
};

export default function LoadError({
  title,
  message,
  onRetry,
  retryLabel = "Try Again",
}: LoadErrorProps) {
  return (
    <div className="card-warm max-w-xl mx-auto p-6 text-center">
      <h1 className="font-serif text-xl font-bold text-warm-900 mb-2">
        {title}
      </h1>
      <p className="text-warm-600 text-sm mb-5">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-warm-700 text-cream px-4 py-2 rounded-lg font-medium hover:bg-warm-800 transition-colors text-sm"
      >
        {retryLabel}
      </button>
    </div>
  );
}
