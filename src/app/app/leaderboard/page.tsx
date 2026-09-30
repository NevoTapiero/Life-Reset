import { redirect } from "next/navigation";

// The board lives on the World screen now (with the door into the 3D town).
export default function LeaderboardPage() {
  redirect("/app/world");
}
