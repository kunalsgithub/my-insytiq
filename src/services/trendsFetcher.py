from pytrends.request import TrendReq
import pandas as pd
from datetime import datetime, timedelta
import json

def get_trending_data(search_term=None, category=None, content_type="hashtags"):
    # Initialize PyTrends
    pytrends = TrendReq(hl='en-US', tz=360)
    
    # Build the payload
    if search_term:
        kw_list = [search_term]
    else:
        # Default trending topics
        kw_list = ["#trending", "#viral", "#reels", "#instagood", "#photography"]
    
    # Get real-time trending searches
    try:
        # Get interest over time
        pytrends.build_payload(kw_list, timeframe='now 1-d')
        interest_over_time_df = pytrends.interest_over_time()
        
        # Get related queries
        related_queries = pytrends.related_queries()
        
        # Process the data
        trending_items = []
        
        for keyword in kw_list:
            # Calculate momentum (change in interest)
            if not interest_over_time_df.empty:
                current_interest = interest_over_time_df[keyword].iloc[-1]
                previous_interest = interest_over_time_df[keyword].iloc[-2] if len(interest_over_time_df) > 1 else current_interest
                change = ((current_interest - previous_interest) / previous_interest * 100) if previous_interest != 0 else 0
                
                # Get related rising queries
                rising_queries = related_queries[keyword]['rising'] if keyword in related_queries else None
                
                item = {
                    "id": str(len(trending_items) + 1),
                    "name": keyword,
                    "type": "hashtag" if keyword.startswith("#") else "audio",
                    "interest": int(current_interest),
                    "momentum": int((current_interest / 100) * 100),  # Normalize to 0-100
                    "change": round(change, 2),
                    "lastUpdated": datetime.now().isoformat(),
                    "related_queries": rising_queries.to_dict() if rising_queries is not None else []
                }
                
                trending_items.append(item)
        
        return trending_items
    
    except Exception as e:
        print(f"Error fetching trends: {str(e)}")
        return []

if __name__ == "__main__":
    # Test the function
    trending_data = get_trending_data()
    print(json.dumps(trending_data, indent=2)) 