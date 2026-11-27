# Instruções para o Claude Code — FixPro

**Antes de qualquer coisa, leia `HANDOFF.md`** (estado atual, decisões e próximos passos), `docs/PORTE_VERSAO_ANTIGA.md` (plano em vigor: piloto com o primeiro cliente) e `docs/PLANEJAMENTO.md` (arquitetura e roadmap de longo prazo).

@AGENTS.md

## Regras deste projeto
- Responda ao usuário em **português do Brasil**, de forma direta e didática (ele é o fundador e aprende enquanto constrói).
- **Custo zero:** não proponha nem configure serviço pago até haver cliente pagante. Ver a seção 4 e a seção 9 do plano.
- **Foco no piloto:** a pausa acabou em 2026-11-27. Construa só o que está na Sprint 1 e na Sprint 2 de `docs/PORTE_VERSAO_ANTIGA.md`; o resto espera o piloto.
- **Versão antiga** (commit `9ebb80c`, HTML/JS puro): referência de regras e listas, nunca copiar o código.
- **Evitar retrabalho:** planejar antes de mudanças grandes; não alterar layout ou regra de negócio sem validação (ver `.cursorrules`).
- **Git:** commits locais são permitidos; o **push é feito pelo usuário** no GitHub Desktop.
- Verificações antes de concluir: `npx tsc --noEmit`, `npm run lint` e, se mexer em PWA/build, `npm run build`.
