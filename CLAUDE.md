# Instruções para o Claude Code — FixPro

**Antes de qualquer coisa, leia `HANDOFF.md`** (estado atual, decisões e próximos passos) e `docs/PLANEJAMENTO.md` (arquitetura e roadmap).

@AGENTS.md

## Regras deste projeto
- Responda ao usuário em **português do Brasil**, de forma direta e didática (ele é o fundador e aprende enquanto constrói).
- **Custo zero:** não proponha nem configure serviço pago até haver cliente pagante. Ver a seção 4 e a seção 9 do plano.
- **Construção em pausa:** nenhuma funcionalidade nova antes das decisões G0–G2 do plano.
- **Evitar retrabalho:** planejar antes de mudanças grandes; não alterar layout ou regra de negócio sem validação (ver `.cursorrules`).
- **Git:** commits locais são permitidos; o **push é feito pelo usuário** no GitHub Desktop.
- Verificações antes de concluir: `npx tsc --noEmit`, `npm run lint` e, se mexer em PWA/build, `npm run build`.
