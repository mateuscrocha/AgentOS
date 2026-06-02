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

send_triplet "5513996681573" \
  $'Oi, Alec. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Alec Yoshikawa e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5519982715360" \
  $'Oi, Luiz. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Luiz Fernando e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5531988494923" \
  $'Oi, Bruno. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Bruno Abreu e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5541997034576" \
  $'Oi, Diego. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Diego Loureiro e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5517981011234" \
  $'Oi, Bruno. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Bruno Espanha e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5521966832161" \
  $'Oi, Diego. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Diego Rodrigues e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5581991960351" \
  $'Oi, Jessica. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto da Jessica Vilaça e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5561992713552" \
  $'Oi, Marcelo. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Marcelo Ottoni e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5511998289910" \
  $'Oi, Felipe. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Felipe Daniel e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5571996956281" \
  $'Oi, Nicole. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto da Nicole Saback e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'
