import { redirect } from "next/navigation";

/**
 * /admin — REL-S4: redirect pra /comunidade.
 *
 * Historia: esta rota era um empty-state estatico honesto (fix probe r31)
 * porque o gateway nao tinha resolver admin/moderacao da vertical, e a
 * sidebar "Comunidade" do shell apontava pra ca com TODO(W-PARALELO-2-P9)
 * cravando o href correto /comunidade.
 *
 * REL-S4 criou o backend real de comunidade (communityGroups/communityFeed/
 * communityGroupMembers/communityGroupActivities no subgraph relacionamentos)
 * e a page /comunidade. A sidebar do shell agora aponta direto pra
 * /comunidade; este redirect tira o empty-state do caminho de quem ainda
 * chega por link antigo. Subrotas admin reais (/admin/seguranca,
 * /admin/dashboard, /admin/qr-designer) seguem intactas.
 */
export default function RelacionamentosAdminPage() {
  redirect("/comunidade");
}
