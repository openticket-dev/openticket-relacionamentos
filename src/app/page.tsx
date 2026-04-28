// Relacionamentos — Root redirect to /landing
// Convencao do shell: cada vertical tem entry point em /<vertical>/landing
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/landing");
}
