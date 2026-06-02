#!/bin/zsh

set -euo pipefail

sender="/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/comercial/prospeccao-mateus-rocha/scripts/send_text_with_real_newlines.sh"
profile="pessoal"

send_triplet() {
  local number="$1"
  local msg1="$2"
  local msg2="$3"
  local msg3="$4"

  "$sender" --profile "$profile" --number "$number" --text "$msg1"
  "$sender" --profile "$profile" --number "$number" --text "$msg2"
  "$sender" --profile "$profile" --number "$number" --text "$msg3"
}

send_triplet "5511988842881" \
  $'Oi, Alex. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Alex Ribeiro e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5511988718190" \
  $'Oi, Wesley. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Wesley Mendes e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5511934165086" \
  $'Oi, Alexandre. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Alexandre Batista e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5511967901940" \
  $'Oi, Ricardo. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Ricardo Silvestre e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5521991861006" \
  $'Oi, Rodrigo. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Rodrigo Gomes e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5521986946689" \
  $'Oi, Daniella. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto da Daniella Monassa e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5531987256130" \
  $'Oi, Fábio. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Fábio Junior e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5585981112421" \
  $'Oi, Matheus. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Matheus Loureiro e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5521985474249" \
  $'Oi, Ana. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto da Ana Lima e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5521970531596" \
  $'Oi, Leandro. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Leandro Guerra e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'
