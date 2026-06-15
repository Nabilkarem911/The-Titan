export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  url: string;
}

export interface YouTubeSearchResult {
  query: string;
  totalResults: number;
  videos: YouTubeVideo[];
}

export async function youtubeSearch(params: {
  query: string;
  maxResults?: number;
}): Promise<YouTubeSearchResult> {
  const { query, maxResults = 5 } = params;
  const apiKey = process.env['YOUTUBE_API_KEY'];

  if (!apiKey) throw new Error('YOUTUBE_API_KEY environment variable is not set');

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=${maxResults}&type=video&key=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    pageInfo: { totalResults: number };
    items: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        description: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails: { medium: { url: string } };
      };
    }>;
  };

  const videos: YouTubeVideo[] = data.items.map((item) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails.medium.url,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));

  return { query, totalResults: data.pageInfo.totalResults, videos };
}
