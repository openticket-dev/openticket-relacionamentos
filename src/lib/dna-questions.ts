/**
 * DNA Questions Catalog v1.0.0 (frontend mirror).
 *
 * Espelho client-side do catalogo backend
 * (openticket-api/apps/relacionamentos/src/dna/dna-questions.catalog.ts).
 * Mantido em sync via copia explicita — frontend NAO inventa perguntas.
 *
 * IMPORTANTE: ordem e ids ESTAVEIS. Mudancas obrigam bump de version.
 *
 * Wave: DNA-30 · feat/ot-r-dna-30-perguntas-onboarding-2026-05-14
 */

export type DnaDimension =
  | 'OPENNESS'
  | 'CONSCIENTIOUSNESS'
  | 'EXTRAVERSION'
  | 'AGREEABLENESS'
  | 'NEUROTICISM';

export interface DnaQuestion {
  id: string;
  dimension: DnaDimension;
  text: string;
  reverseScored: boolean;
}

export const DNA_DIMENSION_LABELS: Record<DnaDimension, string> = {
  OPENNESS: 'Abertura',
  CONSCIENTIOUSNESS: 'Organização',
  EXTRAVERSION: 'Extroversão',
  AGREEABLENESS: 'Empatia',
  NEUROTICISM: 'Estabilidade emocional',
};

export const DNA_QUESTIONS: ReadonlyArray<DnaQuestion> = [
  { id: 'Q01', dimension: 'OPENNESS', text: 'Curto experimentar coisas novas, mesmo que estranhas.', reverseScored: false },
  { id: 'Q02', dimension: 'OPENNESS', text: 'Arte, música e ideias abstratas me empolgam.', reverseScored: false },
  { id: 'Q03', dimension: 'OPENNESS', text: 'Tenho uma imaginação vívida.', reverseScored: false },
  { id: 'Q04', dimension: 'OPENNESS', text: 'Prefiro rotina previsível a aventura.', reverseScored: true },
  { id: 'Q05', dimension: 'OPENNESS', text: 'Gosto de discutir filosofia, ciência ou política a fundo.', reverseScored: false },
  { id: 'Q06', dimension: 'OPENNESS', text: 'Não curto livros ou filmes que mexem com a cabeça.', reverseScored: true },
  { id: 'Q07', dimension: 'CONSCIENTIOUSNESS', text: 'Sou organizado e cumpro prazos.', reverseScored: false },
  { id: 'Q08', dimension: 'CONSCIENTIOUSNESS', text: 'Termino o que começo, mesmo quando dá preguiça.', reverseScored: false },
  { id: 'Q09', dimension: 'CONSCIENTIOUSNESS', text: 'Penso bem antes de agir.', reverseScored: false },
  { id: 'Q10', dimension: 'CONSCIENTIOUSNESS', text: 'Deixo coisas pra última hora.', reverseScored: true },
  { id: 'Q11', dimension: 'CONSCIENTIOUSNESS', text: 'Tenho metas claras pro meu futuro.', reverseScored: false },
  { id: 'Q12', dimension: 'CONSCIENTIOUSNESS', text: 'Sou bagunceiro com minhas coisas.', reverseScored: true },
  { id: 'Q13', dimension: 'EXTRAVERSION', text: 'Adoro estar perto de muita gente.', reverseScored: false },
  { id: 'Q14', dimension: 'EXTRAVERSION', text: 'Falo fácil com desconhecidos.', reverseScored: false },
  { id: 'Q15', dimension: 'EXTRAVERSION', text: 'Sou cheio de energia.', reverseScored: false },
  { id: 'Q16', dimension: 'EXTRAVERSION', text: 'Prefiro ficar sozinho a sair com grupo grande.', reverseScored: true },
  { id: 'Q17', dimension: 'EXTRAVERSION', text: 'Lidero conversas naturalmente.', reverseScored: false },
  { id: 'Q18', dimension: 'EXTRAVERSION', text: 'Sou mais quieto e reservado.', reverseScored: true },
  { id: 'Q19', dimension: 'AGREEABLENESS', text: 'Confio nas pessoas até elas me darem motivo pra duvidar.', reverseScored: false },
  { id: 'Q20', dimension: 'AGREEABLENESS', text: 'Coopero mais do que compito.', reverseScored: false },
  { id: 'Q21', dimension: 'AGREEABLENESS', text: 'Me importo com sentimentos dos outros.', reverseScored: false },
  { id: 'Q22', dimension: 'AGREEABLENESS', text: 'Acho difícil perdoar quando me machucam.', reverseScored: true },
  { id: 'Q23', dimension: 'AGREEABLENESS', text: 'Sou paciente com gente lenta ou confusa.', reverseScored: false },
  { id: 'Q24', dimension: 'AGREEABLENESS', text: 'Falo o que penso sem filtrar muito.', reverseScored: true },
  { id: 'Q25', dimension: 'NEUROTICISM', text: 'Me preocupo com coisas pequenas.', reverseScored: false },
  { id: 'Q26', dimension: 'NEUROTICISM', text: 'Mudo de humor rápido.', reverseScored: false },
  { id: 'Q27', dimension: 'NEUROTICISM', text: 'Lido bem com pressão e estresse.', reverseScored: true },
  { id: 'Q28', dimension: 'NEUROTICISM', text: 'Pego coisas pessoalmente fácil.', reverseScored: false },
  { id: 'Q29', dimension: 'NEUROTICISM', text: 'Tenho noites ansiosas pensando no passado ou futuro.', reverseScored: false },
  { id: 'Q30', dimension: 'NEUROTICISM', text: 'Em geral sou calmo e estável.', reverseScored: true },
];

export const QUESTIONS_PER_PAGE = 5;
export const TOTAL_PAGES = Math.ceil(DNA_QUESTIONS.length / QUESTIONS_PER_PAGE);
