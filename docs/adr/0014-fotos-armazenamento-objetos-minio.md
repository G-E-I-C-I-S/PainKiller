# ADR-0014: Fotos em armazenamento de objetos (MinIO)

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RF13 · RN12, RN14 · UC09, UC16 · HU-024, HU-025, HU-031 · [ADR-0006](0006-armazenamento-local-cifrado.md) |

## Contexto

Cada ocorrência pode ter até 5 fotos (cerca de 0,5 MB cada depois do processamento no app). As fotos são evidência e podem conter dados pessoais de terceiros. Precisam ser guardadas com integridade (hash), servidas apenas a quem tem permissão, por tempo limitado, com acesso auditado, e fazer parte do backup. Tudo roda na infraestrutura do IFSULDEMINAS, sem serviço de nuvem obrigatório.

## Decisão

As fotos ficam num **armazenamento de objetos compatível com S3**, o **MinIO**, rodando na mesma VM:

- bucket **`guardiao-fotos`** privado, com **versionamento** ligado (nenhuma sobrescrita apaga o original);
- chave do objeto: `<campus>/<ano>/<mes>/<ocorrencia_id>/<foto_id>.jpg`; miniatura de 320 px gerada pelo worker ao lado;
- upload pela API (`PUT /ocorrencias/{id}/fotos/{fotoId}`), que confere o SHA-256 antes de gravar e torna o envio idempotente;
- leitura no painel por **URL assinada de 5 minutos**, emitida pela API depois de checar papel e escopo e auditada como `VISUALIZAR_FOTO`;
- o PostgreSQL guarda só os metadados (`foto_ocorrencia`);
- acesso ao SDK via `@aws-sdk/client-s3`, o que permite trocar o MinIO por outro serviço S3 (institucional ou de nuvem) só por configuração.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Fotos como BLOB no PostgreSQL | Um só backup, transação única | Banco cresce rápido; backups e restauração lentos; servir imagens pela API consome memória | Pior operação |
| Sistema de arquivos da VM servido pela API | Simples | Sem URLs assinadas nativas nem versionamento; a API teria de servir cada imagem | Reinventaria o que o S3 já faz |
| Serviço de nuvem (S3, GCS) | Durabilidade alta | Dados pessoais fora da instituição; custo e contratação | Premissa de hospedagem institucional |

## Consequências

**Positivas**

- Fotos nunca públicas; links expiram; todo acesso fica na auditoria.
- Upload idempotente e com integridade conferida.
- Troca de provedor sem mudar código.

**Negativas e riscos**

- Mais um serviço na VM e no backup (espelho diário com `mc mirror`, [16 · Backups](../16-implantacao-e-infraestrutura.md#9-backups-e-restauração)).
- Uma URL assinada copiada vale por até 5 minutos para quem a tiver; o risco é aceito pelo prazo curto e pela auditoria da emissão.
- A política de retenção (2 anos, proposta) exige um job de expiração quando a retenção for validada (PE04).

**O que muda no dia a dia**

- Desenvolvimento usa o MinIO do `docker-compose.dev.yml` (console em `localhost:9001`).
- Nenhum código lê ou grava fotos fora de `nucleo/arquivos` e `vigilancia/ocorrencias`.

## Referências

- [MinIO](https://min.io/docs/minio/linux/index.html) · [Presigned URLs (S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [06 · Upload de fotos](../06-sincronizacao-online-first.md#6-upload-de-fotos)
