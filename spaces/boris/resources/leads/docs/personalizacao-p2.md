# Personalizacao da P2

Data: 2026-03-13
Arquivo gerado: `data/segments/follow_up_p2_mensagem_pronta.csv`

## Resultado

- `personalized`: 259
- `neutral`: 39

## Regra aplicada

- Personalizar apenas quando o nome parecer claramente humano.
- Se o campo tiver sinais de grupo, marca, prefixo tecnico, teste ou sujeira de importacao, usar mensagem neutra.

## Exemplos personalizados

- `! Aline Caio` -> `Aline Caio`
- `! Andréia Thainara` -> `Andréia Thainara`
- `! Antônio` -> `Antônio`
- `! Bruno` -> `Bruno`
- `! Bruno Stainen` -> `Bruno Stainen`
- `! Carlos luis` -> `Carlos Luis`
- `! Comercial Ana` -> `Ana`
- `! Danrlei Carlos` -> `Danrlei Carlos`
- `! Diego` -> `Diego`
- `! Eduardo` -> `Eduardo`
- `! Fabricio Padrin` -> `Fabricio Padrin`
- `! Gabriel` -> `Gabriel`

## Exemplos neutros

- `! 1Marcelino` -> neutro
- `! Teste` -> neutro
- `! krjktjd` -> neutro
- `! r` -> neutro
- `- Evolução BGT` -> neutro
- `ADS 🚀 David` -> neutro
- `Adam` -> neutro
- `Ano IV Débora` -> neutro
- `Eliana` -> neutro
- `Emerson` -> neutro
- `Francisco` -> neutro
- `George` -> neutro