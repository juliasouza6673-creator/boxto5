# Tatic Pro

Prompt — Evoluir o app anexo (Escalação Cartola FC) para "Tatics Pro" (v2 — corrigida)

Vou anexar um arquivo HTML único (escalacao-cartola.html), com HTML/CSS/JS puro, sem build, que hoje faz: carregar o mercado do Cartola FC direto do navegador, escolher uma formação fixa, clicar num slot vazio → escolher o time → escolher o jogador, e um banco de reservas. Use esse arquivo como ponto de partida e transforme-o em Scouts Pro, publicado no Lovable com backend em Supabase. Implemente tudo abaixo, na ordem de prioridade da seção 14, mas o resultado final deve ter todos os itens. Esta versão corrige e substitui uma tentativa anterior que deu errado —  especialmente as seções 2, 6, 9 e 10, que mudaram de forma importante.

0. IDENTIDADE

Trocar toda ocorrência de "Minha Escalação" (título, <title>, header, comentários, nomes de variáveis/CSS) por "Tatics Pro".

Manter o tom visual (dark, BRANCO como destaque). Logotipo do header: "TATICS<span>PRO</span>", "PRO" em LARANJA, mesmo padrão do "FC" atual.

1. BACKEND — API DO CARTOLA VIA PROXY PRÓPRIO

Conectar Supabase (Lovable Cloud/Supabase nativo) ao projeto.

