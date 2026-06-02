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

send_triplet "5594984429567" \
  $'Oi, Priscila. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto da Priscila Fernandes e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5533984558282" \
  $'Oi, Daniel. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Daniel Ferreira e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5585996137007" \
  $'Oi, Marcos. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Marcos Messias e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5521951015584" \
  $'Oi, Renata. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto da Renata Canizares e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5599981382233" \
  $'Oi, Lucas. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Lucas Santiago e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5511989690665" \
  $'Oi, Paula. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto da Paula Olaf e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5562999077093" \
  $'Oi, Amanda. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto da Amanda Israel e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5547999452513" \
  $'Oi, Fabiano. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto do Fabiano Borges e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5521967314595" \
  $'Oi, Amanda. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto da Amanda Muller e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'

send_triplet "5585985494922" \
  $'Oi, Vanessa. Tudo bem?\nAqui é o Mateus, do Bóris.' \
  $'Não sei se você vai lembrar de mim agora de cabeça, mas em algum momento você teve contato com o Bóris naquele contexto da Vanessa Meneses e eu resolvi retomar isso por aqui.' \
  $'De lá pra cá, a gente fez bastante pesquisa, conversou com muitos clientes e mudou várias coisas no Bóris pra melhorar a vida de quem usa grupos de WhatsApp no dia a dia.\n\nQueria entender se isso ainda faz sentido pra você hoje.\n\nSe fizer, a gente pode conversar.'
