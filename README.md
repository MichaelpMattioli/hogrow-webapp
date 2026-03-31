# HoGrow — Revenue Intelligence Platform

Plataforma de Revenue Management hoteleiro para consultoras que gerenciam múltiplos hotéis simultaneamente.

## Tecnologias

- **Vite** + **React 19** + **TypeScript** (strict mode)
- **Tailwind CSS v4** (via plugin Vite)
- **Recharts** — gráficos interativos
- **Lucide React** — ícones
- **React Router v7** — roteamento
- **date-fns** — manipulação de datas

## Começando

```bash
cd WEBAPP
npm install
npm run dev
```

Acesse: http://localhost:5173

## Build de Produção

```bash
npm run build
npm run preview
```

## Estrutura

```
src/
├── components/
│   ├── layout/       → Navbar, PageContainer
│   ├── ui/           → KpiCard, StatusBadge, BarBadge, ProgressBar, ToggleGroup, AnimatedNumber, FazerPorDia, SortSelector
│   ├── charts/       → PickupChart, OtbBarChart, ChartTooltip
│   ├── tables/       → CompetitorTable, BarGrid
│   └── cards/        → ClientListCard, ClientSnapCard, AlertCard, TopPerformerCard, InsightCard
├── pages/
│   ├── Home.tsx          → Painel agregado com KPIs, alertas, ranking e grid
│   ├── Clientes.tsx      → Lista ordenável de todos os hotéis
│   └── ClienteDetalhe.tsx → Análise completa (pickup, OTB, competitivo, meta, BAR, insights)
├── data/
│   ├── types.ts      → Interfaces TypeScript (Hotel, PickupEntry, OtbEntry, etc.)
│   ├── clients.ts    → Dados dos 10 hotéis (Sol Alphaville com dados reais + 9 complementares)
│   └── transforms.ts → Funções de cálculo (status, fazerPorDia, portfolio, insights)
├── hooks/
│   └── useAnimatedNumber.ts
├── lib/
│   └── utils.ts      → Formatadores (moeda, %, classes)
├── App.tsx           → Rotas com lazy loading
└── main.tsx          → Entry point
```

## Páginas

### Home (`/`)
- Hero gradient com KPIs agregados (receita total, occ média, RevPAR médio)
- Cards de alerta (hotéis warning/critical)
- Ranking top 3 RevPAR
- Grid com todos os hotéis (clicáveis)

### Clientes (`/clientes`)
- Lista de hotéis com KPIs inline
- Ordenação por RevPAR, Ocupação ou Receita
- Animação stagger nos cards
- Navegação para detalhe via click

### Detalhe (`/clientes/:id`)
- Header com status colorido e breadcrumb
- 4 KPIs animados com pickup delta
- Gráfico Pickup com toggle (OCC/DM/RevPAR)
- Gráfico OTB com cores por faixa de ocupação
- Tabela de concorrentes com highlight do hotel próprio
- Fechamento mensal com barra segmentada e "fazer por dia"
- Grade BAR com barra de preenchimento
- Leitura consolidada com insights dinâmicos

## Design

- **Paleta**: Fundo #F5F6FA, Surface #FFFFFF, Accent #3B82F6
- **Tipografia**: DM Sans (texto), JetBrains Mono (dados numéricos)
- **Border radius**: 16px (cards), 10px (internos), 6px (badges)
- **Animações**: fadeIn, cardIn com stagger delay
- **Responsivo**: 3 breakpoints (desktop, tablet 1024px, mobile 768px)

## Hotéis

| # | Hotel | Cidade | UHs | Status |
|---|-------|--------|-----|--------|
| 1 | Sol Alphaville | Barueri, SP | 100 | Saudável |
| 2 | Vitória Palace | Vitória, ES | 78 | Atenção |
| 3 | Porto Sul Resort | Ilhéus, BA | 142 | Excelente |
| 4 | Metropolitan BH | Belo Horizonte, MG | 120 | Saudável |
| 5 | Oceano Flat | Fortaleza, CE | 65 | Crítico |
| 6 | Grand Curitiba | Curitiba, PR | 95 | Excelente |
| 7 | Pousada das Galinhas | Porto de Galinhas, PE | 48 | Excelente |
| 8 | Brasília Executive | Brasília, DF | 110 | Atenção |
| 9 | Recanto Serra Gaúcha | Gramado, RS | 72 | Excelente |
| 10 | Litoral Norte Inn | Ubatuba, SP | 55 | Atenção |
