import { Metadata } from "next";

import TimelinePlanner from "@/components/contents/TimelinePlanner";

export const metadata: Metadata = {
  title: "Timeline Planner",
  description: "Prototype aplikasi planning task harian dengan timeline otomatis.",
};

export default function Home() {
  return <TimelinePlanner />;
}
