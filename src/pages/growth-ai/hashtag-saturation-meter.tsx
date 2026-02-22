import React, { useState } from 'react';
import { Input } from "../../components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { Badge } from "../../components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../../components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { Switch } from "../../components/ui/switch";
import { Search, Hash, Info } from "lucide-react";
import { toast } from "../../hooks/use-toast";

const DUMMY_HASHTAGS = [
  { tag: '#fashionreels', volume: 3400000, engagement: 'High', competition: 82, color: 'red', suggestions: ['#indiefashion', '#ootdstyle', '#fashionfinds', '#outfitideas', '#styleinspo', '#indieaesthetic', '#indiestyle'] },
  { tag: '#ootd', volume: 12000000, engagement: 'Moderate', competition: 65, color: 'yellow', suggestions: ['#ootdstyle', '#outfitideas', '#styleinspo', '#fashionstartup', '#trendalert', '#lookbook', '#fashiongram'] },
  { tag: '#indiefashion', volume: 120000, engagement: 'High', competition: 28, color: 'green', suggestions: ['#indieaesthetic', '#indiestyle', '#fashionstartup', '#uniquevibes', '#slowfashion', '#sustainablefashion', '#newdrop'] },
];
const SUGGESTION_TOOLTIPS = {
  '#indiefashion': 'Lower competition. High saves rate.',
  '#ootdstyle': 'Ideal for mid-size creators.',
  '#fashionfinds': 'Trending in your niche.',
  '#outfitideas': 'Good engagement, moderate volume.',
  '#styleinspo': 'High saves rate.',
  '#indieaesthetic': 'Low competition, rising trend.',
  '#indiestyle': 'Niche, high engagement.',
  '#fashionstartup': 'Best for new creators.',
};

// Master list of possible hashtags for suggestions
const MASTER_HASHTAGS = [
  '#indiefashion', '#ootdstyle', '#fashionfinds', '#outfitideas', '#styleinspo', '#indieaesthetic', '#indiestyle', '#fashionstartup', '#trendalert', '#lookbook', '#fashiongram', '#uniquevibes', '#slowfashion', '#sustainablefashion', '#newdrop', '#fashionista', '#streetstyle', '#minimalfashion', '#vintagevibes', '#fashionblogger', '#dailyoutfit', '#fashionaddict', '#runwayready', '#fashiontips', '#styleblogger', '#fashiongoals', '#fashionweek', '#whatiwore', '#fashionicon', '#fashionlover', '#fashionpost'
];

function getColor(competition: number) {
  if (competition >= 75) return 'bg-gradient-to-r from-red-400 to-red-600';
  if (competition >= 40) return 'bg-gradient-to-r from-yellow-400 to-yellow-500';
  return 'bg-gradient-to-r from-green-400 to-green-600';
}
function getColorText(competition: number) {
  if (competition >= 75) return 'text-red-600';
  if (competition >= 40) return 'text-yellow-600';
  return 'text-green-600';
}
function formatVolume(num: number) {
  if (num >= 1000000) return `Used in ${(num/1000000).toFixed(1)}M posts`;
  if (num >= 1000) return `Used in ${(num/1000).toFixed(1)}K posts`;
  return `Used in ${num} posts`;
}

