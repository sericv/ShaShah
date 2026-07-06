import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
  }

  // Build TMDB URL
  const tmdbUrl = new URL(`https://api.themoviedb.org/3${endpoint}`);
  
  // Forward all query parameters except 'endpoint'
  searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      tmdbUrl.searchParams.set(key, value);
    }
  });

  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!bearerToken) {
    return NextResponse.json({ error: 'TMDB Bearer token not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(tmdbUrl.toString(), {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/json',
      },
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `TMDB API error: ${res.statusText}`, details: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
