import { NextResponse } from "next/server";

export interface InstagramPost {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
}

const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const USER_ID = process.env.INSTAGRAM_USER_ID;

export async function GET() {
  if (!TOKEN || !USER_ID) {
    return NextResponse.json(
      { posts: [], configured: false },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
    );
  }

  try {
    const url = new URL(
      `https://graph.instagram.com/${USER_ID}/media`
    );
    url.searchParams.set(
      "fields",
      "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp"
    );
    url.searchParams.set("limit", "6");
    url.searchParams.set("access_token", TOKEN);

    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`Instagram API error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(
      { posts: (data.data ?? []) as InstagramPost[], configured: true },
      { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200" } }
    );
  } catch {
    return NextResponse.json(
      { posts: [], configured: true, error: true },
      { headers: { "Cache-Control": "s-maxage=60" } }
    );
  }
}
