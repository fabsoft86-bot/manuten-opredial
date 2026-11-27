/**
 * Catálogo de manutenção: categorias, opções guiadas, checklists e sugestões
 * de responsável. As listas vieram da versão antiga (commit 9ebb80c, index.html:
 * guidedOptions, checklists e routingSuggestions); só os dados foram portados.
 *
 * As chaves de categoria são gravadas no banco (work_orders.category, com CHECK).
 * Ao mudar esta lista, mude também a migration correspondente.
 */

export const MAINTENANCE_CATEGORIES = [
  'electrical',
  'plumbing',
  'civil',
  'hvac',
  'security',
  'cleaning',
  'other',
] as const;

export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];

export const DEFAULT_CATEGORY: MaintenanceCategory = 'other';

export const categoryLabels: Record<MaintenanceCategory, string> = {
  electrical: 'Elétrica',
  plumbing: 'Hidráulica',
  civil: 'Civil',
  hvac: 'Climatização',
  security: 'Segurança',
  cleaning: 'Limpeza',
  other: 'Outra',
};

/** Perguntas do formulário guiado: onde, o quê, o que aconteceu e o que fazer. */
export interface GuidedOptionSet {
  environment: readonly string[];
  item: readonly string[];
  situation: readonly string[];
  action: readonly string[];
}

export const guidedOptions: Record<MaintenanceCategory, GuidedOptionSet> = {
  electrical: {
    environment: ['Quarto', 'Sala', 'Cozinha', 'Banheiro', 'Área externa', 'Quadro de energia'],
    item: ['Lâmpada', 'Tomada', 'Interruptor', 'Disjuntor', 'Chuveiro', 'Fiação'],
    situation: [
      'Queimado ou não acende',
      'Faz barulho ou estala',
      'Está desligando sozinho',
      'Está aquecendo',
      'Está solto ou quebrado',
    ],
    action: [
      'Acionar eletricista para trocar',
      'Acionar eletricista para verificar',
      'Manter desligado e acionar eletricista',
      'Solicitar vistoria de segurança',
    ],
  },
  plumbing: {
    environment: ['Banheiro', 'Cozinha', 'Lavanderia', 'Área externa', 'Casa de máquinas'],
    item: ['Torneira', 'Chuveiro', 'Vaso sanitário', 'Ralo', "Caixa d'água", 'Registro', 'Canos'],
    situation: [
      'Está vazando',
      'Está entupido',
      'Está sem água',
      'Está com baixa pressão',
      'Está transbordando',
      'Está quebrado',
    ],
    action: [
      'Acionar encanador para reparar',
      'Solicitar desentupimento',
      'Fechar o registro e acionar encanador',
      'Solicitar vistoria hidráulica',
    ],
  },
  civil: {
    environment: ['Quarto', 'Sala', 'Cozinha', 'Banheiro', 'Corredor', 'Área externa'],
    item: ['Parede', 'Teto', 'Piso', 'Porta', 'Janela', 'Móvel'],
    situation: [
      'Está quebrado',
      'Está solto',
      'Está com infiltração',
      'Está descascando',
      'Está emperrado',
      'Apresenta risco de queda',
    ],
    action: [
      'Acionar manutenção civil',
      'Solicitar reparo',
      'Isolar o local e acionar manutenção',
      'Solicitar vistoria',
    ],
  },
  hvac: {
    environment: ['Quarto', 'Sala', 'Escritório', 'Recepção', 'Área comum'],
    item: ['Ar-condicionado', 'Ventilador', 'Controle remoto', 'Filtro'],
    situation: [
      'Não liga',
      'Não está gelando',
      'Está pingando',
      'Está fazendo barulho',
      'Apresenta mau cheiro',
    ],
    action: [
      'Acionar técnico de climatização',
      'Desligar e solicitar manutenção',
      'Solicitar limpeza do equipamento',
      'Trocar pilhas e testar',
    ],
  },
  security: {
    environment: ['Entrada', 'Garagem', 'Corredor', 'Área externa', 'Quarto'],
    item: ['Fechadura', 'Portão', 'Câmera', 'Alarme', 'Iluminação'],
    situation: [
      'Não está funcionando',
      'Está destrancado',
      'Está quebrado',
      'Apresenta falha',
      'Está sem energia',
    ],
    action: [
      'Acionar responsável pela segurança',
      'Isolar o local',
      'Solicitar reparo urgente',
      'Registrar para vistoria',
    ],
  },
  cleaning: {
    environment: ['Quarto', 'Banheiro', 'Cozinha', 'Área externa', 'Área comum'],
    item: ['Piso', 'Parede', 'Ralo', 'Móvel', 'Área geral'],
    situation: [
      'Está sujo',
      'Está com mau cheiro',
      'Está com mofo',
      'Está com resíduos',
      'Precisa de limpeza profunda',
    ],
    action: [
      'Solicitar limpeza',
      'Solicitar higienização',
      'Solicitar remoção de resíduos',
      'Solicitar avaliação de mofo',
    ],
  },
  other: {
    environment: ['Quarto', 'Sala', 'Cozinha', 'Banheiro', 'Área externa', 'Outro local'],
    item: ['Equipamento', 'Móvel', 'Instalação', 'Área geral', 'Outro item'],
    situation: [
      'Apresenta problema',
      'Está quebrado',
      'Está indisponível',
      'Apresenta risco',
      'Precisa de vistoria',
    ],
    action: [
      'Solicitar vistoria',
      'Acionar profissional especializado',
      'Isolar o local',
      'Registrar para avaliação',
    ],
  },
};

