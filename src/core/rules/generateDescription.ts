/**
 * Regras de texto do chamado guiado. Equivalem a updateGeneratedDescription da
 * versão antiga (commit 9ebb80c), reescritas como funções puras.
 */

/** Respostas do formulário guiado (gravadas em work_orders.guided). */
export interface GuidedAnswers {
  environment: string;
  item: string;
  situation: string;
  action: string;
  /** Itens do checklist que o usuário marcou como verificados. */
  checklist: string[];
  /** Observação livre adicional. */
  notes: string;
}

export const DEFAULT_LOCATION = 'local informado';

export interface DescriptionInput extends GuidedAnswers {
  /** Nome do imóvel; vazio vira "local informado". */
  location?: string | null;
}

export function generateDescription(input: DescriptionInput): string {
  const location = input.location?.trim() || DEFAULT_LOCATION;
  const checked = input.checklist.map((entry) => entry.trim()).filter(Boolean);
  const notes = input.notes.trim();

  const checkedText = checked.length > 0 ? ` Verificações realizadas: ${checked.join('; ')}.` : '';
  const notesText = notes ? ` Observação adicional: ${notes}` : '';

  return (
    `No local ${location}, foi identificado: ${input.item} em ${input.environment}. ` +
    `Situação observada: ${input.situation}. Ação recomendada: ${input.action}.` +
    checkedText +
    notesText
  );
}

/** Título sugerido: "Item: situação" (ex.: "Torneira: está vazando"). */
export function suggestTitle(item: string, situation: string): string {
  const cleanItem = item.trim();
  const cleanSituation = situation.trim();
  if (!cleanItem) return cleanSituation;
  if (!cleanSituation) return cleanItem;
  return `${cleanItem}: ${cleanSituation.charAt(0).toLocaleLowerCase('pt-BR')}${cleanSituation.slice(1)}`;
}
