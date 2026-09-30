import { notFound } from "next/navigation";
import BrickKit from "./BrickKit";

// the design kit is for building the app, not for players
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BrickKit />;
}
