import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useToast } from "../hooks/use-toast";
import { signInWithGoogle, signOut, onAuthStateChangedListener, getCurrentUser } from '../services/firebaseService';
import { useNavigate } from 'react-router-dom';
import trendLogo from '../trendlogo.png';

interface NavbarProps {
  onCategoryChange?: (category: string) => void;
}

const Navbar = ({ onCategoryChange }: NavbarProps) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((firebaseUser) => {
      setUser(firebaseUser);
    });
    setUser(getCurrentUser());
    return () => unsubscribe();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Dispatch a custom event to notify other components about the search
      window.dispatchEvent(new CustomEvent('insta-search', { 
        detail: { searchTerm: searchTerm.trim() } 
      }));
      
      toast({
        title: "Searching trends",
        description: `Finding trends for "${searchTerm}"`,
      });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      toast({ title: 'Signed in with Google' });
    } catch (error) {
      toast({ title: 'Google Sign-in Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: 'Signed out' });
    } catch (error) {
      toast({ title: 'Sign out Failed', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 relative">
        {/* Logo is shown by SidebarLayout (mobile header + desktop sidebar); hide here to avoid duplicate */}
        <a href="/" className="hidden items-center gap-2 font-semibold hover:opacity-80 transition-opacity">
          <img src={trendLogo} alt="insytiq.ai logo" className="h-10 w-10" />
          <span className="text-xs font-semibold tracking-[0.2em] text-gray-500 uppercase">
            INSYTIQ.AI
          </span>
        </a>
        {/* Desktop Login/Signup Button - Mobile sign in is now in burger menu */}
        <div className="ml-auto hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              {user.photoURL && <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full border" />}
              <span className="font-medium text-gray-700 text-sm">{user.displayName || user.email}</span>
              <Button size="sm" variant="outline" onClick={handleSignOut}>Sign out</Button>
            </div>
          ) : (
            <Button size="sm" className="bg-gradient-to-r from-blue-500 to-blue-700" onClick={() => navigate('/auth')}>
            <Search className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline-flex">Sign In </span>
          </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
