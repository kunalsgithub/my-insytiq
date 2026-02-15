import React, { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { WhoistrendSidebarMenu } from "@/components/ui/sidebar";
import { Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { signOut, onAuthStateChangedListener, getCurrentUser } from '@/services/firebaseService';
import { useToast } from "@/hooks/use-toast";
import trendLogo from '../../trendlogo.png';

export default function SidebarLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileChatHistory, setMobileChatHistory] = useState<
    { id: string; title: string; createdAt?: string; updatedAt?: string }[]
  >([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((firebaseUser) => {
      setUser(firebaseUser);
    });
    setUser(getCurrentUser());
    return () => unsubscribe();
  }, []);

  // Load Smart Chat v2 history for mobile sidebar
  useEffect(() => {
    const loadHistory = () => {
      try {
        const raw = localStorage.getItem("bb_smartchat_v2_history");
        if (!raw) {
          setMobileChatHistory([]);
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setMobileChatHistory(parsed as { id: string; title: string }[]);
        } else {
          setMobileChatHistory([]);
        }
      } catch (e) {
        console.error("Failed to load Smart Chat history for mobile sidebar:", e);
      }
    };

    loadHistory();
    const handler = () => loadHistory();
    window.addEventListener("bb-smartchat-history-updated", handler as EventListener);
    return () => {
      window.removeEventListener("bb-smartchat-history-updated", handler as EventListener);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: 'Signed out' });
      setMobileMenuOpen(false);
    } catch (error: any) {
      toast({ title: 'Sign out Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleSignIn = () => {
    navigate('/auth');
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar: always visible on desktop, collapsible on mobile */}
      <div className="hidden md:block">
        <WhoistrendSidebarMenu />
      </div>
      
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-white rounded-lg shadow-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-[9998] md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Mobile Menu */}
          <div className="fixed top-0 left-0 w-full h-screen bg-white shadow-2xl z-[9999] flex flex-col md:hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <div className="flex items-center gap-2 font-semibold">
                <img src={trendLogo} alt="whoistrend logo" className="h-8 w-8" />
                <span className="text-lg">whoistrend</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            <div className="flex flex-col flex-grow overflow-y-auto">
              {/* Main Section */}
              <div className="uppercase text-xs font-semibold text-gray-500 tracking-wider mt-4 mb-2 px-6">Main</div>
              <NavLink to="/trending" className={({ isActive }) => isActive ? "bg-[#f9e6f3] text-[#d72989] font-bold rounded px-2 py-2 mx-4 my-1" : "text-gray-900 font-medium rounded px-2 py-2 mx-4 my-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"} onClick={() => setMobileMenuOpen(false)}>Trending</NavLink>
              <NavLink to="/top-influencers" className={({ isActive }) => isActive ? "bg-[#f9e6f3] text-[#d72989] font-bold rounded px-2 py-2 mx-4 my-1" : "text-gray-900 font-medium rounded px-2 py-2 mx-4 my-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"} onClick={() => setMobileMenuOpen(false)}>Top Influencers</NavLink>
              <div className="border-t border-gray-200 my-2 mx-4" />
              {/* Analytics Section */}
              <div className="uppercase text-xs font-semibold text-gray-500 tracking-wider mb-2 px-6">Analytics</div>
              <NavLink to="/instagram-analytics" className={({ isActive }) => isActive ? "bg-[#f9e6f3] text-[#d72989] font-bold rounded px-2 py-2 mx-4 my-1" : "text-gray-900 font-medium rounded px-2 py-2 mx-4 my-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"} onClick={() => setMobileMenuOpen(false)}>Instagram Analytics</NavLink>
              <NavLink to="/analytics/competitor-intelligence" className={({ isActive }) => isActive ? "bg-[#f9e6f3] text-[#d72989] font-bold rounded px-2 py-2 mx-4 my-1" : "text-gray-900 font-medium rounded px-2 py-2 mx-4 my-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"} onClick={() => setMobileMenuOpen(false)}>Competitor Intelligence</NavLink>
              <div className="border-t border-gray-200 my-2 mx-4" />
              {/* Insights Section */}
              <div className="uppercase text-xs font-semibold text-gray-500 tracking-wider mb-2 px-6">Insights</div>
              <NavLink to="/subscription" className={({ isActive }) => isActive ? "bg-[#f9e6f3] text-[#d72989] font-bold rounded px-2 py-2 mx-4 my-1" : "text-gray-900 font-medium rounded px-2 py-2 mx-4 my-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"} onClick={() => setMobileMenuOpen(false)}>Subscriptions</NavLink>
              <NavLink to="/smart-chat" className={({ isActive }) => isActive ? "bg-[#f9e6f3] text-[#d72989] font-bold rounded px-2 py-2 mx-4 my-1" : "text-gray-900 font-medium rounded px-2 py-2 mx-4 my-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"} onClick={() => setMobileMenuOpen(false)}>Smart Chat</NavLink>

              {/* Chats block for Smart Chat v2 history (mobile & tablet) */}
              <div className="mt-3 px-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="uppercase text-[11px] font-semibold text-gray-500 tracking-wider">
                    Chats
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/smart-chat");
                      window.dispatchEvent(new Event("bb-smartchat-new-chat"));
                      setMobileMenuOpen(false);
                    }}
                    className="text-[10px] px-2 py-1 rounded-full bg-[#111827] text-white font-semibold shadow hover:shadow-md"
                  >
                    New
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 mt-1">
                  {mobileChatHistory.length === 0 ? (
                    <p className="text-[11px] text-gray-400">
                      Your Smart Chat conversations will appear here.
                    </p>
                  ) : (
                    mobileChatHistory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          navigate(`/smart-chat?chatId=${item.id}`);
                          setMobileMenuOpen(false);
                        }}
                        className="w-full text-left text-[11px] px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-800 truncate"
                        title={item.title}
                      >
                        {item.title}
                      </button>
                    ))
                  )}
                </div>
              </div>
              
              {/* Sign In/Sign Out Section */}
              <div className="mt-auto border-t border-gray-200 mx-4 pt-4 pb-6">
                {user ? (
                  <div className="flex flex-col gap-3 px-2">
                    <div className="flex items-center gap-3 px-2">
                      {user.photoURL && (
                        <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full border" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.displayName || user.email}
                        </p>
                        {user.email && user.displayName && (
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleSignOut}
                      className="w-full"
                    >
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white"
                    onClick={handleSignIn}
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
} 