Criar Edge Function cartola-proxy que centraliza todas as chamadas à API pública do Cartola (base https://api.cartola.globo.com — algumas referências da comunidade usam https://api.cartolafc.globo.com; deixe a base configurável/testável e implemente fallback entre as duas se uma delas parar de responder), repassando ao frontend só o que ele precisa. Endpoints a suportar (ver lista completa na seção 13):

/mercado/status, /atletas/mercado, /mercado/destaques, /mercado/selecao, /esquemas

/clubes, /partidas e /partidas/{rodada}, /rodadas, /pos-rodada/destaques, /atletas/pontuados/{rodada}

/times?q=, /time/slug/{slug}, /time/slug/{slug}/{rodada}

Endpoints privados (/auth/time, /auth/time/salvar) — ver seção 6, tratamento à parte.

Tratar CORS explicitamente (responder OPTIONS com os headers corretos).

Cache de 5–10 minutos para os endpoints públicos que mudam pouco (/clubes, /esquemas), cache mais curto para os que mudam mais (/atletas/mercado, /mercado/status).

Retornar erro tratado ({ error: mensagem }) quando a API do Cartola estiver fora do ar ou mudar de contrato, para o front mostrar aviso amigável em vez de travar — esses endpoints não são oficialmente documentados pela Globo e podem mudar sem aviso, então o tratamento de erro precisa ser robusto (fallback + mensagem clara, nunca tela branca).

No frontend, nunca chamar api.cartola.globo.com/api.cartolafc.globo.com diretamente — sempre pela Edge Function. Remover totalmente a lógica de proxies CORS públicos (allorigins etc.).

Segredos futuros vão em Secrets do Supabase, nunca no frontend.

2. AUTENTICAÇÃO OPCIONAL (MODO CONVIDADO)

Correção importante em relação à tentativa anterior: login não pode ser obrigatório.

O app deve funcionar normalmente sem login (modo convidado): escalar times, usar o campo tático, ver estatísticas — tudo liberado sem precisar entrar.

Ao usar sem login, mostrar um aviso persistente e não intrusivo (banner fixo discreto ou toast que reaparece), com o texto: "Você está usando o app sem login. Suas alterações não serão salvas."

Oferecer login/cadastro (e-mail + senha, e Google se for simples) como opção, não como bloqueio de entrada — um botão "Entrar" visível no header, sem tela de login forçada.

Quando o usuário loga: dados passam a ser salvos de verdade (Supabase, com user_id), e o app pode oferecer migrar o que estava em memória/localStorage da sessão convidado para a conta, se ainda estiver disponível.

Quando não logado: pode usar localStorage como armazenamento temporário só daquela sessão/navegador (não sincroniza entre dispositivos), deixando claro que isso pode ser perdido.

Dados privados (campinhos, desenhos, bonecos extras, cedimentos calculados/salvos) levam user_id quando o usuário está logado; tabelas públicas (fotos oficiais, cache do mercado) continuam sem dono.

RLS habilitado nas tabelas privadas: cada usuário só acessa os próprios registros.

3. FLUXO "TIME PRIMEIRO, JOGADOR DEPOIS"

Faixa horizontal com os escudos dos 20 clubes da Série A acima do campinho (rolagem horizontal em telas pequenas), dados de /clubes + /partidas/{rodada}.

A faixa de confrontos deve rolar sozinha, de forma flutuante contínua (esquerda→direita), mostrando ao lado de cada escudo contra quem o time joga na rodada. Abaixo dela, deixe algumas dicas surgindo e sumindo, informando sobre os melhores cedimentos, jogadores com média alta no mando, cedimentos altos do time adversário, recomendando jogadores das varias posições e o porquê, baseando sempre na média do jogador em casa e da média cedida, infrome os cedimentos favoráveis, algo bem interativos pode ser tipo banner deslizando pro lado ou surgindo e sumindo, com informações relevantes. Se desejar, pode incluir também: Endpoint: https://globo.com Instruções de Formatação: 1. Gere alertas individuais baseados APENAS nas mudanças detectadas entre os dados anteriores e os atuais. 2. Use frases curtas, tom dinâmico e focado em dar dicas ou avisos úteis para quem está montando o time. 3. Utilize emojis específicos no início de cada tipo de notícia para categorizar o alerta. 4. Inclua sempre o nome do jogador, a posição e o clube (se disponíveis no JSON). Categorias de Notícias e Regras de Escrita: 🚨 NOTÍCIA DE STATUS (Lesão, Suspensão ou Retorno) - Gatilho: O campo "status_id" mudou. - Regra: Identifique a mudança (Ex: se mudou de "Provável" para "Contundido/Dúvida", avise sobre o desfalque. Se mudou de "Contundido" para "Provável", avise que ele virou opção). - Exemplo: "🚨 ALERTA DE DESFALQUE: O atacante Pedro, do Flamengo, mudou de status para 'Contundido' e virou dúvida para a rodada. Tire ele do seu time!" 📉/📈 NOTÍCIA DE MERCADO (Valorização ou Desvalorização extrema) - Gatilho: O campo "preco_num" mudou drasticamente após o fechamento do mercado ou houve grande variação. - Regra: Mostre o valor atual e o impacto nas Cartoletas. - Exemplo: "📉 QUEDA DE PREÇO: O meia Arrascaeta desvalorizou e agora custa 14 cartoletas. Uma ótima oportunidade para comprar barato!" 🔥 NOTÍCIA DE TENDÊNCIA (Mais Escalados / Destaques) - Gatilho: Entrada de dados do endpoint de destaques ou aumento massivo no volume de escalações de um atleta. - Regra: Destaque os jogadores que estão virando unanimidade na rodada. - Exemplo: "🔥 TENDÊNCIA: O atacante Hulk já foi escalado por mais de 500 mil times e lidera as intenções de voto para capitão da rodada!" 

Clicar num confronto mostra os dados da partida e a lista de todos os jogadores prováveis e dúvida do confronto em seu time, junto ao nome e foto, mostre a média do jogador no mando x média cedida,  e sendo possível clicar no jogador para ver as informações dele na seção 9.  Seria uma versão simplificada das informações da seção 9.

Em condições normais ao clicar numa posição vazia, mostrar direto os jogadores disponíveis de qualquer time para aquela posição, filtrando por status — só prováveis, dúvida e nulo; nunca contundidos e suspensos.

Botão "Trocar time" dentro do modal de seleção, sem sair do fluxo.

Cada jogador escalado no campinho precisa de um "×" pequeno e visível, sempre acessível (ex.: canto do avatar), para remover aquele jogador daquela posição com um único clique/toque — sem precisar abrir o modal inteiro de novo.

Botão para limpar toda a escalação do campinho ativo.

4. CAMPO TÁTICO EDITÁVEL

Jogadores arrastáveis livremente (mouse e touch), posição salva como {x, y} percentual livre.

Trocar formação: nunca remove jogadores já escalados automaticamente. Só pergunta qual jogador remover se a nova formação tiver menos posições daquele tipo do que jogadores hoje preenchidos.

Usar GET /esquemas (via proxy) como fonte dos esquemas táticos disponíveis, em vez de lista fixa no código.

Botão de travar/destravar posições (toggle), para não arrastar sem querer.

Ferramentas de desenho alinhadas verticalmente no lado esquerdo do campinho: caneta livre, texto, cor, espessura, borracha (apaga só o traço tocado), "Limpar desenhos".

Texto criado vira um balãozinho móvel e removível (arrastar para mover, "×"/toque longo para excluir).

Botão "+ Jogador" discreto no canto superior direito para boneco extra livre (não ocupa posição principal), removível a qualquer momento.

Mova o botão "Ferramentas avançadas" para ao lado do nome do campinho. Essa ferramenta vai possibilitar escalar vários jogadores de uma vez. Quando clicar me de essas opções: Escolha o time: Todos os escudos dos times para ser selecionado e dai  Escalar: " Time inteiro" junto a miniatura de um campinho completo se clicado, preenche automaticamente o campinho com jogadores prováveis e dúvida do time do escudo selecionado; "Defesa" junto a miniatura de um campinho mostrando apenas gol, laterais, zagueiro e técnico e se escolhido preencha todas essas posições no campinho com os jogadores do time selecionado; "Meias" junto com o campinho miniatura mostrando apenas meias e preencha com os jogadores dessa posição do time selecionado, e "Ataque" junto com o campinho miniatura mostrando apenas ataque e preencha com os jogadores dessa posição do time selecionado.

Camada de desenho em SVG/<canvas> sincronizada ao pitch-wrap.

Persistir posições livres, desenhos e bonecos por campinho (associado ao usuário, se logado; local, se convidado). Diminua bem o circulo do jogador pra ficar melhor visulização na versão mobile. Coloque um botão para resetar e retornar os criculos dos jogadores para a posição original. Coloque o circulo icone do GOL mais abaixo centralizado, e deixe os zagueiros um pouco mais recuado dos laterais.

Layout: campinho mais próximo do topo da página, boas margens laterais aproveitadas.

5. MÚLTIPLOS CAMPINHOS

Botão "+ Adicionar campinho" cria campo tático independente (mesmas ferramentas, formação e reservas próprias).

Título editável, formação própria, estado salvo próprio por campinho.

Excluir (com confirmação) e reordenar campinhos.

Seletor de formação como dropdown discreto no canto inferior esquerdo do campinho.

6. CABEÇALHO: CARTOLETAS, CONFRONTOS E COUNTDOWN

Countdown de fechamento do mercado no topo da tela, cronômetro regressivo no formato exato "X dias, X horas, X minutos e X segundos", alimentado por GET /mercado/status.

Confrontos da rodada (mesma faixa da seção 3), via GET /partidas/{rodada}.

Cartoletas do meu time real (opcional/avançado): se eu quiser ver o saldo de cartoletas do meu time oficial do Cartola, isso depende do endpoint privado GET /auth/time, que exige autenticação própria do Cartola FC (diferente do login do Scouts Pro) — trate como uma integração opcional, com um fluxo separado e claramente identificado como "conectar meu time do Cartola" (o usuário informaria as próprias credenciais/token do Cartola, guardadas com segurança em Secrets/tabela protegida, nunca expostas no frontend). Se essa integração não estiver configurada, simplesmente não mostrar esse número — não travar nem exigir isso do usuário. Trate POST /auth/time/salvar da mesma forma, como recurso opcional de "enviar escalação para o Cartola oficial", não como parte obrigatória do fluxo.

Valor total do time montado no Scouts Pro (soma dos jogadores escalados naquele campinho) continua sendo mostrado no canto inferior direito do campinho, próximo ao técnico, atualizado em tempo real. Isso é sempre calculável (não depende de /auth/time) e é o valor principal do dia a dia.

7. VISUAL DO CAMPO E DOS JOGADORES

Gramado com gradiente mais rico, linhas nítidas, sombra suave, textura listrada sutil.

Avatares maiores, circulares, borda colorida por status, sombra leve.

Nome e preço em chip pequeno abaixo do avatar, sem sobrepor jogador vizinho em formações lotadas.

Mobile-first.

8. FOTOS OFICIAIS DOS JOGADORES

Fonte: dataset MatheusBViana/cartola-imagens-oficiais, arquivo cartola_extensao/scripts/cartola_imgs.js.

Na Edge Function/job periódico: baixar, parsear os blocos const NOME = {...} por clube com regex/AST seguro (nunca eval), gerar mapa nome_normalizado → url_foto.

Normalizar nomes (maiúsculas, sem acento) tanto do dataset quanto do apelido da API do Cartola.

Salvar em tabela pública player_photos, atualizando periodicamente (ex.: 1x/dia).

Fallback: player_photos → foto padrão da API do Cartola → avatar genérico com cor do status.

Considerar cache das imagens no Supabase Storage.

9. POP-UP DO JOGADOR — ABA "GERAL" E ABA "CEDIMENTOS PARA O JOGADOR"

Abrir o pop-up clicando na foto do jogador já escalado (não em ícone "i"). Pop-up centralizado, sem sobrepor outros elementos, max-height: 70vh com scroll interno, z-index acima de tudo, fecha ao clicar fora/Esc/tocar outro jogador; em telas pequenas abre como bottom sheet. Duas abas: Geral e Cedimentos para o Jogador. Foto + nome, posição, time, se joga contra ou em casa e contra qual time e mostre todos os scouts gerais, sendo os positivos de verde e negativos de vermelho, como se fosse um card de apresentação buscando na API. 

9.1 Aba "Geral" (dados oficiais, via /atletas/mercado + /atletas/pontuados/{rodada} + /partidas/{rodada})

Dados principais direto na tela, sem precisar expandir:

Preço, Média Geral Última, Pontuação, Jogos

Se posição for Zagueiro, Atacante, Lateral ou Meia: também Desarmes

Se posição for Goleiro: também Defesas

Botão "Mostrar Tudo": expande e mostra a lista completa dos demais dados/scouts do atleta disponíveis na API.

Últimas pontuações no mando em que vai jogar: primeiro verificar (via /partidas/{rodada}) se o jogador joga em casa ou fora nesta rodada; a partir disso, buscar no histórico (/atletas/pontuados/{rodada} das rodadas anteriores) as últimas pontuações desse jogador apenas nos jogos em que ele jogou nesse mesmo mando, listar os scouts (verde positivos, vermelho negativos) que ele produziu em cada uma, e informe a média do jogador, o mando, somando as 5 últimas pontuções dele naquele mando das últimas 5 rodadas. Exemplo: Jogador A vai jogar fora, busque as últimas 5 rodadas que ele jogou fora, some as pontuações dele e divida por 5 pra obter essa média.

Remover qualquer explicação de "Score" que exista no pop-up.

Trocar o termo "Variação" por "Desvalorização" (quando negativa) ou "Valorização" (quando positiva).

Scouts sempre centralizados, separados por vírgula, positivos em verde e negativos em vermelho. Os scouts acumulados do jogador aparecem logo abaixo do nome, no topo do pop-up, só os símbolos/valores (sem legenda extra), bem espaçados.

9.2 Aba "Cedimentos para o Jogador" (substitui "Minha Análise" — 100% automática, sem digitação manual)

Tudo nesta aba vem da API (/partidas/{rodada} + /atletas/pontuados/{rodada} + /atletas/mercado), cruzado pelo app. O usuário não digita nada aqui.

Verificar o adversário da rodada e o mando do meu jogador (ex.: Time A em casa contra Time B fora).

 Buscar os últimos 5 jogos desse adversário (Time B) e levantar todos os jogadores da mesma posição do meu jogador que jogaram contra o Time B nesses jogos, no mando equivalente (mesma lógica de mando da seção 9.1: se o meu jogador joga em casa, considerar jogos em que jogadores dessa posição enfrentaram o Time B jogando em casa; se joga fora, jogando fora).

Listar cada jogador considerado com: nome, rodada, scouts daquele jogo e pontuação — centralizado, em lista, fácil de ver, scout positivo em verde e negativo em vermelho.

Bloco "Cedimentos Gerais":

Média Cedida = soma das pontuações desses jogadores dividida pela quantidade de jogos encontrados.

Média Básica Cedida = média (últimas 5 rodadas) dos pontos obtidos via scouts positivos específicos, excluindo gols e assistências, somando os jogadores da posição que enfrentaram o adversário e dividindo pelo total de jogos. Pesos:

Posições de linha: FT (Finalização na Trave) +3.0; FD (Finalização Defendida) +1.2; FF (Finalização Fora) +0.8; FS (Falta Sofrida) +0.5; DS (Desarme) +1.2.

Goleiro (exclusivo): DE (Defesa) +1.0; DP (Defesa de Pênalti) +7.0.

Assistências Cedidas = soma das assistências que o adversário cedeu a jogadores daquela posição nas últimas 5 rodadas (mesmo mando).

Gols Cedidos = soma dos gols cedidos a jogadores daquela posição nas últimas 5 rodadas (mesmo mando).

Mostrar lado a lado: Média do Jogador no mando (seção 9.1) e Média Cedida (acima). Campo "Pontuação Esperada" = Média do jogador no mando + Média Cedida (substitui o antigo campo "Diferença").

Dica tática: recomendar o jogador quando o cedimento do adversário for alto, especialmente se próximo ou maior que a média do jogador no mando; não recomendar quando a média do jogador no mando for baixa e o cedimento for muito pouco. Ao mostrar a lista de jogadores no campinho, bote uma estrelinha para identificar os jogadores recomendados.

 "Dica Tática — melhores confrontos da rodada": no card de cada jogador insira essa informação.  Para todas as análise acima um ponto de atenção: O JOGADOR PODE TER MÉDIA ALTA E TER POUCOS JOGOS, ASSIM PODE ENGANAR. Leve em conta que quantos mais jogos, mais confiável é a média e o cedimento. Se o jogador tiver poucos jogos, seja ponderado, talvez um peso um pouco menor. O cenário perfeito é a cota de maior jogos, maior média feita e cedida. 

9.3 "Enfrenta" automático (sem digitação)

Remover totalmente a necessidade de digitar manualmente "Jogador(es) que enfrenta" — isso não existe mais como campo de texto.

Cruzar automaticamente as escalações prováveis/dúvida de ambos os clubes (/atletas/mercado + /partidas/{rodada}) segundo a posição:

Atacante → enfrenta o(s) Zagueiro(s) do adversário.

Lateral Direito → enfrenta o Lateral Esquerdo do adversário (e vice-versa). Se não houver separação entre Direito e Esquerd, considere laterais x laterais

Meia → enfrenta o(s) Meia(s) do adversário.

Zagueiro → enfrenta o(s) Atacante(s) do adversário.

Goleiro → enfrenta o(s) Atacante(s) do adversário.

Popular automaticamente o "Enfrenta:" ao passar o mouse/tocar no jogador, considerando só prováveis e dúvida dos dois times.

10. COMPARAR JOGADORES.

No card do Jogador, me dê essa opção "Comparar com outro jogador" e me dê as mesmas informações dos jogadores alinhadas para compará-los. Janela de comparação sempre centralizada na tela (hoje abre deslocada para baixo — corrigir).

Campos nativos da API (preço, média, jogos, scouts individuais etc.).

Campos da aba Geral (Preço, Média, Última Pontuação, Jogos, Desarmes/Defesas conforme posição).

Campos de Cedimentos Gerais (Média Cedida, Média Básica Cedida, Assistências Cedidas, Gols Cedidos).

Mostrar a comparação apenas com as métricas, lado a lado por jogador (colunas alinhadas), layout clean e centralizado — foto nome, preço no topo e as métricas abaixo. Use também as informações da seção 9.

11. ATUALIZAÇÃO EM SEGUNDO PLANO

Atualizar status dos jogadores, pontuações, escalações prováveis e "Dica Tática" em segundo plano, com frequência maior, mas de forma discreta: sem recarregar a página, sem loading global bloqueando a tela.

Polling silencioso/revalidação incremental de /mercado/status e /atletas/mercado, com indicador sutil no estilo "Atualizado às 14:32".

12. FOTOS OFICIAIS — (mantido, ver seção 8)

13. REFERÊNCIA DE ENDPOINTS DA API DO CARTOLA (usar via cartola-proxy)

Públicos (sem autenticação):

GET /mercado/status — status do mercado, rodada atual, prazos.

GET /atletas/mercado — jogadores, preços, scouts, status, variações, médias.

GET /mercado/destaques — mais escalados na rodada.

GET /mercado/selecao — "Seleção da Galera".

GET /esquemas — esquemas táticos permitidos.

GET /clubes — times da Série A (nomes, abreviações, escudos).

GET /partidas ou GET /partidas/{rodada} — confrontos da rodada.

GET /rodadas — calendário de rodadas.

GET /pos-rodada/destaques — maiores pontuadores após fechamento da rodada.

GET /atletas/pontuados/{rodada} — pontuação e scouts detalhados por rodada.

GET /times?q={nome} — busca times pelo nome do time/dono.

GET /time/slug/{slug} — informações e última escalação de um time público.

GET /time/slug/{slug}/{rodada} — escalação/pontuação de um time em rodada passada.

Privados/não documentados oficialmente (tratar como opcionais, ver seção 6):

GET /auth/time — cartoletas/time do usuário logado no Cartola oficial.

POST /auth/time/salvar — enviar escalação ao Cartola oficial.

Mapeamento função → endpoint:

Funcionalidade Endpoint Cabeçalho: confrontos + countdown /partidas/{rodada} + /mercado/status Cartoletas do time real (opcional) /auth/time Status Provável/Dúvida/Suspenso/Contundido /atletas/mercado Escalar time inteiro /atletas/mercado + /clubes Aba Geral + Cedimentos Gerais /atletas/mercado + /atletas/pontuados/{rodada} Histórico do jogador e do adversário /partidas/{rodada} + /atletas/pontuados/{rodada} Dica Tática calculado no app a partir do cruzamento acima "Enfrenta" automático /atletas/mercado + /partidas/{rodada} Esquema tático do campinho /esquemas Atualização discreta em background polling em /mercado/status + /atletas/mercado Envio final da escalação (opcional) /auth/time/salvar

14. PRIORIDADE DE IMPLEMENTAÇÃO

Renomear para Scouts Pro.

Backend/Edge Function cartola-proxy cobrindo os endpoints públicos da seção 13 + remoção dos proxies CORS.

Modo convidado + login opcional (seção 2) — nunca bloquear o app por falta de login.

Fluxo time → jogador com escudos, /partidas/{rodada}, Feeramentas avaçadas preenchimento automático por time ativo, filtro de status e "×" de remoção rápida por jogador.

Countdown de fechamento do mercado + valor do time no canto inferior direito do campinho.

Visual dos ícones/campo.

Fotos oficiais via dataset do GitHub.

Campo tático editável: drag livre com trava, desenho com balão de texto, bonecos extras, ferramentas verticais à esquerda, /esquemas para formações, layout mais compacto.

Múltiplos campinhos com seletor de formação discreto. Me de a opção de salvar o campinho como jpeg ou pdf. Ao lado do nome do aplicativo, me dê um botão escrito, 
"Melhores opções para rodada". Quando clicar abra uma janela mostrando os top 5 jogadores por posição e considere o número de jogos um peso, quanto mais jogos mais acertada é a média. O critério são jogadores que tem maior média no campo e maior cedimento adversário. Me de a média do jgador, quem ele enfrenta e o cedimento. Dê a opção de exportar essas análises por pdf.

Pop-up do jogador: aba Geral (médias por mando) + aba Cedimentos para o Jogador 100% automática + "Enfrenta" automático — parte mais complexa.

Comparador de jogadores corrigido, com checklist de métricas. Quanto mais jogos, maior peso. Pode deixar os confrontos dos times em texto,  onde for possível, de prioridade em usar os ícones dos escudos. EX:  Escudo Time A x Escudo Time B, ou jogador X enferenta o Time B escudo, para mostrar o confronto do jogador.

Atualização silenciosa em segundo plano.

Integração opcional com /auth/time e /auth/time/salvar, só se eu pedir explicitamente para "conectar meu time do Cartola".

Não altere comportamentos fora desse escopo sem necessidade.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://boxto5.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6f3f8b47-5f9e-4757-bfea-aff45234291b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
