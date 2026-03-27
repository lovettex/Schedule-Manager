import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { HardHat, AlertCircle } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (method: 'popup' | 'redirect' = 'popup') => {
    try {
      setError(null);
      setIsLoading(true);
      await signIn(method);
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError('Your domain is not authorized for Google Sign-in. Please add your Netlify domain to the Firebase Console -> Authentication -> Settings -> Authorized domains.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('The sign-in popup was closed before completing. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('The sign-in popup was blocked by your browser. On mobile, please try the "Sign in with Redirect" option below.');
      } else {
        setError(err.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 glass p-10 rounded-3xl shadow-2xl border border-white/20">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-500/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <HardHat className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900 tracking-tight">
            Project Manager
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Sign in to manage your construction schedules
          </p>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="mt-8 space-y-4">
          <button
            onClick={() => handleSignIn('popup')}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600/80 hover:bg-indigo-700/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95 shadow-lg backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300/30"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-slate-400 font-bold">Mobile Fallback</span>
            </div>
          </div>

          <button
            onClick={() => handleSignIn('redirect')}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-white/20 text-sm font-bold rounded-xl text-slate-700 bg-white/10 hover:bg-white/20 focus:outline-none transition-all active:scale-95 shadow-md backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sign in with Redirect
          </button>
          
          <p className="text-[10px] text-center text-slate-400 font-medium px-4">
            If the popup doesn't open on your mobile device, please use the "Redirect" option.
          </p>
        </div>
      </div>
    </div>
  );
}
