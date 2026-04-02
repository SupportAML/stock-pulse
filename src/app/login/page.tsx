import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  // If already signed in, skip the login page
  const session = await auth();
  if (session) redirect("/dashboard/markets");

  const { callbackUrl, error } = await searchParams;
  const destination = callbackUrl ?? "/dashboard/markets";

  const errorMessages: Record<string, string> = {
    OAuthSignin:    "Could not start the sign-in flow. Please try again.",
    OAuthCallback:  "Sign-in callback failed. Please try again.",
    OAuthAccountNotLinked: "Email already associated with another provider.",
    AccessDenied:   "Your email is not on the allowed list.",
    Default:        "An unexpected error occurred. Please try again.",
  };
  const errorMessage = error ? (errorMessages[error] ?? errorMessages.Default) : null;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent mb-2">
            StockPulse
          </h1>
          <p className="text-gray-400 text-sm">AI-Powered Paper Trading</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-1">Sign in</h2>
          <p className="text-gray-500 text-sm mb-8">
            Use your Google account to access the dashboard
          </p>

          {/* Error banner */}
          {errorMessage && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {errorMessage}
            </div>
          )}

          {/* Google sign-in — server action */}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: destination });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              {/* Google icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs mt-6">
            Paper trading only · No real money involved
          </p>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          By signing in you agree to use this platform for educational purposes only.
        </p>
      </div>
    </div>
  );
}
