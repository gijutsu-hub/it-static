"use client";

import { useEffect, useState } from "react";
import type { InstagramPost } from "@/app/api/instagram/route";

function PostCard({ post }: { post: InstagramPost }) {
  const thumb =
    post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url;

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block aspect-square bg-surface-container sticker-border sticker-shadow overflow-hidden rounded-xl"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {thumb && (
        <img
          src={thumb}
          alt={post.caption?.slice(0, 80) ?? "IT'S STATIC on Instagram"}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      )}
      {post.media_type === "VIDEO" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-on-surface text-secondary-container p-3 sticker-border">
            <span className="material-symbols-outlined text-3xl">play_arrow</span>
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-on-surface/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-4">
        <p className="font-body-md text-secondary-container text-xs line-clamp-3">
          {post.caption ?? "View on Instagram"}
        </p>
        <span className="material-symbols-outlined text-primary-container mt-2">open_in_new</span>
      </div>
    </a>
  );
}

function SkeletonGrid() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square bg-surface-container-high sticker-border rounded-xl animate-pulse"
        />
      ))}
    </>
  );
}

export default function InstagramFeed() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/instagram")
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts ?? []);
        setConfigured(data.configured ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SkeletonGrid />
      </div>
    );
  }

  if (!configured || posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-8">
        <div className="bg-secondary-container sticker-border sticker-shadow p-8 rounded-2xl text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-on-secondary-container mb-4 block">
            photo_camera
          </span>
          <div className="font-display-lg text-xl uppercase text-on-secondary-container mb-2">
            FOLLOW THE FEED
          </div>
          <p className="font-body-md text-on-secondary-container text-sm mb-4">
            See our latest posts, drops, and static moments on Instagram.
          </p>
          <a
            href="https://instagram.com/itstatic.space"
            target="_blank"
            rel="noopener noreferrer"
            className="tactile-button bg-on-surface text-secondary-container px-6 py-3 font-display-lg text-sm rounded-xl uppercase inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">open_in_new</span>
            @itstatic.space
          </a>
        </div>
        <p className="text-on-surface-variant text-xs text-center max-w-sm">
          Auto-feed requires{" "}
          <code className="bg-surface-container px-1 py-0.5 rounded text-xs">
            INSTAGRAM_ACCESS_TOKEN
          </code>{" "}
          and{" "}
          <code className="bg-surface-container px-1 py-0.5 rounded text-xs">
            INSTAGRAM_USER_ID
          </code>{" "}
          environment variables via the Instagram Basic Display API.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
