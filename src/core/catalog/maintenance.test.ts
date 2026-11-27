import { describe, expect, it } from 'vitest';

import {
  MAINTENANCE_CATEGORIES,
  categoryLabels,
  checklists,
  getChecklist,
  getGuidedOptions,
  getRoutingSuggestion,
  guidedOptions,
  isMaintenanceCategory,
  routingSuggestions,
} from './maintenance';

describe('catálogo de manutenção', () => {
  it('tem as 7 categorias acordadas (mesmas chaves do CHECK no banco)', () => {
    expect([...MAINTENANCE_CATEGORIES]).toEqual([
      'electrical',
      'plumbing',
      'civil',
      'hvac',
      'security',
      'cleaning',
      'other',
    ]);
  });

  it('tem rótulo em português para cada categoria', () => {
    expect(categoryLabels).toEqual({
      electrical: 'Elétrica',
      plumbing: 'Hidráulica',
      civil: 'Civil',
      hvac: 'Climatização',
      security: 'Segurança',
      cleaning: 'Limpeza',
      other: 'Outra',
    });
  });

  it.each(MAINTENANCE_CATEGORIES)('%s tem opções guiadas, checklist e sugestão completos', (category) => {
    const options = guidedOptions[category];
    for (const list of [options.environment, options.item, options.situation, options.action]) {
      expect(list.length).toBeGreaterThan(0);
      expect(new Set(list).size).toBe(list.length);
      list.forEach((value) => expect(value.trim()).toBe(value));
    }
    expect(checklists[category]).toHaveLength(3);
    expect(routingSuggestions[category].length).toBeGreaterThan(0);
  });

  it('preserva listas da versão antiga (amostra)', () => {
    expect(guidedOptions.plumbing.item).toContain("Caixa d'água");
    expect(guidedOptions.electrical.environment).toContain('Quadro de energia');
    expect(routingSuggestions.hvac).toBe('Técnico de climatização');
  });

  it('valida chaves de categoria', () => {
    expect(isMaintenanceCategory('plumbing')).toBe(true);
    expect(isMaintenanceCategory('Hidráulica')).toBe(false);
    expect(isMaintenanceCategory(null)).toBe(false);
  });

  it('cai em "Outra" com categoria ausente ou desconhecida', () => {
    expect(getGuidedOptions(null)).toBe(guidedOptions.other);
    expect(getGuidedOptions('xyz')).toBe(guidedOptions.other);
    expect(getChecklist(undefined)).toBe(checklists.other);
    expect(getRoutingSuggestion('xyz')).toBe('Equipe de manutenção');
    expect(getRoutingSuggestion('electrical')).toBe('Eletricista');
  });
});