/** Verificações sugeridas ao zelador antes de enviar o chamado. */
export const checklists: Record<MaintenanceCategory, readonly string[]> = {
  electrical: [
    'Verificar se o disjuntor está ligado',
    'Testar outro interruptor ou tomada do local',
    'Manter desligado se houver cheiro de queimado ou faísca',
  ],
  plumbing: [
    'Verificar de onde vem a água',
    'Fechar o registro se houver vazamento intenso',
    'Evitar usar o ponto até a avaliação',
  ],
  civil: [
    'Verificar se há risco de queda ou acidente',
    'Isolar o local se houver perigo',
    'Registrar o tamanho aproximado do dano',
  ],
  hvac: [
    'Verificar se o equipamento está ligado na tomada',
    'Conferir se o controle tem pilhas',
    'Desligar se houver cheiro forte ou ruído anormal',
  ],
  security: [
    'Manter o local seguro para circulação',
    'Verificar se o problema afeta acesso ou saída',
    'Avisar a gestão se houver risco imediato',
  ],
  cleaning: [
    'Identificar a origem da sujeira ou odor',
    'Isolar a área se houver risco de contaminação',
    'Registrar se o problema volta após a limpeza',
  ],
  other: [
    'Verificar se há risco para pessoas ou patrimônio',
    'Evitar mexer no equipamento sem orientação',
    'Registrar qualquer detalhe observado',
  ],
};

/** Responsável sugerido por categoria (texto livre até existirem prestadores). */
export const routingSuggestions: Record<MaintenanceCategory, string> = {
  electrical: 'Eletricista',
  plumbing: 'Encanador',
  civil: 'Manutenção civil',
  hvac: 'Técnico de climatização',
  security: 'Técnico de segurança',
  cleaning: 'Equipe de limpeza',
  other: 'Equipe de manutenção',
};

export function isMaintenanceCategory(value: unknown): value is MaintenanceCategory {
  return typeof value === 'string' && (MAINTENANCE_CATEGORIES as readonly string[]).includes(value);
}

/** Opções guiadas da categoria; categoria ausente ou desconhecida cai em "Outra". */
export function getGuidedOptions(category: string | null | undefined): GuidedOptionSet {
  return guidedOptions[isMaintenanceCategory(category) ? category : DEFAULT_CATEGORY];
}

export function getChecklist(category: string | null | undefined): readonly string[] {
  return checklists[isMaintenanceCategory(category) ? category : DEFAULT_CATEGORY];
}

export function getRoutingSuggestion(category: string | null | undefined): string {
  return routingSuggestions[isMaintenanceCategory(category) ? category : DEFAULT_CATEGORY];
}
