import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as Blob | null;
  const token = formData.get("token") as string | null;
  const path = formData.get("path") as string | null;

  if (!file || !token || !path) {
    return NextResponse.json({ error: "Missing file, token, or path" }, { status: 400 });
  }

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    return NextResponse.json({ error: "Storage bucket not configured" }, { status: 500 });
  }

  const encodedPath = encodeURIComponent(path);
  const uploadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodedPath}`;

  const arrayBuffer = await file.arrayBuffer();

  const uploadRes = await fetch(uploadURL, {
    method: "POST",
    headers: {
      Authorization: `Firebase ${token}`,
      "Content-Type": "image/jpeg",
    },
    body: arrayBuffer,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    return NextResponse.json({ error: `Upload failed: ${errorText}` }, { status: uploadRes.status });
  }

  const downloadURL =
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;

  return NextResponse.json({ url: downloadURL });
}
