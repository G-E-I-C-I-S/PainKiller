# Política de segurança

O Guardião IFSULDEMINAS lida com a segurança patrimonial de uma instituição pública e com dados pessoais de servidores (localização nos eventos de ronda e fotos de ocorrências). Levamos vulnerabilidades a sério.

## Como reportar uma vulnerabilidade

**Não abra issue, discussão ou PR público** descrevendo a falha.

1. Use o reporte privado do GitHub: [**Report a vulnerability**](https://github.com/G-E-I-C-I-S/PainKiller/security/advisories/new) (aba *Security* do repositório).
2. Informe:
   - componente afetado (app mobile, painel web, API, infraestrutura);
   - versão ou commit;
   - passos para reproduzir;
   - impacto que você imagina (ex.: registrar visita sem estar no local, acessar fotos de outro campus);
   - se possível, uma sugestão de correção.
3. Não acesse, altere nem apague dados de terceiros além do mínimo necessário para demonstrar a falha. Não faça testes contra o ambiente de **produção** sem autorização.

## O que esperar

| Etapa | Prazo-alvo |
|---|---|
| Confirmação de recebimento | até 3 dias úteis |
| Avaliação inicial e classificação de severidade | até 7 dias úteis |
| Correção de falha crítica ou alta | o quanto antes, com hotfix fora do ciclo da sprint |
| Divulgação | coordenada com quem reportou, depois da correção |

## Escopo

Dentro do escopo: código deste repositório (app, API, painel, scripts de infraestrutura) e o desenho de segurança descrito em [docs/11-seguranca-e-lgpd.md](docs/11-seguranca-e-lgpd.md). Exemplos: autenticação e sessão, autorização por papel e por campus, sincronização offline, validação de tags NFC (SUN), validação geográfica, armazenamento local cifrado, trilha de auditoria.

Fora do escopo: engenharia social, ataques físicos às tags instaladas (reporte ao setor de vigilância), negação de serviço volumétrica e vulnerabilidades em serviços de terceiros sem impacto demonstrável no Guardião.

## Versões suportadas

| Versão | Suporte |
|---|---|
| `main` (última release) | ✓ |
| Releases anteriores | Somente falhas críticas, enquanto houver aparelhos em uso com elas |

## Segredos expostos

Se você encontrar um segredo (senha, token, chave) no histórico do repositório, reporte da mesma forma privada. O segredo será revogado e substituído imediatamente.
