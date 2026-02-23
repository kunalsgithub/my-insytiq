import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import trendLogo from "../../trendlogo.png";

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
    <div className="fixed top-0 left-0 h-screen z-30 flex flex-col bg-white border-r shadow-sm min-w-[220px] max-w-[260px] p-4 hidden md:flex">
      <NavLink
        to="/"
        className="flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity"
      >
        <img src={trendLogo} alt="insytiq.ai logo" className="h-8 w-8" />
        <span className="text-xs font-semibold tracking-[0.2em] text-gray-500 uppercase">
          INSYTIQ.AI
        </span>
      </NavLink>

      {/* Main Section */}
      <div>
        <div className="uppercase text-xs font-semibold text-gray-500 tracking-wider mb-2">
          Main
        </div>
        <nav className="flex flex-col gap-1 mb-4">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive
                ? "text-[#d72989] font-bold bg-gray-100 rounded px-2 py-1 transition-colors"
                : "text-gray-900 font-medium rounded px-2 py-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/trending"
            className={({ isActive }) =>
              isActive
                ? "text-[#d72989] font-bold bg-gray-100 rounded px-2 py-1 transition-colors"
                : "text-gray-900 font-medium rounded px-2 py-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"
            }
          >
            Trending
          </NavLink>
          <NavLink
            to="/top-influencers"
            className={({ isActive }) =>
              isActive
                ? "text-[#d72989] font-bold bg-gray-100 rounded px-2 py-1 transition-colors"
                : "text-gray-900 font-medium rounded px-2 py-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"
            }
          >
            Top Influencers
          </NavLink>
        </nav>
        <div className="border-t border-gray-200 my-2" />
      </div>

      {/* Analytics Section */}
      <div>
        <div className="uppercase text-xs font-semibold text-gray-500 tracking-wider mb-2">
          Analytics
        </div>
        <nav className="flex flex-col gap-1 mb-4">
          <NavLink
            to="/instagram-analytics"
            className={({ isActive }) =>
              isActive
                ? "text-[#d72989] font-bold bg-gray-100 rounded px-2 py-1 transition-colors"
                : "text-gray-900 font-medium rounded px-2 py-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"
            }
          >
            Instagram Analytics
          </NavLink>
          <NavLink
            to="/analytics/competitor-intelligence"
            className={({ isActive }) =>
              isActive
                ? "text-[#d72989] font-bold bg-gray-100 rounded px-2 py-1 transition-colors"
                : "text-gray-900 font-medium rounded px-2 py-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"
            }
          >
            Competitor Intelligence
          </NavLink>
        </nav>
        <div className="border-t border-gray-200 my-2" />
      </div>

      {/* Insights Section */}
      <div>
        <div className="uppercase text-xs font-semibold text-gray-500 tracking-wider mb-2">
          Insights
        </div>
        <nav className="flex flex-col gap-1 mb-4">
          <NavLink
            to="/subscription"
            className={({ isActive }) =>
              isActive
                ? "text-[#d72989] font-bold bg-gray-100 rounded px-2 py-1 transition-colors"
                : "text-gray-900 font-medium rounded px-2 py-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"
            }
          >
            Subscriptions
          </NavLink>
          <NavLink
            to="/smart-chat"
            className={({ isActive }) =>
              isActive
                ? "text-[#d72989] font-bold bg-gray-100 rounded px-2 py-1 transition-colors"
                : "text-gray-900 font-medium rounded px-2 py-1 hover:bg-gray-50 hover:text-[#d72989] transition-colors"
            }
          >
            Smart Chat
          </NavLink>
        </nav>

        {/* Chats section (Smart Chat history) - only visible on Smart Chat and desktop (lg+) */}
        {location.pathname.startsWith("/smart-chat") && (
          <div className="mt-4 hidden lg:block">
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
                      onClick={() => navigate(`/smart-chat-v2?chatId=${item.id}`)}
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
    </div>
  );
}


