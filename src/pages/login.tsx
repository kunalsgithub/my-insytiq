import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToastAction } from '@/components/ui/toast';
import { signInWithGoogle, signInWithGoogleRedirect } from '@/services/firebaseService';
import { useToast } from '@/hooks/use-toast';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Facebook, Twitter, Apple } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      // Show loading state
      toast({ 
        title: 'Signing in with Google...', 
        description: 'Please complete the sign-in process in the popup window.' 
      });
      
      await signInWithGoogle();
      
      toast({ 
        title: '✅ Successfully signed in with Google',
        description: 'Welcome to InstaTrend Seeker!' 
      });
      
      navigate('/');
    } catch (error) {
      console.error('Google sign-in error in login page:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      // For unauthorized domain errors, show a more helpful message with link
      if (errorMessage.includes('not authorized')) {
        const currentHost = window.location.hostname;
        const firebaseUrl = `https://console.firebase.google.com/project/social-trends-29ac2/authentication/settings`;
        
        toast({ 
          title: '❌ Google Sign-in Failed', 
          description: `Domain "${currentHost}" is not authorized. Click the button below to open Firebase Console and add it.`,
          variant: 'destructive',
          duration: 15000, // Show for 15 seconds
          action: (
            <ToastAction 
              altText="Open Firebase Console"
              onClick={() => window.open(firebaseUrl, '_blank')}
            >
              Open Firebase Console
            </ToastAction>
          )
        });
      } else {
        toast({ 
          title: '❌ Google Sign-in Failed', 
          description: errorMessage, 
          variant: 'destructive',
          duration: 5000
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
    setMode(prevMode => (prevMode === 'login' ? 'signup' : 'login'));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col md:flex-row w-full max-w-5xl mx-auto md:shadow-2xl md:rounded-2xl md:overflow-hidden h-screen md:h-auto">

        {/* Image Section (Top on mobile, Right on desktop) */}
        <div className="w-full h-2/5 md:h-auto md:w-1/2 p-8 bg-gradient-to-br from-purple-400 to-blue-500 order-1 md:order-2 flex items-center justify-center">
           <div className="h-full flex items-center justify-center w-full">
                <div className="text-white text-center">
                    <h1 className="text-4xl font-bold">InstaTrend Seeker</h1>
                    <p className="mt-4 text-lg">Discover what's trending.</p>
                </div>
           </div>
        </div>

        {/* Form Section (Bottom on mobile, Left on desktop) */}
        <div className="w-full h-3/5 md:h-auto md:w-1/2 p-8 sm:p-12 bg-white order-2 md:order-1 flex flex-col justify-center relative rounded-t-3xl md:rounded-t-none -mt-8 md:mt-0">
          <div className="mb-8 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold">
              {mode === 'login' ? 'Sign In' : 'Sign Up'}
            </h1>
            <p className="mt-2 text-gray-600">
              {mode === 'login' ? "Not a Member? " : "Already a Member? "}
              <button onClick={toggleMode} className="text-purple-600 font-semibold hover:underline">
                {mode === 'login' ? "Create Account" : "Login"}
              </button>
            </p>
          </div>

          <form onSubmit={handleManualAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                placeholder="Your e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-gray-100 border-transparent focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-2 relative">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-gray-100 border-transparent focus:border-purple-500 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 top-7 pr-3 flex items-center text-gray-500"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <input type="checkbox" id="remember" className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
                <label htmlFor="remember" className="ml-2 text-gray-600">Remember for 30 days</label>
              </div>
              {mode === 'login' && <a href="#" className="font-medium text-purple-600 hover:underline">Forgot password?</a>}
            </div>

            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              {mode === 'login' ? 'Login' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-8">
            <div className="flex items-center my-4">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="mx-4 text-gray-500 text-sm">Or sign in with</span>
                <div className="flex-grow border-t border-gray-300"></div>
            </div>
            <div className="flex flex-col space-y-3">
              <Button 
                variant="outline" 
                onClick={handleGoogleSignIn} 
                className="flex items-center justify-center space-x-2 p-3 w-full"
              >
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" 
                  alt="Google" 
                  className="w-5 h-5" 
                />
                <span>Sign in with Google</span>
              </Button>
              
              <div className="text-center">
                <button 
                  onClick={async () => {
                    try {
                      toast({ 
                        title: 'Redirecting to Google...', 
                        description: 'You will be redirected to complete sign-in.' 
                      });
                      await signInWithGoogleRedirect();
                    } catch (error) {
                      toast({ 
                        title: '❌ Redirect Failed', 
                        description: (error as Error).message, 
                        variant: 'destructive' 
                      });
                    }
                  }}
                  className="text-sm text-purple-600 hover:underline"
                >
                  Having trouble with popup? Try redirect method
                </button>
              </div>
              
              <div className="flex items-center justify-center space-x-4 mt-4">
                <Button variant="outline" className="p-3">
                  <Facebook size={20} className="text-blue-600" />
                </Button>
                <Button variant="outline" className="p-3">
                  <Twitter size={20} className="text-sky-500" />
                </Button>
                <Button variant="outline" className="p-3">
                  <Apple size={20} className="text-black" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 