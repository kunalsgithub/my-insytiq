import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { MessageCircle, Send, TrendingUp, Users, BarChart3, ArrowDown } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useToast } from '../hooks/use-toast';
import { onAuthStateChangedListener, getCurrentUser } from '../services/firebaseService';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseService';
import { fetchAndStoreInstagramData } from '../api/fetchAndStoreInstagramData';
import { useSearchParams } from 'react-router-dom';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface AIAvatarProps {
  size?: 'sm' | 'md' | 'lg';
}

/** Remove numbers from section headers (DATA ANALYZED, FACTS, WHAT CANNOT BE CONCLUDED, NEXT STEP) */
function fixSectionHeaders(text: string): string {
  return text
    .replace(/\n\d+\.\s*(DATA ANALYZED)(\s*:)?/gi, "\n$1$2")
    .replace(/\n\d+\.\s*(FACTS \(numbers only\)|FACTS)(\s*:)?/gi, "\n$1$2")
    .replace(/\n\d+\.\s*(WHAT CANNOT BE CONCLUDED)(\s*:)?/gi, "\n$1$2")
    .replace(/\n\d+\.\s*(NEXT STEP)(\s*\([^)]*\))?(\s*:)?/gi, "\n$1$2$3");
}

// Simple Markdown Renderer Component (no external dependencies)
function SimpleMarkdown({ text }: { text: string }) {
  // Split text into lines to handle line breaks and lists
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let currentList: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  
  // Pink pill only for "View Content" (post URL); caption or other links must not look like buttons
  const viewContentButtonClass =
    "inline-flex items-center px-3 py-1.5 rounded-full min-w-0 " +
    "bg-[#d72989] text-white font-semibold shadow-md hover:shadow-lg " +
    "hover:-translate-y-0.5 transform transition-all " +
    "text-xs md:text-sm max-w-full break-words md:whitespace-nowrap";
  const normalLinkClass = "text-[#d72989] underline break-words hover:opacity-90";

  const getLinkClass = (linkText: string): string => {
    if (linkText.trim().toLowerCase() === "view content") return viewContentButtonClass;
    return normalLinkClass;
  };

  // Helper: make raw URLs clickable (normal link style; not "View Content" pill)
  const linkify = (str: string): React.ReactNode[] => {
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = urlRegex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      parts.push(
        <a key={`link-${key++}`} href={match[1]} target="_blank" rel="noopener noreferrer" className={normalLinkClass}>
          {match[1]}
        </a>
      );
      lastIndex = urlRegex.lastIndex;
    }
    if (lastIndex < str.length) parts.push(str.substring(lastIndex));
    return parts.length > 0 ? parts : [str];
  };

  // Helper: handle both Markdown [text](url) and raw URLs. Only "View Content" is the button; if caption was wrongly used as link text, show View Content button + Caption as plain 4th line.
  const processLinks = (str: string): React.ReactNode[] => {
    const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = mdLinkRegex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(...linkify(str.substring(lastIndex, match.index)));
      }
      const linkText = (match[1] || "").trim() || match[2];
      const isViewContent = linkText.toLowerCase() === "view content";
      if (isViewContent) {
        parts.push(
          <a key={`mdlink-${key++}`} href={match[2]} target="_blank" rel="noopener noreferrer" className={viewContentButtonClass}>
            View Content
          </a>
        );
      } else {
        // Caption wrongly used as link: View Content on its own line, then Caption: on next line (same alignment as Likes, Comments, Engagement)
        parts.push(
          <span key={`mdlink-${key++}`} className="block space-y-1 my-1">
            <a href={match[2]} target="_blank" rel="noopener noreferrer" className={viewContentButtonClass}>
              View Content
            </a>
            <span className="block text-gray-800"><strong>Caption:</strong> {linkText}</span>
          </span>
        );
      }
      lastIndex = mdLinkRegex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(...linkify(str.substring(lastIndex)));
    }
    return parts.length > 0 ? parts : [str];
  };

  // Helper function to render bold text and clickable URLs in a string
  const renderBold = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(...processLinks(str.substring(lastIndex, match.index)));
      }
      parts.push(
        <strong key={`bold-${key++}`} className="font-bold text-gray-900">
          {match[1]}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(...processLinks(str.substring(lastIndex)));
    }
    return parts.length > 0 ? parts : [str];
  };

  // Render a (possibly multi-line) list item so numbering stays 1, 2, 3...
  const renderListItem = (item: string) => {
    const itemLines = item.split('\n');
    if (itemLines.length <= 1) return renderBold(item);
    return (
      <>
        {itemLines.map((line, i) => (
          <span key={i} className="block">
            {renderBold(line)}
          </span>
        ))}
      </>
    );
  };

  const flushList = () => {
    if (currentList.length > 0 && listType) {
      if (listType === 'ul') {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside my-2 space-y-1 ml-2">
            {currentList.map((item, idx) => (
              <li key={idx} className="ml-2">{renderBold(item)}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${elements.length}`} className="list-decimal list-inside my-2 space-y-1 ml-2">
            {currentList.map((item, idx) => (
              <li key={idx} className="ml-2">{renderListItem(item)}</li>
            ))}
          </ol>
        );
      }
      currentList = [];
      listType = null;
    }
  };

  // Continuation of previous post block: Likes:, Comments:, Engagement:, Caption: (keep in same list so numbering is 1, 2, 3...)
  const isPostMetricLine = (t: string) => /^(Likes|Comments|Engagement|Caption):\s*.+$/i.test(t);

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      currentList.push(ulMatch[1]);
    } else if (olMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      currentList.push(olMatch[1]);
    } else if (listType === 'ol' && currentList.length > 0 && isPostMetricLine(trimmed)) {
      // Same post block: append to last list item so the list stays one 1,2,3... list
      currentList[currentList.length - 1] += '\n' + trimmed;
    } else if (trimmed === '' && listType === 'ol' && currentList.length > 0) {
      // Empty line between posts: do not flush — keep one list so numbering is 1, 2, 3... up to 30
    } else {
      flushList();
      if (trimmed === '') {
        elements.push(<br key={`br-${lineIdx}`} className="my-1" />);
      } else {
        elements.push(
          <p key={`p-${lineIdx}`} className="mb-2 last:mb-0">
            {renderBold(trimmed)}
          </p>
        );
      }
    }
  });
  
  // Flush any remaining list
  flushList();
  
  return <div className="text-sm md:text-base break-words">{elements}</div>;
}

// AI Avatar Component
function AIAvatar({ size = 'lg' }: AIAvatarProps) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  
  const svgSizes = {
    sm: 24,
    md: 28,
    lg: 40,
  };
  
  const svgSize = svgSizes[size];
  const avatarSize = sizeClasses[size];
  // Unique ID for gradient to avoid conflicts between multiple instances
  const gradientId = `ai-avatar-gradient-${size}`;
  
  return (
    <div className="relative flex-shrink-0">
      <div 
        className={`${avatarSize} rounded-full flex items-center justify-center shadow-lg`}
        style={{
          background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)',
        }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-white"
        >
          {/* Modern robot head */}
          <rect x="8" y="10" width="24" height="20" rx="3" fill="white" opacity="0.9"/>
          {/* Eyes */}
          <circle cx="16" cy="18" r="2.5" fill={`url(#${gradientId})`}/>
          <circle cx="24" cy="18" r="2.5" fill={`url(#${gradientId})`}/>
          {/* Mouth/expression */}
          <path d="M16 24 Q20 26 24 24" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" fill="none"/>
          {/* Antenna */}
          <circle cx="20" cy="8" r="2" fill={`url(#${gradientId})`}/>
          <line x1="20" y1="8" x2="20" y2="10" stroke={`url(#${gradientId})`} strokeWidth="2"/>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6228d7" />
              <stop offset="50%" stopColor="#ee2a7b" />
              <stop offset="100%" stopColor="#f9ce34" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {/* Subtle glow effect */}
      <div 
        className={`absolute inset-0 ${avatarSize} rounded-full blur-md opacity-30 -z-10`}
        style={{
          background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)',
        }}
      ></div>
    </div>
  );
}

interface SmartChatProps {
  useV2?: boolean;
}

const SmartChat = ({ useV2 = false }: SmartChatProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const messageIdCounterRef = useRef<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const previousUsernameRef = useRef<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Generate unique message ID using counter + timestamp + random component
  // This prevents collisions that can occur with Date.now() when messages are created rapidly
  const generateMessageId = (): string => {
    messageIdCounterRef.current += 1;
    return `msg-${Date.now()}-${messageIdCounterRef.current}-${Math.random().toString(36).substring(2, 9)}`;
  };

  // Get localStorage key for messages (per username, separate for v1 vs v2)
  const getMessagesStorageKey = (username: string | null): string => {
    const prefix = useV2 ? 'smart-chat-v2-messages' : 'smart-chat-messages';
    if (!username) return `${prefix}-default`;
    return `${prefix}-${username.toLowerCase()}`;
  };

  // History storage helpers (for multi-chat experience like Gemini/ChatGPT)
  const getHistoryIndexKey = () => (useV2 ? 'bb_smartchat_v2_history' : 'bb_smartchat_history');
  const getHistoryStorageKey = (id: string) => `${getHistoryIndexKey()}-${id}`;

  interface ChatHistoryItem {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  }

  // Load messages from localStorage for specific username
  const loadMessagesFromStorage = (username: string | null): Message[] => {
    try {
      const storageKey = getMessagesStorageKey(username);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      }
    } catch (error) {
      console.error('Error loading messages from localStorage:', error);
    }
    // Return default welcome message if no stored messages
    return [
      {
        id: generateMessageId(),
        text: 'Welcome to Big Brain! How can I help you with your social media strategy today?',
        sender: 'assistant',
        timestamp: new Date(),
      },
    ];
  };

  // Initialize messages from localStorage or default welcome message
  const [messages, setMessages] = useState<Message[]>(() => loadMessagesFromStorage(null));

  const resetToWelcome = () => {
    const welcomeMessage: Message = {
      id: generateMessageId(),
      text: 'Welcome to Big Brain! How can I help you with your social media strategy today?',
      sender: 'assistant',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    try {
      const storageKey = getMessagesStorageKey(currentUsername);
      localStorage.setItem(storageKey, JSON.stringify([welcomeMessage]));
    } catch (error) {
      console.error('Error resetting chat messages in localStorage:', error);
    }
  };

  const saveHistorySnapshot = () => {
    try {
      if (messages.length === 0) return;
      const indexKey = getHistoryIndexKey();
      const rawIndex = localStorage.getItem(indexKey);
      const index: ChatHistoryItem[] = rawIndex ? JSON.parse(rawIndex) : [];

      const firstUserMessage = messages.find((m) => m.sender === 'user');
      const title = (firstUserMessage?.text || 'Conversation').slice(0, 80);
      const id = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date().toISOString();

      // Persist full conversation for this history item
      localStorage.setItem(getHistoryStorageKey(id), JSON.stringify(messages));

      const nextIndex: ChatHistoryItem[] = [
        { id, title, createdAt: now, updatedAt: now },
        ...index,
      ].slice(0, 50);

      localStorage.setItem(indexKey, JSON.stringify(nextIndex));

      // Notify sidebar Chats section to refresh
      window.dispatchEvent(new Event('bb-smartchat-history-updated'));
    } catch (error) {
      console.error('Error saving Smart Chat history snapshot:', error);
    }
  };

  const loadHistoryThread = (id: string) => {
    try {
      const raw = localStorage.getItem(getHistoryStorageKey(id));
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (!Array.isArray(stored) || stored.length === 0) return;
      const restored: Message[] = stored.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(restored);
      try {
        const storageKey = getMessagesStorageKey(currentUsername);
        localStorage.setItem(storageKey, JSON.stringify(restored));
      } catch (err) {
        console.error('Error caching restored history thread to localStorage:', err);
      }
    } catch (error) {
      console.error('Error loading Smart Chat history thread:', error);
    }
  };

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setCurrentUsername(null);
      }
    });
    
    // Also check current user immediately
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUserId(currentUser.uid);
    }

    return () => unsubscribe();
  }, []);

  // Handle ?chatId=XYZ query params for Smart Chat v2 (open past conversation)
  useEffect(() => {
    if (!useV2) return;

    const chatId = searchParams.get('chatId');

    if (chatId) {
      loadHistoryThread(chatId);
      const next = new URLSearchParams(searchParams.toString());
      next.delete('chatId');
      setSearchParams(next, { replace: true });
    }
  }, [useV2, searchParams]);

  // Listen for global "new chat" events from the sidebar (Gemini-style multi-chat)
  useEffect(() => {
    if (!useV2) return;

    const handler = () => {
      const hasUserMessage = messages.some((m) => m.sender === 'user');
      if (hasUserMessage) {
        saveHistorySnapshot();
      }
      resetToWelcome();
    };

    window.addEventListener('bb-smartchat-new-chat', handler as EventListener);
    return () => {
      window.removeEventListener('bb-smartchat-new-chat', handler as EventListener);
    };
  }, [useV2, messages]);

  // Monitor selectedInstagramAccount from Firestore
  useEffect(() => {
    if (!userId) {
      setCurrentUsername(null);
      return;
    }

    const userDocRef = doc(db, 'users', userId);
    
    // Use onSnapshot to listen for real-time changes
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data();
          const selectedAccount = userData?.selectedInstagramAccount || null;
          setCurrentUsername(selectedAccount);
        } else {
          setCurrentUsername(null);
        }
      },
      (error) => {
        console.error('Error listening to user document:', error);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Clear messages and reset when username changes
  useEffect(() => {
    // Skip on initial mount (when previousUsernameRef is null)
    if (previousUsernameRef.current === null) {
      previousUsernameRef.current = currentUsername;
      // Load messages for current username on initial mount
      if (currentUsername) {
        const loadedMessages = loadMessagesFromStorage(currentUsername);
        setMessages(loadedMessages);
      }
      return;
    }

    // If username changed, clear old messages and start fresh
    if (previousUsernameRef.current !== currentUsername) {
      console.log('Username changed from', previousUsernameRef.current, 'to', currentUsername);
      console.log('Clearing old chat messages and starting fresh');
      
      // Clear old messages
      setMessages([
        {
          id: generateMessageId(),
          text: 'Welcome to Big Brain! How can I help you with your social media strategy today?',
          sender: 'assistant',
          timestamp: new Date(),
        },
      ]);

      // Load messages for new username (if any)
      if (currentUsername) {
        const loadedMessages = loadMessagesFromStorage(currentUsername);
        setMessages(loadedMessages);
      }

      // Update previous username ref
      previousUsernameRef.current = currentUsername;
    }
  }, [currentUsername]);

  // Save messages to localStorage whenever they change (per username)
  useEffect(() => {
    if (!currentUsername) return; // Don't save if no username selected
    
    try {
      const storageKey = getMessagesStorageKey(currentUsername);
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (error: any) {
      console.error('Error saving messages to localStorage:', error);
      // If quota exceeded, try to keep only the last 50 messages
      if (error?.name === 'QuotaExceededError' && messages.length > 50) {
        try {
          const recentMessages = messages.slice(-50);
          const storageKey = getMessagesStorageKey(currentUsername);
          localStorage.setItem(storageKey, JSON.stringify(recentMessages));
          setMessages(recentMessages);
        } catch (retryError) {
          console.error('Error saving reduced message set:', retryError);
        }
      }
    }
  }, [messages, currentUsername]);

  // Initialize Firebase function using httpsCallable (handles CORS automatically)
  // DO THIS: Use httpsCallable, NOT fetch/axios
  // NO fetch(), NO axios(), NO headers, NO CORS, NO direct URL usage
  const smartChatFn = httpsCallable(functions, useV2 ? "smartChatV2" : "smartChat");

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const shouldShow = distanceFromBottom > 50;
    if (shouldShow !== showScrollButton) {
      setShowScrollButton(shouldShow);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || isLoading) {
      return;
    }

    const currentAuthUser = getCurrentUser();
    // Check authentication before calling the function
    // Require BOTH userId state AND Firebase Auth currentUser to be present
    // This ensures Firebase Auth has a valid token
    if (!currentAuthUser) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to use Smart Chat',
        variant: 'destructive',
      });
      const errorResponse: Message = {
        id: generateMessageId(),
        text: 'Please sign in to use Smart Chat. Click the sign in button in the menu.',
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages((prevMessages) => [...prevMessages, errorResponse]);
      return;
    }

    console.log('handleSend: Sending message to Firebase:', trimmedValue);

    // Add user message immediately
    const userMessage: Message = {
      id: generateMessageId(),
      text: trimmedValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);

    // Clear input immediately for better UX
    setInputValue('');
    setIsLoading(true);

    // Handle "analyze N posts" or "analyze N days" - fetch more posts for the user's account
    const analyzePostsMatch = trimmedValue.match(/\banalyze\s*(\d+)\s*posts?\b/i);
    const analyzeDaysMatch = trimmedValue.match(/\banalyze\s*(\d+)\s*days?\b/i);
    const hasAnalyzeIntent = (analyzePostsMatch || analyzeDaysMatch) && userId;

    if (hasAnalyzeIntent) {
      if (!currentUsername) {
        const errMsg: Message = {
          id: generateMessageId(),
          text: "Please add an Instagram account in the Analytics section first, then say 'analyze 50 posts' or 'analyze 30 days' (or any number) to fetch more data.",
          sender: 'assistant',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setIsLoading(false);
        return;
      }

      let limit = 30;
      let onlyPostsNewerThan: string | undefined;
      let description = "";

      if (analyzeDaysMatch) {
        const days = Math.min(365, Math.max(1, parseInt(analyzeDaysMatch[1], 10)));
        onlyPostsNewerThan = `${days} days`;
        limit = 200; // fetch up to 200 posts from that period
        description = `posts from the last ${days} days`;
      } else if (analyzePostsMatch) {
        limit = Math.min(200, Math.max(10, parseInt(analyzePostsMatch[1], 10)));
        description = `${limit} posts`;
      }

      const expectedTime = limit > 50 || onlyPostsNewerThan ? "5–10 minutes" : "2–5 minutes";

      try {
        const loadingMsg: Message = {
          id: generateMessageId(),
          text: `Fetching and analyzing ${description} for @${currentUsername}... This may take ${expectedTime}.`,
          sender: 'assistant',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, loadingMsg]);
        await fetchAndStoreInstagramData(userId, currentUsername, limit, onlyPostsNewerThan);
        const successMsg: Message = {
          id: generateMessageId(),
          text: `Done! I've analyzed ${description} for @${currentUsername}. Ask your question for insights.`,
          sender: 'assistant',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successMsg]);
        toast({ title: 'Analysis complete', description: `${description} analyzed.` });
      } catch (err: any) {
        const errMsg: Message = {
          id: generateMessageId(),
          text: `Failed to fetch ${description}: ${err?.message || 'Please try again.'} Larger requests may take longer—try again or use a smaller number.`,
          sender: 'assistant',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        toast({ title: 'Analysis failed', description: err?.message, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      // Load analytics from Firestore so backend can use it when raw data exists
      let analyticsContext: { profile?: { media?: unknown[] } } | undefined;
      if (userId && currentUsername) {
        try {
          const tryDoc = async (docId: string) => {
            const rawRef = doc(db, 'users', userId, 'rawInstagramData', docId);
            const rawSnap = await getDoc(rawRef);
            if (rawSnap.exists()) {
              const data = rawSnap.data();
              const media = data?.profile?.media;
              if (Array.isArray(media) && media.length > 0) return { profile: { media } };
            }
            return undefined;
          };
          analyticsContext = await tryDoc(currentUsername)
            ?? await tryDoc(currentUsername.toLowerCase().trim());
        } catch (_) {
          // ignore; backend will use its own Firestore read
        }
      }

      // #region agent log
      const _ctxMediaLen = analyticsContext?.profile?.media && Array.isArray(analyticsContext.profile.media) ? analyticsContext.profile.media.length : 0;
      fetch('http://127.0.0.1:7242/ingest/dcca6a12-25ed-423d-9a0e-4081990ce7f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'smart-chat.tsx:beforeCall',message:'Client analyticsContext before smartChat call',data:{currentUsername,userId,hasAnalyticsContext:!!analyticsContext,ctxProfileMediaLen:_ctxMediaLen},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion

      // Build conversation history (last 8 messages = 4 exchanges) for context-aware responses
      const historySize = 8;
      const recentMessages = messages.slice(-historySize);
      const conversationHistory = recentMessages.map((m) => ({
        role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text,
      }));

      // Call Firebase smartChat function using httpsCallable
      console.log('handleSend: Calling Firebase smartChat function...');
      const callPayload = useV2
        ? { message: trimmedValue, conversationHistory }
        : {
            message: trimmedValue,
            username: currentUsername || undefined,
            conversationHistory,
            ...(analyticsContext && { analyticsContext }),
          };
      const res = await smartChatFn(callPayload);

      console.log('handleSend: Firebase function response received:', res.data);

      // Extract the reply from Firebase function response
      const reply = (res.data as any)?.reply;
      
      if (!reply || typeof reply !== 'string') {
        throw new Error('Invalid response format from AI service');
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: generateMessageId(),
        text: reply,
        sender: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      console.log('handleSend: Assistant response added to messages');
    } catch (error: any) {
      console.error('handleSend: Error calling Firebase function:', error);
      console.error('Error details:', {
        code: error?.code,
        message: error?.message,
        name: error?.name,
      });
      
      // Provide user-friendly error messages based on error type
      let errorMessage = 'Failed to get response. Please try again.';
      
      if (error?.code === 'failed-precondition') {
        // Handle analytics not ready error
        errorMessage = error?.message || 'Analytics are still processing. Please wait a moment and try again.';
      } else if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded') {
        errorMessage = 'The service is temporarily unavailable. Please check your connection and try again.';
      } else if (error?.code === 'not-found') {
        errorMessage = 'The smart chat service is not available. Please ensure the function is deployed.';
      } else if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') {
        errorMessage = 'Please sign in to use Smart Chat. Click the sign in button in the menu.';
      } else if (error?.message) {
        // Use the error message if available, but make it more user-friendly
        const msg = error.message.toLowerCase();
        if (msg.includes('cors') || msg.includes('network') || msg.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and ensure the service is deployed.';
        } else if (msg.includes('analytics') && msg.includes('processing')) {
          errorMessage = 'Analytics are still processing. Please wait a moment and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      // Add error message as assistant response
      const errorResponse: Message = {
        id: generateMessageId(),
        text: `Sorry, I encountered an error: ${errorMessage}`,
        sender: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prevMessages) => [...prevMessages, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('handleKeyPress: Enter key pressed, calling handleSend');
      handleSend();
    }
  };

  const handleQuestionClick = (questionTitle: string) => {
    console.log('handleQuestionClick: Question clicked, prefilling input:', questionTitle);
    
    // Only populate the input field - user must click Send to actually send
    setInputValue(questionTitle);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const mostAskedQuestions = [
    {
      id: '1',
      title: 'What are the top 10 best performing posts from last 30 Post with URL.',
      icon: TrendingUp,
      color: 'text-blue-500',
    },
    {
      id: '2',
      title: 'What are the most used hashtags.',
      icon: BarChart3,
      color: 'text-purple-500',
    },  
    {
      id: '3',
      title: 'Why these top 10 posts become the best performing post from last 30 Posts?',
      icon: Users,
      color: 'text-pink-500',
    },
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 md:px-6 md:pl-16 overflow-hidden">
        {/* Sticky Header - Only Top Section */}
        <div className="sticky top-0 z-20 bg-background pt-3 md:pt-8 pb-2 md:pb-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="flex-1">
              <h1 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2" style={{
                background: 'linear-gradient(90deg, #f9ce34, #ee2a7b, #6228d7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Big Brain 
              </h1>
              <p className="text-gray-600 text-xs md:text-base">
                Get instant answers to your social media and brand questions
              </p>
            </div>
            
            {/* AI Assistant Visual Element - Desktop */}
            <div className="hidden md:flex items-start gap-3 mt-2 flex-shrink-0 relative z-0">
              {/* Speech Bubble */}
              <div className="relative bg-white rounded-2xl shadow-md border border-gray-200 px-4 py-3 max-w-[220px] z-10">
                <p className="text-sm font-semibold gradient-text">
                  Hey 👋 Ask me anything about Instagram growth.
                </p>
                {/* Speech bubble tail */}
                <div className="absolute -right-2 top-6 w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-white border-b-[8px] border-b-transparent z-10"></div>
                <div className="absolute -right-3 top-[23px] w-0 h-0 border-t-[9px] border-t-transparent border-l-[13px] border-l-gray-200 border-b-[9px] border-b-transparent z-0"></div>
              </div>
              
              {/* AI Avatar */}
              <div className="relative z-10">
                <AIAvatar />
              </div>
            </div>
          </div>
          
          {/* AI Assistant Visual Element - Mobile (compact, optional) */}
          <div className="md:hidden flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
            <AIAvatar size="sm" />
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 px-2 py-1.5">
              <p className="text-xs font-semibold gradient-text">
                Hey 👋 Ask me anything
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Messages Area */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto min-h-0 py-2 md:py-6"
          onScroll={handleScroll}
        >
          {/* Most Asked Questions Section - Scrollable */}
          <div className="mb-3 md:mb-8">
            <h2 className="text-base md:text-xl font-semibold text-gray-800 mb-2 md:mb-4">
              Most Asked Questions of the Day
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 mb-3 md:mb-8">
              {mostAskedQuestions.map((question) => {
                const Icon = question.icon;
                return (
                  <Card
                    key={question.id}
                    className="hover:shadow-lg transition-all cursor-pointer border-gray-200 hover:border-[#d72989] active:scale-[0.98]"
                    onClick={() => handleQuestionClick(question.title)}
                  >
                    <CardHeader className="pb-2 md:pb-3 px-3 md:px-6 pt-3 md:pt-6">
                      <div className="flex items-start gap-2 md:gap-3">
                        <div className={`p-1.5 md:p-2 rounded-lg bg-gray-50 ${question.color} flex-shrink-0`}>
                          <Icon className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <CardTitle className="text-sm md:text-lg font-semibold text-gray-900 leading-tight">
                          {question.title}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 px-3 md:px-6 pb-3 md:pb-6">
                      <CardDescription className="text-xs md:text-sm text-gray-600 hidden md:block">
                        {question.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-4 max-w-3xl mx-auto px-1 md:px-0">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">Start a conversation by asking a question or clicking on a card above</p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[70%] min-w-0 px-4 py-3 rounded-3xl ${
                        message.sender === 'user'
                          ? 'bg-[#d72989]/90 text-white shadow-lg border border-white/20 backdrop-blur-md'
                          : 'bg-white/70 text-gray-800 border border-white/60 shadow-lg backdrop-blur-md'
                      } overflow-hidden md:overflow-visible`}
                    >
                      {message.sender === 'assistant' ? (
                        <div className="min-w-0 break-words md:break-normal">
                          <SimpleMarkdown text={fixSectionHeaders(message.text)} />
                          {isLoading && message.id === messages[messages.length - 1]?.id && (
                            <div className="mt-3 flex items-center gap-2 text-gray-500">
                              <div className="h-4 w-4 border-2 border-[#d72989] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                              <span className="text-xs">Please wait...</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm md:text-base whitespace-pre-wrap break-words">
                          {message.text}
                        </p>
                      )}
                      <p
                        className={`text-xs mt-1 ${
                          message.sender === 'user'
                            ? 'text-white/70'
                            : 'text-gray-500'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {/* Loading bubble when waiting for response (e.g. after user sent, or while fetching data) */}
                {isLoading && (messages.length === 0 || messages[messages.length - 1]?.sender === 'user') && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] md:max-w-[70%] min-w-0 px-4 py-3 rounded-3xl bg-white/70 text-gray-800 border border-white/60 shadow-lg backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 border-2 border-[#d72989] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Fetching data...</p>
                          <p className="text-xs text-gray-500 mt-0.5">This may take a few minutes. Please wait.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Scroll anchor for auto-scroll */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Sticky Input Section */}
        <div className="sticky bottom-0 z-20 bg-background/80 backdrop-blur-md pt-2 md:pt-4 pb-3 md:pb-8 border-t border-gray-200">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Ask a question about social media, branding, or analytics..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pr-12 rounded-3xl border border-white/60 bg-white/70 backdrop-blur-md shadow-lg focus:border-[#d72989] focus:ring-[#d72989] transition-all"
              />
              <MessageCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="bg-[#d72989] hover:bg-[#c0257a] text-white rounded-lg px-4 md:px-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="hidden md:inline ml-2">Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className="hidden md:inline ml-2">Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Floating Scroll-to-Bottom button (Smart Chat v2 only) */}
      {useV2 && showScrollButton && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="fixed z-30 flex items-center justify-center w-10 h-10 rounded-full bg-[#d72989] text-white shadow-md hover:shadow-lg hover:bg-[#c0257a] transition-all"
          style={{ bottom: '80px', right: '20px' }}
          aria-label="Scroll to latest message"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default SmartChat;
