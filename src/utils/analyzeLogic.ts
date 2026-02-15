export function analyzeBrandScoreFromApifyData(profile, posts) {
    const totalEngagement = posts.reduce((sum, post) => sum + (post.likesCount || 0) + (post.commentsCount || 0), 0);
    const avgEngagement = totalEngagement / posts.length;
    const followerCount = profile.followersCount || 1;
  
    const engagementRate = (avgEngagement / followerCount) * 100;
    const postFrequency = posts.length / 4; // assuming data from last 28 days
  
    const nicheKeywords = extractKeywords(profile.biography + " " + posts.map(p => p.caption || "").join(" "));
  
    const score = Math.min(100, Math.round(
      (engagementRate * 2) + (postFrequency * 10) + (nicheKeywords.length * 2)
    ));
  
    return {
      score,
      engagementConsistency: "stable", // future logic
      followerQuality: engagementRate > 2 ? "high" : "low",
      postFrequency: Math.round(postFrequency),
      nicheKeywords,
      recommendations: [
        postFrequency < 3 ? "Increase post frequency." : "Post frequency is good.",
        engagementRate < 2 ? "Try improving post engagement." : "Strong engagement levels!"
      ]
    };
  }
  
  function extractKeywords(text: string): string[] {
    const keywords = ["fashion", "beauty", "travel", "fitness", "handloom", "tech", "luxury", "skincare"];
    return keywords.filter(k => text.toLowerCase().includes(k));
  }
  