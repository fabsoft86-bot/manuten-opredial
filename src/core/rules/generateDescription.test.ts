import { describe, expect, it } from 'vitest';

import { generateDescription, suggestTitle, type DescriptionInput } from './generateDescription';

const base: DescriptionInput = {
  location: 'Edifício Central',
  environment: 'Banheiro',
  item: 'Torneira',
  situation: 'Está vazando',
  action: 'Acionar encanador para reparar',
  checklist: [],
  notes: '',
};

describe('generateDescription', () => {
  it('monta a frase no formato da versão antiga', () => {
    expect(generateDescription(base)).toBe(
      'No local Edifício Central, foi identificado: Torneira em Banheiro. ' +
        'Situação observada: Está vazando. Ação recomendada: Acionar encanador para reparar.',
    );
  });

  it('usa "local informado" sem imóvel', () => {
    expect(generateDescription({ ...base, location: null })).toMatch(/^No local local informado,/);
    expect(generateDescription({ ...base, location: '   ' })).toMatch(/^No local local informado,/);
  });

  it('lista as verificações marcadas, separadas por ponto e vírgula', () => {
    const text = generateDescription({
      ...base,
      checklist: ['Verificar de onde vem a água', 'Fechar o registro se houver vazamento intenso'],
    });
    expect(text).toContain(
      ' Verificações realizadas: Verificar de onde vem a água; Fechar o registro se houver vazamento intenso.',
    );
  });

  it('acrescenta a observação adicional no fim, sem espaços extras', () => {
    const text = generateDescription({ ...base, notes: '  Pinga desde ontem  ' });
    expect(text.endsWith(' Observação adicional: Pinga desde ontem')).toBe(true);
  });

  it('ignora itens de checklist vazios', () => {
    expect(generateDescription({ ...base, checklist: ['  ', ''] })).not.toContain('Verificações');
  });
});

describe('suggestTitle', () => {
  it('junta item e situação com a situação em minúscula', () => {
    expect(suggestTitle('Torneira', 'Está vazando')).toBe('Torneira: está vazando');
  });

  it('funciona com só um dos dois', () => {
    expect(suggestTitle('', 'Está vazando')).toBe('Está vazando');
    expect(suggestTitle('Torneira', ' ')).toBe('Torneira');
  });
});
