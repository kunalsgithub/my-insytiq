import React, { useState, useEffect } from 'react';
import { getCurrentUser, onAuthStateChangedListener } from '@/services/firebaseService';
import GrowthAICheck from './GrowthAICheck';

interface GrowthAIWrapperProps {
  children: React.ReactNode;
}

const GrowthAIWrapper: React.FC<GrowthAIWrapperProps> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // If user is not authenticated, show a message or redirect
  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please log in to access Growth AI features.
          </p>
          <a
            href="/auth"
            className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // If user is authenticated, wrap with GrowthAICheck
  return (
    <GrowthAICheck>
      {children}
    </GrowthAICheck>
  );
};

export default GrowthAIWrapper; 