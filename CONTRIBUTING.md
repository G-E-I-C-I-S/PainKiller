# Como contribuir com o PainKiller

Obrigado por ajudar a construir o **Guardião IFSULDEMINAS**! Este é o resumo. As regras completas estão em [docs/15-fluxo-git-e-contribuicao.md](docs/15-fluxo-git-e-contribuicao.md).

## Antes de começar

1. Leia a [visão do produto](docs/01-visao-do-produto.md) e a [arquitetura](docs/04-arquitetura.md).
2. Peça ao mantenedor (@madeiragab) para entrar no time `painkiller-dev` da organização G.E.I.C.I.S.
3. Pegue uma história que esteja em **Pronto para Sprint** no quadro do GitHub Projects e atribua a si mesmo.

## Fluxo em 6 passos

```bash
git switch develop && git pull                       # 1. parta da develop atualizada
git switch -c feature/HU-018-leitura-nfc             # 2. uma branch por história
git commit -m "feat(mobile): leitura de tag NFC (HU-018)"   # 3. commits no padrão Conventional Commits
git push -u origin feature/HU-018-leitura-nfc        # 4. envie a branch
gh pr create --base develop --fill                   # 5. abra o PR para a develop
# 6. responda à revisão — o merge é feito pelo mantenedor
```

## Regras que não se negociam

- **Nada de push direto em `main` ou `develop`.** O GitHub bloqueia, e só o mantenedor faz merge.
- **Nenhum segredo no repositório**, que é público. Use os arquivos `.env.example`.
- **Toda tela do vigilante respeita a regra dos 2 toques** ([UX](docs/09-ux-e-design-system.md)).
- **Componentes sem regra de negócio, telas sem lógica** ([app mobile](docs/08-app-mobile.md)).
- **Nada é apagado fisicamente** do banco em tabelas operacionais (RN14).
- **PR com testes** para regra de negócio e com evidência visual para mudança de interface.

## Processo

Trabalhamos com Scrum em sprints de 1 semana. Veja o [processo Scrum](docs/13-processo-scrum.md) (eventos, Definition of Ready e Definition of Done) e o [backlog e roadmap](docs/14-backlog-e-roadmap.md).

## Encontrou uma vulnerabilidade?

**Não abra issue pública.** Siga o [SECURITY.md](SECURITY.md).
