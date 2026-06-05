import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  MoreVertical,
  House,
  Flame,
  Users,
  BarChart3,
  Radar,
  Target,
  MessageSquareText,
  CreditCard,
  BookOpenText,
} from "lucide-react";
import trendLogo from "../../trendlogo.png";
import { CreatorEconomyNavLink } from "../CreatorEconomyNavLink";

// Minimal sidebar menu for MVP.
// Growth AI items intentionally omitted but underlying feature files are kept in the codebase.
export function WhoistrendSidebarMenu() {
  interface ChatHistoryItem {
    id: string;
    title: string;
    createdAt?: string;
    updatedAt?: string;
  }

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `group/nav relative flex items-center rounded-xl px-3 py-2 transition-all ${
      isActive
        ? "bg-[#e9f2ff] text-[#1a73e8]"
        : "text-gray-700 hover:bg-gray-100/80 hover:text-gray-900"
    }`;

  const labelClass = "ml-3 truncate text-sm font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100";

  useEffect(() => {
    const loadHistory = () => {
      try {
        const raw = localStorage.getItem("bb_smartchat_v2_history");
        if (!raw) {
          setChatHistory([]);
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setChatHistory(parsed as ChatHistoryItem[]);
        } else {
          setChatHistory([]);
        }
      } catch (e) {
        console.error("Failed to load chat history for sidebar:", e);
      }
    };

    loadHistory();
    const handler = () => loadHistory();
    window.addEventListener("bb-smartchat-history-updated", handler as EventListener);
    return () => {
      window.removeEventListener("bb-smartchat-history-updated", handler as EventListener);
    };
  }, []);

  const handleNewChatClick = () => {
    if (!location.pathname.startsWith("/smart-chat")) {
      navigate("/smart-chat");
    }
    window.dispatchEvent(new Event("bb-smartchat-new-chat"));
  };

  const handleDeleteChat = (id: string) => {
    try {
      const raw = localStorage.getItem("bb_smartchat_v2_history");
      const index: ChatHistoryItem[] = raw ? JSON.parse(raw) : [];
      const next = index.filter((item) => item.id !== id);
      localStorage.setItem("bb_smartchat_v2_history", JSON.stringify(next));
      localStorage.removeItem(`bb_smartchat_v2_history-${id}`);
      setMenuOpenId(null);
      window.dispatchEvent(new Event("bb-smartchat-history-updated"));
    } catch (e) {
      console.error("Failed to delete Smart Chat history item:", e);
    }
  };

  return (
    <aside className="group fixed top-0 left-0 z-30 hidden h-screen w-[72px] flex-col border-r border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90 transition-[width] duration-200 ease-out hover:w-[260px] md:flex">
      <NavLink
        to="/"
        className="mb-6 flex items-center gap-2 overflow-hidden rounded-lg px-1 py-1 hover:opacity-90 transition-opacity"
      >
        <img src={trendLogo} alt="insytiq.ai logo" className="h-8 w-8" />
        <span className="truncate text-xs font-semibold tracking-[0.2em] text-gray-500 uppercase opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          INSYTIQ.AI
        </span>
      </NavLink>

      {/* Main Section */}
      <div>
        <div className="mb-2 h-4 overflow-hidden text-xs font-semibold uppercase tracking-wider text-gray-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          Main
        </div>
        <nav className="flex flex-col gap-1 mb-4">
          <NavLink
            to="/"
            className={navItemClass}
          >
            <House className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Home</span>
          </NavLink>
          <NavLink
            to="/trending"
            className={navItemClass}
          >
            <Flame className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Trending</span>
          </NavLink>
          <NavLink
            to="/top-influencers"
            className={navItemClass}
          >
            <Users className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Top Influencers</span>
          </NavLink>
        </nav>
        <div className="border-t border-gray-200 my-2" />
      </div>

      {/* Analytics Section */}
      <div>
        <div className="mb-2 h-4 overflow-hidden text-xs font-semibold uppercase tracking-wider text-gray-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          Analytics
        </div>
        <nav className="flex flex-col gap-1 mb-4">
          <NavLink
            to="/instagram-analytics"
            className={navItemClass}
          >
            <BarChart3 className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Instagram Analytics</span>
          </NavLink>
          <NavLink
            to="/analytics/competitor-intelligence"
            className={navItemClass}
          >
            <Radar className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Competitor Intelligence</span>
          </NavLink>
          <NavLink
            to="/brand-collab-score"
            className={navItemClass}
          >
            <Target className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Brand Collab Score</span>
          </NavLink>
        </nav>
        <div className="border-t border-gray-200 my-2" />
      </div>

      {/* Insights Section */}
      <div>
        <div className="mb-2 h-4 overflow-hidden text-xs font-semibold uppercase tracking-wider text-gray-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          Insights
        </div>
        <nav className="flex flex-col gap-1 mb-4">
          <NavLink
            to="/smart-chat"
            className={navItemClass}
          >
            <MessageSquareText className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Smart Chat</span>
          </NavLink>
        </nav>

        {/* Chats section (Smart Chat history) - only visible on Smart Chat and desktop (lg+) */}
        {location.pathname.startsWith("/smart-chat") && (
          <div className="mt-4 hidden lg:block opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <div className="flex items-center justify-between mb-2">
              <div className="uppercase text-xs font-semibold text-gray-500 tracking-wider">
                Chats
              </div>
              <button
                type="button"
                onClick={handleNewChatClick}
                className="text-[10px] px-2 py-1 rounded-full bg-[#111827] text-white font-semibold shadow hover:shadow-md hover:-translate-y-0.5 transform transition-all"
              >
                New
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {chatHistory.length === 0 ? (
                <p className="text-[11px] text-gray-400">
                  Your recent Smart Chat conversations will appear here.
                </p>
              ) : (
                chatHistory.map((item) => (
                  <div
                    key={item.id}
                    className="w-full flex items-center justify-between gap-1 px-1 py-1 rounded-lg hover:bg-gray-100 group"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/smart-chat?chatId=${item.id}`)}
                      className="flex-1 text-left px-1 py-0.5 rounded truncate text-[11px] text-gray-800"
                      title={item.title}
                    >
                      {item.title}
                    </button>
                    <div className="relative flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId((prev) => (prev === item.id ? null : item.id));
                        }}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>
                      {menuOpenId === item.id && (
                        <div className="absolute right-0 mt-1 w-28 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
                                handleDeleteChat(item.id);
                              }
                            }}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 rounded-md"
                          >
                            Delete chat
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Subscription Section */}
      <div className="mt-auto pt-4 border-t border-gray-200">
        <div className="mb-2 h-4 overflow-hidden text-xs font-semibold uppercase tracking-wider text-gray-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          Subscription
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink
            to="/subscription"
            className={navItemClass}
          >
            <CreditCard className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Subscriptions</span>
          </NavLink>
          <NavLink
            to="/blog"
            className={navItemClass}
          >
            <BookOpenText className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Blog</span>
          </NavLink>
          <CreatorEconomyNavLink />
        </nav>
      </div>
    </aside>
  );
}


