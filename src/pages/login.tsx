import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToastAction } from '@/components/ui/toast';
import { signInWithGoogle, signInWithGoogleRedirect } from '@/services/firebaseService';
import { useToast } from '@/hooks/use-toast';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Apple } from 'lucide-react';

export default function LoginPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      toast({
        title: mode === 'login' ? 'Signing in with Google...' : 'Signing up with Google...',
        description: 'Please complete the Google flow in the popup window.',
      });

      await signInWithGoogle();

      toast({
        title: '✅ Google successful',
        description: 'Welcome to InstaTrend Seeker!',
      });

      navigate('/');
    } catch (error) {
      console.error('Google sign-in error in login page:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

      if (errorMessage.includes('not authorized')) {
        const currentHost = window.location.hostname;
        const firebaseUrl = `https://console.firebase.google.com/project/social-trends-29ac2/authentication/settings`;

        toast({
          title: '❌ Google Sign-in Failed',
          description: `Domain "${currentHost}" is not authorized. Click the button below to open Firebase Console and add it.`,
          variant: 'destructive',
          duration: 15000,
          action: (
            <ToastAction
              altText="Open Firebase Console"
              onClick={() => window.open(firebaseUrl, '_blank')}
            >
              Open Firebase Console
            </ToastAction>
          ),
        });
      } else {
        toast({
          title: '❌ Google Sign-in Failed',
          description: errorMessage,
          variant: 'destructive',
          duration: 5000,
        });
      }
    }
  };

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const auth = getAuth();
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: 'Logged in successfully' });
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast({ title: 'Account created and signed in' });
      }
      navigate('/');
    } catch (error) {
      toast({
        title: mode === 'login' ? 'Login Failed' : 'Signup Failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === 'login' ? 'signup' : 'login'));
  };

  const isSignup = mode === 'signup';

  return (
    <div className="min-h-screen bg-[#e5e7eb] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl mx-auto rounded-3xl overflow-hidden shadow-2xl bg-white flex flex-col md:flex-row">
        {/* Left panel: form */}
        <div className="w-full md:w-[48%] bg-gradient-to-b from-white via-white to-[#fff5fb] px-8 py-10 md:px-10 md:py-12 flex flex-col justify-between">
          {/* Brand and heading */}
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-500 mb-8">
              INSYTIQ.AI
            </div>

            <div className="space-y-2 mb-8">
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
                {isSignup ? 'Create an account' : 'Welcome back'}
              </h1>
              <p className="text-sm md:text-base text-gray-500">
                {isSignup
                  ? 'Sign up and get a 30 day free trial of our Instagram analytics.'
                  : 'Sign in to continue tracking and growing your Instagram.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleManualAuth} className="space-y-4">
              {isSignup && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Full name</label>
                  <Input
                    type="text"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 rounded-full bg-gray-100 border-transparent focus-visible:ring-2 focus-visible:ring-[#ee2a7b]/60 focus-visible:ring-offset-0 px-4 text-sm"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-full bg-gray-100 border-transparent focus-visible:ring-2 focus-visible:ring-[#ee2a7b]/60 focus-visible:ring-offset-0 px-4 text-sm"
                />
              </div>

              <div className="space-y-1 relative">
                <label className="text-xs font-medium text-gray-600">Password</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-full bg-gray-100 border-transparent focus-visible:ring-2 focus-visible:ring-[#ee2a7b]/60 focus-visible:ring-offset-0 px-4 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 top-6 flex items-center text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs mt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="h-3.5 w-3.5 rounded border-gray-300 text-[#ee2a7b] focus:ring-[#ee2a7b]"
                  />
                  <label htmlFor="remember" className="text-gray-500">
                    Remember for 30 days
                  </label>
                </div>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="text-[#ee2a7b] font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <Button
                type="submit"
                className="mt-3 w-full h-11 rounded-full bg-[rgb(192,37,122)] text-white font-semibold text-sm shadow-lg hover:brightness-110 transition-all"
              >
                {isSignup ? 'Submit' : 'Sign in'}
              </Button>
            </form>

            {/* Social auth */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <div className="h-px flex-1 bg-gray-200" />
                <span>Or continue with</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="flex">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  className="w-full h-10 rounded-full border-gray-200 bg-white text-xs font-medium flex items-center justify-center gap-2"
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                    alt="Google"
                    className="w-4 h-4"
                  />
                  <span>Google</span>
                </Button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    toast({
                      title: 'Redirecting to Google...',
                      description: 'You will be redirected to complete sign-in.',
                    });
                    await signInWithGoogleRedirect();
                  } catch (error) {
                    toast({
                      title: '❌ Redirect Failed',
                      description: (error as Error).message,
                      variant: 'destructive',
                    });
                  }
                }}
                className="w-full text-[11px] text-gray-500 hover:text-[#ee2a7b] mt-1"
              >
                Having trouble with popup? Try redirect instead
              </button>
            </div>
          </div>

          {/* Footer switch between signup / login */}
          <div className="mt-8 text-xs text-gray-500">
            {isSignup ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-[#ee2a7b] font-medium hover:underline"
                >
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                New to insytiq.ai?{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-[#ee2a7b] font-medium hover:underline"
                >
                  Create account
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Right panel: hero / image placeholder */}
        <div className="w-full md:w-[52%] bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] relative flex items-center justify-center px-8 py-10 md:px-12">
          <div className="absolute inset-0 bg-black/10" />

          <div className="relative z-10 max-w-md w-full text-white space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Smart Instagram growth insights</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold leading-snug">
              See your best content, posting rhythm, and growth in one place.
            </h2>

            <p className="text-sm text-white/80">
              Track posts, reels, and collaborations in a single dashboard. Let insytiq.ai
              surface what&apos;s working—so you can focus on creating.
            </p>

            {/* Placeholder cards – replace with real image later if you like */}
            <div className="mt-4 space-y-3">
              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/70">This week</p>
                  <p className="text-lg font-semibold">Top 3 performing posts</p>
                </div>
                <div className="flex -space-x-2">
                  {[
                    'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=200',
                    'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=200',
                    'https://images.pexels.com/photos/1181533/pexels-photo-1181533.jpeg?auto=compress&cs=tinysrgb&w=200',
                  ].map((src, idx) => (
                    <div
                      key={idx}
                      className="w-7 h-7 rounded-full border border-white overflow-hidden bg-white/20"
                    >
                      <img src={src} alt={`Top post ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between text-xs">
                <div>
                  <p className="text-white/70">Posting schedule</p>
                  <p className="text-sm font-semibold">Best time: 7–9 PM</p>
                </div>
                <div className="flex flex-col items-end text-right">
                  <span className="text-2xl font-bold">+32%</span>
                  <span className="text-white/70">engagement lift</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}