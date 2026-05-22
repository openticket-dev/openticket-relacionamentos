/**
 * Alias /relacionamentos/hub → redirect to /landing. O shell sempre linka
 * /relacionamentos/hub (padrão das 9 verticais), mas este standalone só tem
 * landing em /landing. Sem este alias, dev.openticket.com.br/relacionamentos/hub
 * retornava 404.
 */
import { redirect } from "next/navigation";

export default function HubPage() {
  redirect("/landing");
}
