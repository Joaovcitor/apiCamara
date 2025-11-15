import { CategoryDictionary, LeiStructure } from '../types';

export function categorizeLei(
  lei: LeiStructure,
  dict: CategoryDictionary,
  minScore = 2
): string[] {
  const haystack = [
    lei.titulo ?? '',
    lei.ementa ?? '',
    lei.textoCompleto ?? '',
    ...(lei.artigos || []).map(a => `${a.numero} ${a.texto}`),
  ]
    .join(' ')
    .toLowerCase();

  const categories: string[] = [];
  for (const [cat, keywords] of Object.entries(dict)) {
    let score = 0;
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      const occurrences = haystack.split(k).length - 1;
      score += occurrences;
      if (score >= minScore) break;
    }
    if (score >= minScore) categories.push(cat);
  }
  return categories;
}

// Dicionário padrão inicial (fácil de ajustar e exibir no front)
export const defaultCategoryDictionary: CategoryDictionary = {
  saude: ['saúde', 'SUS', 'vigilância sanitária', 'hospital', 'epidemiológica'],
  educacao: ['educação', 'ensino', 'escola', 'docente', 'discente'],
  tributacao: ['tributo', 'imposto', 'taxa', 'contribuição', 'fiscal'],
  meioAmbiente: ['meio ambiente', 'ambiental', 'sustentabilidade', 'resíduos', 'poluição'],
  seguranca: ['segurança', 'criminal', 'polícia', 'violência', 'penal'],
};