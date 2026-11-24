<h1 align="center">
  🔵 🔴 🟢 🟡<br>
  Genius_Web
</h1>

<p align="center">
  <img src="https://img.shields.io/static/v1?label=HTML&message=5&color=E34F26&style=for-the-badge&logo=html5&logoColor=white"/>
  <img src="https://img.shields.io/static/v1?label=CSS&message=3&color=1572B6&style=for-the-badge&logo=css3&logoColor=white"/>
  <img src="https://img.shields.io/static/v1?label=JavaScript&message=ES6%2B&color=F7DF1E&style=for-the-badge&logo=javascript&logoColor=black"/>
  <img src="https://img.shields.io/static/v1?label=Web%20Audio&message=API&color=8A2BE2&style=for-the-badge"/>
  <img src="https://img.shields.io/static/v1?label=Firebase&message=Realtime%20Database&color=FFCA28&style=for-the-badge&logo=firebase&logoColor=black"/>
  <img src="https://img.shields.io/static/v1?label=Deploy&message=Vercel&color=000000&style=for-the-badge&logo=vercel&logoColor=white"/>
  <a href="LICENSE">
    <img src="https://img.shields.io/static/v1?label=License&message=GPL-3.0&color=blue&style=for-the-badge&logo=gnu&logoColor=white"/>
  </a>
</p>

<p align="center">
  <strong>Status do Projeto:</strong> :heavy_check_mark: Concluído<br><br>
  <a href="https://geniusweb.vercel.app/" target="_blank">
    <img src="https://img.shields.io/static/v1?label=JOGAR%20ONLINE&message=VERCEL&color=00C853&style=for-the-badge&logo=vercel&logoColor=white" alt="Acessar Genius Web na Vercel"/>
  </a>
</p>

---

## Contexto

<p align="justify">
  O <strong>Genius_Web</strong> é um projeto acadêmico desenvolvido para a disciplina de <strong>Design de Interface e Usabilidade</strong> (Prof. Emmanuel Barreto de Carvalho), do 3º período do curso de Ciência da Computação da <strong>Universidade Católica de Pernambuco (UNICAP)</strong>, no semestre 2026.2.
</p>

<p align="justify">
  A aplicação é uma releitura web responsiva e multiplataforma do clássico jogo de memória sequencial <strong>Genius (Simon)</strong>, construída com <strong>HTML5, CSS3 puro e JavaScript Vanilla (ES6+)</strong>. O jogo oferece síntese sonora em tempo real via <strong>Web Audio API</strong>, modo <strong>Multiplayer Local (1 a 4 jogadores)</strong> e modo <strong>Multiplayer Online em tempo real</strong> sincronizado pelo <strong>Firebase Realtime Database</strong>.
</p>

---

## Funcionalidades

- **Multiplayer Local (1 a 4 jogadores):** Partidas no mesmo dispositivo com revezamento de turnos e destaque visual para o jogador da vez.
- **Multiplayer Online (2 a 4 jogadores):** Criação e entrada em salas por código de convite, sala de espera controlada pelo Host e sincronização em tempo real de sequência, turnos, luzes, sons e vidas.
- **Sistema de 3 Vidas e Eliminação:** Cada jogador inicia com `3/3` vidas; ao errar a sequência perde 1 vida e, ao zerar, é eliminado. No multiplayer vence o último sobrevivente; no modo solo o objetivo é superar o recorde salvo em `localStorage`.
- **Níveis de Dificuldade:** **Fácil** (Azul), **Médio** (Amarelo) e **Difícil** (Vermelho), ajustando a velocidade de exibição da sequência.
- **Interação Híbrida:** Suporte imediato a **mouse**, **toque (touch/pointer)** e **atalhos de teclado** (`Q` Azul, `W` Vermelho, `A` Verde, `S` Amarelo).
- **Motor de Áudio Nativo:** Notas distintas geradas via **Web Audio API**, sem dependência de arquivos externos de áudio e com opção de silenciar nas configurações.
- **UI/UX Responsiva e Acessível:** Tema escuro neon adaptado para Desktops, Notebooks, Tablets e Celulares (retrato e paisagem), modo Tela Cheia, suporte a `prefers-reduced-motion`, painel central com indicador de rodada/turno e notificação contextual de regras no botão `?`.
- **Testes Unitários (TDD):** Cobertura da lógica pura do jogo (geração de sequência, validação de jogadas, turnos, vidas e eliminação) usando o runner nativo do Node.js (`node --test`).

---

## Estrutura do Projeto

```text
Genius_Web/
├── css/
│   └── style.css            # Estilos neon, animações e media queries responsivas
├── js/
│   ├── audio.js             # Síntese sonora com Web Audio API
│   ├── firebaseConfig.js    # Gerado automaticamente pelo build (ignorado pelo Git)
│   ├── gameLogic.js         # Regras de negócio puras e máquina de estados (TDD)
│   ├── main.js              # Controle de interface, eventos (mouse/touch/teclado) e fluxo
│   └── onlineService.js     # Integração em tempo real com Firebase Realtime Database
├── scripts/
│   └── build-env.js         # Lê variáveis de ambiente e gera js/firebaseConfig.js
├── tests/
│   └── gameLogic.test.js    # Suíte de testes unitários (TDD)
├── index.html               # Estrutura semântica das telas e modais
├── package.json             # Scripts de build, dev e testes
└── README.md
