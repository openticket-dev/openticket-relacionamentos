// 18 subverticals do produto Relacionamentos.
// Referencia: master plan REV1 W2 — spider-step W-R-9 (initial scaffold).
// Cada subvertical tem rota de filtro propria em /buscar?vertical=<slug>

export type Subvertical = {
  slug: string;
  label: string;
  emoji: string;
  description: string;
};

export const SUBVERTICALS: Subvertical[] = [
  { slug: "dating", label: "Dating", emoji: "❤️", description: "Encontros romanticos" },
  { slug: "networking", label: "Networking", emoji: "💼", description: "Conexoes profissionais" },
  { slug: "friendship", label: "Amizade", emoji: "🤝", description: "Novos amigos" },
  { slug: "mentorship", label: "Mentoria", emoji: "🎓", description: "Mentor / mentorado" },
  { slug: "fitness", label: "Fitness", emoji: "💪", description: "Parceiros de treino" },
  { slug: "travel", label: "Viagem", emoji: "✈️", description: "Companheiros de viagem" },
  { slug: "study", label: "Estudo", emoji: "📚", description: "Grupos de estudo" },
  { slug: "language", label: "Idiomas", emoji: "🗣️", description: "Pratica de idiomas" },
  { slug: "music", label: "Musica", emoji: "🎸", description: "Bandas / parceiros musicais" },
  { slug: "gaming", label: "Games", emoji: "🎮", description: "Squad de jogos" },
  { slug: "books", label: "Livros", emoji: "📖", description: "Clube do livro" },
  { slug: "food", label: "Gastronomia", emoji: "🍽️", description: "Parceiros gastronomicos" },
  { slug: "spiritual", label: "Espiritual", emoji: "🧘", description: "Conexoes espirituais" },
  { slug: "hobbies", label: "Hobbies", emoji: "🎨", description: "Hobbies em comum" },
  { slug: "pets", label: "Pets", emoji: "🐾", description: "Pet friends" },
  { slug: "events", label: "Eventos", emoji: "🎉", description: "Companhia para eventos" },
  { slug: "business", label: "Co-founder", emoji: "🚀", description: "Cofundadores / projetos" },
  { slug: "volunteer", label: "Voluntariado", emoji: "🤲", description: "Voluntariado em grupo" },
];

// ─────────────────────────────────────────────────────────────────────────────
// FILTRO DE DESCOBERTA (server-side) — enum do gateway, NAO o catalogo acima.
//
// `SUBVERTICALS` (acima) e o catalogo de INTERESSES do perfil: os slugs vao
// crus pro campo `interests` (GraphQLJSON) de `updateMyMatchProfile` /
// `updateRelationshipPreferences` e alimentam o jaccard do DiscoveryService.
// Dominio livre de string — nenhum enum valida.
//
// O FILTRO do feed e outro campo, com outro dominio de valores:
//   discoverProfiles(filters: DiscoveryFiltersInput)
//   DiscoveryFiltersInput.subverticais: [DiscoverySubvertical]
// `DiscoverySubvertical` e um ENUM GraphQL declarado no gateway federado em
// openticket-api `apps/relacionamentos/src/dto/discovery.dto.ts`
// (`enum DiscoverySubverticalEnum`, registrado com
// `registerEnumType(DiscoverySubverticalEnum, { name: 'DiscoverySubvertical' })`)
// e espelhado no `type Subvertical` de `apps/relacionamentos/src/discovery.service.ts`.
// Os 18 valores abaixo sao copia VERBATIM desse enum.
//
// Mandar um slug minusculo aqui nao "deixa de filtrar": o gateway rejeita a
// QUERY INTEIRA na validacao do enum (e de novo no Zod
// `DiscoveryFiltersSchema.parse`, `z.nativeEnum`), e a tela cai no estado de
// erro. Por isso o filtro so oferece o que o enum aceita.
//
// O mesmo dominio vale na ESCRITA: `updateRelationshipPreferences` espelha
// `metadata.verticals` -> `RelationshipProfile.preferences.subverticais`
// (camaleao.service.ts, `mirrorToDiscoveryPreferences`), e o "Subvertical gate"
// do feed (discovery.service.ts) faz intersecao de conjuntos entre o que a
// query pede e o que o candidato salvou. Slug de um lado e enum do outro nunca
// se cruzam — os dois lados precisam falar enum.
//
// SEM MENTORIA: nao existe membro de mentoria/mentorship nos 18 valores do
// enum. Enquanto a API nao adicionar um, nao ha filtro server-side de mentoria
// e ele nao pode ser oferecido aqui (oferecer = chip que quebra a tela).
export const DISCOVERY_SUBVERTICALS = [
  { value: "ALMA_GEMEA", label: "Alma gemea", emoji: "❤️" },
  { value: "AMIZADE", label: "Amizade", emoji: "🤝" },
  { value: "NETWORKING", label: "Networking", emoji: "💼" },
  { value: "COMUNIDADE", label: "Comunidade", emoji: "🧩" },
  { value: "EVENTO", label: "Eventos", emoji: "🎉" },
  { value: "CURSO", label: "Cursos", emoji: "📚" },
  { value: "IGREJA", label: "Igreja", emoji: "⛪" },
  { value: "ESPORTE", label: "Esporte", emoji: "💪" },
  { value: "GASTRONOMIA", label: "Gastronomia", emoji: "🍽️" },
  { value: "MUSICA", label: "Musica", emoji: "🎸" },
  { value: "CINEMA", label: "Cinema", emoji: "🎬" },
  { value: "VIAGEM", label: "Viagem", emoji: "✈️" },
  { value: "PETS", label: "Pets", emoji: "🐾" },
  { value: "CARREIRA", label: "Carreira", emoji: "🚀" },
  { value: "VOLUNTARIADO", label: "Voluntariado", emoji: "🤲" },
  { value: "CULTURA", label: "Cultura", emoji: "🎨" },
  { value: "TECNOLOGIA", label: "Tecnologia", emoji: "💻" },
  { value: "BEM_ESTAR", label: "Bem-estar", emoji: "🧘" },
] as const;

export type DiscoverySubvertical =
  (typeof DISCOVERY_SUBVERTICALS)[number]["value"];

const DISCOVERY_SUBVERTICAL_VALUES = new Set<string>(
  DISCOVERY_SUBVERTICALS.map((s) => s.value),
);

/**
 * Mantem so os valores que o enum `DiscoverySubvertical` do gateway aceita.
 *
 * Usado ao reidratar preferencias salvas: o blob `metadata.verticals` e
 * GraphQLJSON (sem validacao no gateway), entao pode conter slug antigo
 * gravado antes deste fix. Valor que o enum nao conhece e descartado em vez de
 * voltar pra tela como selecao fantasma que quebraria a proxima busca.
 */
export function keepDiscoverySubverticals(
  values: readonly unknown[],
): DiscoverySubvertical[] {
  return values.filter(
    (v): v is DiscoverySubvertical =>
      typeof v === "string" && DISCOVERY_SUBVERTICAL_VALUES.has(v),
  );
}
