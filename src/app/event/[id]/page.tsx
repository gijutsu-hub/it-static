import type { Metadata } from "next";
import EventClient from "./EventClient";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://itstatic.app";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Event — IT'S STATIC",
    description: "You've been invited to a live meetup on IT'S STATIC.",
    openGraph: {
      title: "IT'S STATIC — Live Event",
      description: "You've been invited to a live meetup.",
      url: `${BASE_URL}/event/${id}`,
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  return <EventClient squadId={id} />;
}
