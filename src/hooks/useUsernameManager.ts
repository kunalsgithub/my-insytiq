import { useState, useEffect } from 'react';
import { getCurrentUser, onAuthStateChangedListener } from '../services/firebaseService';
import { saveAnalyzedUsername, getLastAnalyzedUsername, getAnalyzedUsernames, updateUsernameAnalysis } from '../utils/firestoreUsernames';

export const useUsernameManager = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [lastAnalyzedUsername, setLastAnalyzedUsername] = useState<string | null>(null);
  const [analyzedUsernames, setAnalyzedUsernames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((user) => {
      if (user) {
        setUserId(user.uid);
        // Load the last analyzed username when user is authenticated
        loadLastAnalyzedUsername(user.uid);
      } else {
        setUserId(null);
        setLastAnalyzedUsername(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load the last analyzed username and all usernames from Firebase
  const loadLastAnalyzedUsername = async (uid: string) => {
    try {
      setLoading(true);
      const [lastUsername, allUsernames] = await Promise.all([
        getLastAnalyzedUsername(uid),
        getAnalyzedUsernames(uid)
      ]);
      setLastAnalyzedUsername(lastUsername);
      setAnalyzedUsernames(allUsernames.map(u => u.username));
    } catch (error) {
      console.error('Error loading usernames:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save a new username to Firebase
  const saveUsername = async (username: string): Promise<boolean> => {
    if (!userId) {
      console.error('No user ID available');
      return false;
    }

    try {
      setSaving(true);
      await saveAnalyzedUsername(userId, username);
      setLastAnalyzedUsername(username);
      // Refresh the list of usernames
      const allUsernames = await getAnalyzedUsernames(userId);
      setAnalyzedUsernames(allUsernames.map(u => u.username));
      return true;
    } catch (error) {
      console.error('Error saving username:', error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    userId,
    lastAnalyzedUsername,
    analyzedUsernames,
    loading,
    saving,
    saveUsername,
    loadLastAnalyzedUsername: () => userId && loadLastAnalyzedUsername(userId)
  };
}; 