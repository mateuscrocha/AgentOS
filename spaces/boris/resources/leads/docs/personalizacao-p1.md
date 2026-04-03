# Personalizacao da P1

Data: 2026-03-13
Arquivo gerado: `data/segments/follow_up_p1_mensagem_pronta.csv`

## Resultado

- `personalized`: 140
- `neutral`: 6

## Regra aplicada

- Personalizar apenas quando o nome parecer claramente humano.
- Se o campo tiver sinais de grupo, marca, prefixo tecnico ou sujeira de importacao, usar mensagem neutra.

## Exemplos personalizados

- `! Denis` -> `Denis`
- `- Lucas Furlan` -> `Lucas Furlan`
- `17h30😈 Vítor Lessa` -> `Vítor Lessa`
- `2 FLAVIO RENATO` -> `Flavio Renato`
- `2.0 Ricardo Monteiro` -> `Ricardo Monteiro`
- `3 Antonieta Rocha` -> `Antonieta Rocha`
- `3 Helton Chagas` -> `Helton Chagas`
- `A Vitor Dente` -> `Vitor Dente`
- `AIC Lucas Bragagnolo` -> `Lucas Bragagnolo`
- `Ana Lefevre` -> `Ana Lefevre`

## Exemplos neutros

- `69 Vet 69` -> neutro
- `Agência Destake` -> neutro
- `DglYRgTG RodrigoK` -> neutro
- `Gambody Gambody` -> neutro
- `Veronica` -> neutro
- `minhatricologista` -> neutro