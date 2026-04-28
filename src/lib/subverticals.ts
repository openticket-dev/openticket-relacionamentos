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
