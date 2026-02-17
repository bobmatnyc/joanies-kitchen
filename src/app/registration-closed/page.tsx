import { Lock } from 'lucide-react';
import Link from 'next/link';

/**
 * Registration Closed Page
 *
 * Displayed when new user registrations are disabled (Alpha phase)
 * Informs users about the beta launch date and provides sign-in option
 * for existing users.
 */
export default function RegistrationClosedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-linen to-jk-sage/20 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Red Header Strip */}
          <div className="bg-red-600 h-2" />

          {/* Content */}
          <div className="p-8 text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
              <Lock className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>

            {/* Alpha Badge */}
            <div className="inline-block mb-4">
              <div className="border-4 border-red-600 border-dashed px-4 py-2">
                <span className="text-2xl font-black text-red-600 tracking-widest uppercase">
                  ALPHA
                </span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-heading font-bold text-gray-900 dark:text-white mb-3">
              Registration Closed
            </h1>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              We're currently in <strong>private alpha testing</strong> with a limited group of
              users. New registrations are temporarily closed while we refine the platform.
            </p>

            {/* Beta Launch Info */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-900 dark:text-amber-200 font-medium mb-1">
                🎉 Beta Launch Coming Soon!
              </p>
              <p className="text-lg font-heading font-bold text-amber-700 dark:text-amber-300">
                June 1, 2026
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Public registration opens with beta release
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {/* Existing Users */}
              <Link
                href="/sign-in"
                className="block w-full bg-jk-olive hover:bg-jk-olive/90 text-jk-linen font-medium py-3 px-4 rounded-lg transition-colors shadow-sm"
              >
                Sign In (Existing Users)
              </Link>

              {/* Home */}
              <Link
                href="/"
                className="block w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Back to Home
              </Link>
            </div>

            {/* Footer Note */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-6">
              Questions? Contact us about early access opportunities
            </p>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">What to expect in Beta:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="inline-block bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              4,644 Recipes
            </span>
            <span className="inline-block bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              AI Recipe Matching
            </span>
            <span className="inline-block bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              Zero Food Waste
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
