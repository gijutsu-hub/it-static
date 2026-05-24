import { NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firestore";

export const revalidate = 60;

export async function GET() {
  try {
    const q = query(
      collection(db, "entryCodeDrops"),
      where("active", "==", true)
    );
    const snap = await getDocs(q);

    const drops = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        label: data.label as string,
        lat: data.lat as number,
        lng: data.lng as number,
      };
    });

    return NextResponse.json(
      { drops },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch {
    return NextResponse.json({ drops: [] });
  }
}
