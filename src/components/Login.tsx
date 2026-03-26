import React from 'react';
import { useAuth } from './AuthProvider';
import { HardHat } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();

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
        <div className="mt-8">
          <button
            onClick={signIn}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600/80 hover:bg-indigo-700/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95 shadow-lg backdrop-blur-sm"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
