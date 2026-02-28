import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';

interface InstagramUsernameInputProps {
  onAnalyze: (username: string) => void;
}

const InstagramUsernameInput: React.FC<InstagramUsernameInputProps> = ({ onAnalyze }) => {
  const [username, setUsername] = useState('');
  const { toast } = useToast();

  const handleAnalyze = () => {
    if (!username.trim()) {
      toast({
        title: 'Please enter an Instagram username',
        variant: 'destructive',
      });
      return;
    }
    onAnalyze(username);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAnalyze();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAnalyze();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row items-center gap-4 mb-8">
      <Input
        type="text"
        placeholder="Enter Instagram username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full md:w-1/2"
      />
      <Button
        type="submit"
        className="w-full md:w-auto bg-[rgb(192,37,122)] text-white border-0 hover:brightness-110"
      >
        Analyze
      </Button>
    </form>
  );
};

export default InstagramUsernameInput; 