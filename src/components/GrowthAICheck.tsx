import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebaseService";
import { useNavigate } from "react-router-dom";
import { useUsernameManager } from "@/hooks/useUsernameManager";

interface GrowthAICheckProps {
  children: React.ReactNode;
}

const GrowthAICheck = ({ children }: GrowthAICheckProps) => {
  const [showModal, setShowModal] = useState(false);
  const { lastAnalyzedUsername, loading } = useUsernameManager();
  const navigate = useNavigate();

  useEffect(() => {
    // If we have a last analyzed username, don't show the modal
    if (lastAnalyzedUsername) {
      setShowModal(false);
    } else {
      setShowModal(true);
    }
  }, [lastAnalyzedUsername]);

  const handleGoToAnalytics = () => {
    navigate("/instagram-analytics");
  };

  // Show loading state while checking
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // If modal should be shown, render it
  if (showModal) {
    return (
      <>
        {/* Semi-transparent background overlay */}
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          {/* Modal */}
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 mx-4">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Add an Instagram Username
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                To access your Growth AI insights, please analyze an Instagram profile first.
              </p>
            </div>

            {/* Action Button */}
            <div className="flex flex-col space-y-3">
              <button
                onClick={handleGoToAnalytics}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                Go to Instagram Analytics
              </button>
            </div>

            {/* Additional Info */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Once you analyze a profile, you'll unlock powerful AI-driven growth insights
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // If user has analyzed username, show the children (Growth AI dashboard)
  return <>{children}</>;
};

export default GrowthAICheck; 