export default function HashtagSaturationMeter() {
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showTrust, setShowTrust] = useState(false);
  const [recent, setRecent] = useState(['#fashionreels', '#ootd']);

  function handleAnalyze(tag: string) {
    const found = DUMMY_HASHTAGS.find(h => h.tag === tag.toLowerCase());
    setSelected(found || {
      tag,
      volume: Math.floor(Math.random()*1000000)+10000,
      engagement: ['High','Moderate','Low'][Math.floor(Math.random()*3)],
      competition: Math.floor(Math.random()*100),
      color: getColor(Math.floor(Math.random()*100)),
      suggestions: ['#indiefashion', '#ootdstyle', '#fashionfinds'].sort(() => 0.5 - Math.random()).slice(0,3)
    });
    setInput(tag);
    setRecent(r => [tag, ...r.filter(t => t !== tag)].slice(0,5));
  }

  return (
    <TooltipProvider>
    <div className="blur-overlay-container max-w-2xl mx-auto px-4 py-10 w-full">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Hashtag Saturation Meter</h1>
        <p className="text-gray-500 text-lg md:text-xl">Identify which hashtags are ideal for your content — and which ones to avoid.</p>
      </div>

      {/* Search/Input */}
      <div className="mb-8">
        <label className="block text-sm font-semibold mb-2" htmlFor="hashtag-input">Enter a hashtag</label>
        <div className="flex gap-2 items-center">
          <Input
            id="hashtag-input"
            placeholder="#yourhashtag"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && input) handleAnalyze(input.startsWith('#') ? input : `#${input}`); }}
            className="flex-1 text-base md:text-sm"
          />
          <button
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white font-semibold shadow hover:scale-105 hover:shadow-lg transition-all"
            onClick={() => handleAnalyze(input.startsWith('#') ? input : `#${input}`)}
            disabled={!input}
          >
            <Search className="w-5 h-5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-2 py-2 rounded-lg border border-gray-200 bg-white shadow-sm hover:border-[#ee2a7b] focus:border-[#ee2a7b] text-gray-700 font-semibold flex items-center gap-1">
                <Hash className="w-4 h-4 text-[#ee2a7b]" />
                <span>Recent</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {recent.map(tag => (
                <DropdownMenuItem key={tag} onSelect={() => handleAnalyze(tag)}>{tag}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Analysis Result Panel */}
      {selected && (
        <Card className="mb-8 bg-white rounded-2xl shadow-lg">
          <CardHeader className="flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <Hash className="w-7 h-7 text-[#ee2a7b]" />
              <CardTitle className="text-2xl font-bold">{selected.tag}</CardTitle>
            </div>
            <CardDescription className="ml-auto text-base font-semibold {getColorText(selected.competition)}">
              {formatVolume(selected.volume)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center md:gap-8 gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-700">Engagement Potential:</span>
                  <span className={`font-bold ${getColorText(selected.competition)}`}>{selected.engagement}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-700">Competition:</span>
                  <span className={`font-bold ${getColorText(selected.competition)}`}>{selected.competition}%</span>
                </div>
                <div className="w-full mt-2">
                  <div className={`h-4 w-full rounded-full ${getColor(selected.competition)} shadow-inner relative`}>
                    <div className="absolute left-0 top-0 h-4 rounded-full bg-white/30" style={{ width: `${selected.competition}%` }} />
                    <div className="absolute left-0 top-0 h-4 rounded-full" style={{ width: `${selected.competition}%` }} />
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">{selected.competition >= 75 ? 'High competition (hard to rank)' : selected.competition >= 40 ? 'Moderate competition' : 'Ideal for your account size!'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smart Recommendation Section */}
      {selected && (
        <div className="mb-8">
          <div className="flex items-center mb-2 gap-2">
            <span className="font-semibold text-gray-700">Try these instead:</span>
            <button
              className="ml-2 px-2 py-1 text-xs rounded bg-[#ee2a7b]/10 text-[#ee2a7b] font-semibold border border-[#ee2a7b]/20 hover:bg-[#ee2a7b]/20 transition-all"
              onClick={() => {
                // Always copy at least 8 hashtags
                const mainTag = selected.tag;
                let suggestions = selected.suggestions.filter(t => t !== mainTag);
                if (suggestions.length < 8) {
                  const extra = MASTER_HASHTAGS.filter(t => !suggestions.includes(t) && t !== mainTag).slice(0, 8 - suggestions.length);
                  suggestions = [...suggestions, ...extra];
                }
                navigator.clipboard.writeText(suggestions.slice(0, 8).join(' '));
                toast({ title: 'Copied all hashtags!' });
              }}
              type="button"
            >
              Copy All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Always show at least 8 unique hashtags */}
            {(() => {
              const mainTag = selected.tag;
              let suggestions = selected.suggestions.filter(t => t !== mainTag);
              if (suggestions.length < 8) {
                const extra = MASTER_HASHTAGS.filter(t => !suggestions.includes(t) && t !== mainTag).slice(0, 8 - suggestions.length);
                suggestions = [...suggestions, ...extra];
              }
              return suggestions.slice(0, 8).map((tag: string) => (
                <Tooltip key={tag}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="cursor-pointer bg-white border border-[#ee2a7b]/30 text-[#ee2a7b] font-semibold hover:bg-[#ee2a7b]/10 transition-all"
                      onClick={() => {
                        navigator.clipboard.writeText(tag);
                        toast({ title: 'Copied!' });
                      }}
                    >
                      {tag}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{SUGGESTION_TOOLTIPS[tag] || 'Lower competition. High saves rate.'}</TooltipContent>
                </Tooltip>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Trust Section */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-2">
          <Switch id="trust-switch" checked={showTrust} onCheckedChange={setShowTrust} />
          <label htmlFor="trust-switch" className="font-semibold text-gray-700 cursor-pointer flex items-center gap-1">
            <Info className="w-4 h-4 text-[#ee2a7b]" /> How this is calculated
          </label>
        </div>
        {showTrust && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 shadow-inner">
            Based on average likes/comments, hashtag volume, and your account size. We analyze engagement rates, post velocity, and competition to recommend the best hashtags for you.
          </div>
        )}
      </div>
      
      {/* Blur Overlay */}
      <div className="blur-overlay">
        <div className="blur-overlay-text">🚀 Upcoming</div>
      </div>
    </div>
    </TooltipProvider>
  );
} 