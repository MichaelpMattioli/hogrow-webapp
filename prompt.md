# HOGROW — Revenue Intelligence Platform
## Prompt de Orquestração Multi-Agente

---

## CONTEXTO DO PROJETO

Você é um sistema multi-agente responsável por construir a **HoGrow**, uma plataforma web de Revenue Management hoteleiro. O projeto deve ser criado como uma aplicação Vite + React + TypeScript na pasta `WEBAPP/`.

A plataforma atende **consultoras de RM** (como a Viviane) que gerenciam dezenas de hotéis simultaneamente. Cada hotel tem dados de ocupação, diária média, RevPAR, pickup, BAR (nível tarifário), concorrentes e metas mensais.

### Fontes de verdade no workspace

Antes de qualquer ação, o agente **DEVE** explorar as pastas do workspace para localizar:

```
WORKSPACE/
├── transcrições/          ← Transcrições de reuniões com clientes (como funciona o processo)
├── planilhas/             ← Planilhas Excel/CSV com dados reais de hotéis
│   ├── *.json             ← JSONs exportados (pickup, OTB, tarifário, acompanhamento)
│   └── *.xlsx / *.csv     ← Bases brutas por hotel
├── documentos/            ← Relatórios, análises, documentação do processo
├── referencia/            ← Arquivos de referência visual/design (JSX, screenshots)
│   └── hogrow-dashboard.jsx  ← Componente React de referência (protótipo aprovado)
└── WEBAPP/                ← PASTA DESTINO — criar o projeto aqui
```

> **INSTRUÇÃO CRÍTICA**: Execute `find . -type f -name "*.json" -o -name "*.xlsx" -o -name "*.csv" -o -name "*.txt" -o -name "*.md" -o -name "*.jsx"` na raiz do workspace para mapear TODOS os arquivos disponíveis antes de iniciar qualquer tarefa.

---

## ARQUITETURA DE AGENTES

O trabalho é dividido em **6 agentes especializados** que executam em sequência. Cada agente produz artefatos que o próximo consome.

---

### AGENTE 1 — DESCOBERTA E MAPEAMENTO

**Objetivo**: Entender o que existe no workspace e criar um inventário completo.

**Tarefas**:

1. Listar TODOS os arquivos no workspace recursivamente
2. Ler cada transcrição e extrair:
   - Nomes de hotéis mencionados
   - Indicadores citados (quais KPIs cada hotel usa)
   - Processo operacional descrito (fluxo de trabalho)
   - Dores e requisitos mencionados
   - Nomes de pessoas e seus papéis
3. Ler cada JSON/planilha e catalogar:
   - Estrutura de campos (colunas, tipos de dados)
   - Período coberto (datas)
   - Hotel(is) referenciado(s)
   - Volume de dados (linhas, completude)
4. Ler o JSX de referência (`hogrow-dashboard.jsx`) e documentar:
   - Estrutura de componentes
   - Modelo de dados esperado (interfaces/types)
   - Padrões visuais e de interação
   - Bibliotecas utilizadas

**Artefato de saída**: `WEBAPP/docs/discovery-report.md`

```markdown
# Discovery Report

## Arquivos encontrados
| Arquivo | Tipo | Hotel | Período | Campos principais |
|---------|------|-------|---------|-------------------|
| ...     | ...  | ...   | ...     | ...               |

## Hotéis identificados
- Nome, cidade, UHs, estrelas, status (se disponível)

## Modelo de dados unificado
- Campos comuns entre todas as fontes
- Campos exclusivos por hotel/fonte
- Gaps de dados identificados

## Processo operacional (da transcrição)
- Etapas do fluxo
- Indicadores usados em cada etapa
- Regras de decisão

## Decisões de design (do JSX de referência)
- Componentes, paleta, tipografia, interações
```

---

### AGENTE 2 — SETUP DO PROJETO

**Objetivo**: Criar a estrutura Vite + React + TypeScript com todas as dependências.

**Tarefas**:

1. Inicializar projeto na pasta `WEBAPP/`:

```bash
cd WEBAPP
npm create vite@latest . -- --template react-ts
npm install
```

2. Instalar dependências:

```bash
npm install react-router-dom recharts lucide-react clsx date-fns
npm install -D tailwindcss @tailwindcss/vite
```

3. Configurar Tailwind via plugin Vite (não PostCSS):

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

```css
/* src/index.css */
@import "tailwindcss";
```

4. Configurar estrutura de pastas:

```
WEBAPP/src/
├── components/
│   ├── layout/          ← Navbar, Sidebar (se necessário), containers
│   ├── ui/              ← Cards, badges, tooltips, toggles, progress bars
│   ├── charts/          ← Wrappers de gráficos Recharts
│   └── tables/          ← Tabelas de competidores, grids
├── pages/
│   ├── Home.tsx         ← Visão geral com todos os clientes
│   ├── Clientes.tsx     ← Lista de clientes com KPIs resumidos
│   └── ClienteDetalhe.tsx ← Análise completa (tendência + competitiva)
├── data/
│   ├── types.ts         ← Interfaces TypeScript
│   ├── clients.ts       ← Dados dos clientes (extraídos das planilhas)
│   └── transforms.ts   ← Funções de transformação/cálculo
├── hooks/
│   └── useAnimatedNumber.ts
├── lib/
│   └── utils.ts         ← Formatadores (moeda, porcentagem, etc.)
├── styles/
│   └── index.css        ← Tailwind + custom properties
├── App.tsx
└── main.tsx
```

5. Configurar React Router:

```tsx
// App.tsx
<Routes>
  <Route path="/" element={<Layout />}>
    <Route index element={<Home />} />
    <Route path="clientes" element={<Clientes />} />
    <Route path="clientes/:id" element={<ClienteDetalhe />} />
  </Route>
</Routes>
```

6. Configurar fonts via Google Fonts no `index.html`:
   - DM Sans (300..700) para body
   - JetBrains Mono (400, 500) para dados numéricos

**Artefato de saída**: Projeto Vite funcional com `npm run dev` rodando sem erros.

---

### AGENTE 3 — MODELAGEM DE DADOS

**Objetivo**: Transformar os dados reais do workspace em estruturas TypeScript tipadas.

**Tarefas**:

1. Definir interfaces baseadas no discovery report E no JSX de referência:

```typescript
// data/types.ts

export type HotelStatus = 'excellent' | 'healthy' | 'warning' | 'critical';

export interface PickupEntry {
  day: string;        // "03/02"
  pkOcc: number;      // variação ocupação (p.p.)
  pkDm: number;       // variação diária média (R$)
  pkRevp: number;     // variação RevPAR (R$)
}

export interface OtbEntry {
  day: string;        // "Seg", "Ter", etc.
  occ: number;        // ocupação %
  dm: number;         // diária média R$
  revpar: number;     // RevPAR R$
  receita: number;    // receita total R$
}

export interface Competitor {
  name: string;
  dm: number;
  occ: number;
  revpar: number;
  bar: string;        // "BAR 1", "BAR 2", etc.
  own?: boolean;      // true se for o hotel do cliente
}

export interface BarLevel {
  level: string;      // "RACK", "BAR 1", etc.
  value: number;      // valor em R$
}

export interface MonthlyMeta {
  total: number;      // meta total do mês
  realizado: number;  // receita já realizada
  otbVal: number;     // on the books
  forecast: number;   // previsão restante
}

export interface Hotel {
  id: number;
  name: string;
  city: string;
  uhs: number;          // unidades habitacionais
  stars: number;
  
  // KPIs atuais
  occ: number;           // ocupação OTB %
  dm: number;            // diária média R$
  revpar: number;        // RevPAR R$
  receita: number;       // receita hospedagem R$
  
  // Pickup (variação)
  pkOcc: number;
  pkDm: number;
  pkRevp: number;
  
  // Contexto
  metaPct: number;       // % da meta atingida
  barAtual: string;      // BAR vigente
  status: HotelStatus;
  
  // Séries temporais
  pickup: PickupEntry[];
  otb: OtbEntry[];
  
  // Competitivo
  competitors: Competitor[];
  
  // Tarifário
  barLevels: BarLevel[];
  
  // Meta mensal
  meta: MonthlyMeta;
}
```

2. **Extrair dados reais** das planilhas/JSONs do workspace:
   - Para cada hotel encontrado no discovery, criar um objeto `Hotel` completo
   - Preencher pickup[] a partir dos JSONs diários (ex: `10.02.2026.json`)
   - Preencher otb[] a partir dos blocos de sistema/OTB
   - Preencher competitors[] a partir dos blocos de concorrência
   - Preencher barLevels[] a partir do `TARIFARIO_26.json`
   - Preencher meta a partir de `Acompanhamento_Receitas.json`

3. Onde dados reais não existirem, gerar dados mock **coerentes e realistas**:
   - Respeitar faixas de mercado brasileiro (DM entre R$180–R$750)
   - Status derivado dos KPIs (occ < 55% = critical, < 65% = warning, < 78% = healthy, >= 78% = excellent)
   - Pickup coerente com a tendência de ocupação
   - Mínimo de 6 hotéis, idealmente 8–12

4. Criar funções de transformação:

```typescript
// data/transforms.ts
export function deriveStatus(hotel: Partial<Hotel>): HotelStatus { ... }
export function calcFazerPorDia(meta: MonthlyMeta, diasRestantes: number): number { ... }
export function aggregatePortfolio(hotels: Hotel[]): PortfolioSummary { ... }
```

**Artefato de saída**: `src/data/types.ts`, `src/data/clients.ts`, `src/data/transforms.ts` — compilando sem erros.

---

### AGENTE 4 — COMPONENTES DE UI

**Objetivo**: Construir todos os componentes visuais seguindo o padrão Apple/Lovable do JSX de referência.

**Regras de design (extraídas do protótipo aprovado)**:

- Border radius: 16px (cards), 10px (elementos internos), 6px (badges/toggles)
- Tipografia: DM Sans para texto, JetBrains Mono para números/dados
- Paleta: fundo #F5F6FA, surface #FFFFFF, accent #3B82F6, green #10B981, red #EF4444, amber #F59E0B
- Sombras sutis, bordas 1px solid #E4E8F1
- Animações de entrada: fadeIn/slideUp com stagger delay
- Tooltips dark (#161921) com radius 6px
- Status badges com cores semânticas (excellent=green, healthy=blue, warning=amber, critical=red)
- Números animados com easing cúbico

**Componentes a criar**:

```
components/
├── layout/
│   ├── Navbar.tsx              ← Barra superior fixa com logo, tabs (Home/Clientes), breadcrumb, search, avatar
│   └── PageContainer.tsx       ← Wrapper com max-width e padding
│
├── ui/
│   ├── KpiCard.tsx             ← Card de KPI com título, valor animado, delta com seta colorida, ícone
│   ├── StatusBadge.tsx         ← Badge colorido por status (Excelente/Saudável/Atenção/Crítico)
│   ├── BarBadge.tsx            ← Badge mono com nível BAR
│   ├── ProgressBar.tsx         ← Barra segmentada (realizado/OTB/forecast)
│   ├── ToggleGroup.tsx         ← Grupo de botões toggle (OCC/DM/RevPAR)
│   ├── AnimatedNumber.tsx      ← Número com animação de contagem
│   ├── FazerPorDia.tsx         ← Destaque amber com valor diário necessário
│   └── SortSelector.tsx        ← Seletor de ordenação (RevPAR/Occ/Receita)
│
├── charts/
│   ├── PickupChart.tsx         ← AreaChart com gradiente, dots, toggle de indicador
│   ├── OtbBarChart.tsx         ← BarChart com cores por faixa de ocupação + legenda
│   └── ChartTooltip.tsx        ← Tooltip customizado dark
│
├── tables/
│   ├── CompetitorTable.tsx     ← Tabela de concorrentes com highlight do hotel próprio
│   └── BarGrid.tsx             ← Grade visual de níveis BAR com barra de preenchimento
│
├── cards/
│   ├── ClientListCard.tsx      ← Card horizontal do cliente na lista (KPIs inline, barra meta, chevron)
│   ├── ClientSnapCard.tsx      ← Card compacto do hotel na Home (status dot, KPIs, barra meta)
│   ├── AlertCard.tsx           ← Card de alerta (hotéis warning/critical)
│   ├── TopPerformerCard.tsx    ← Card ranking (posição, nome, cidade, RevPAR)
│   └── InsightCard.tsx         ← Card de leitura consolidada (insights dinâmicos por status)
```

**Para cada componente**:
- Props tipadas com interface explícita
- Usar Tailwind utility classes (NÃO CSS-in-JS nem style objects)
- Animações via classes CSS custom quando necessário
- Responsivo (grid collapsa em telas menores)
- Acessibilidade básica (aria-labels em botões, roles em tabelas)

**Artefato de saída**: Todos os componentes compilando, exportados via barrel files.

---

### AGENTE 5 — PÁGINAS E INTEGRAÇÃO

**Objetivo**: Montar as 3 páginas conectando componentes + dados + roteamento.

#### Página 1: Home (`/`)

Layout:
```
┌─────────────────────────────────────────────────┐
│ Hero gradient (saudação + KPIs agregados)        │
├──────────────────────┬──────────────────────────┤
│ Requer Atenção       │ Top RevPAR               │
│ (hotéis warning/     │ (ranking top 3)          │
│  critical clicáveis) │                          │
├──────────────────────┴──────────────────────────┤
│ Todos os Hotéis (grid 3 colunas)                │
│ [snap cards clicáveis → navega para detalhe]    │
└─────────────────────────────────────────────────┘
```

Comportamento:
- KPIs agregados calculados em tempo real (soma receita, média occ, média RevPAR)
- Clicar em qualquer hotel navega para `/clientes/:id`
- Alertas filtram automaticamente por status warning + critical

#### Página 2: Clientes (`/clientes`)

Layout:
```
┌─────────────────────────────────────────────────┐
│ Header (título + contador) │ Ordenar: [RevPAR|Occ|Receita] │
├─────────────────────────────────────────────────┤
│ [Client Card - horizontal, full width]          │
│  ● Nome · Badge Status · Cidade · UHs · ★      │
│  Occ% | DM | RevPAR | Receita | PK RevP | BAR  │
│  ████████████░░░ 70.5%                    ❯     │
├─────────────────────────────────────────────────┤
│ [Client Card]                                   │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

Comportamento:
- Lista ordenável por 3 critérios
- Animação stagger nos cards
- Clicar navega para `/clientes/:id`

#### Página 3: Detalhe do Cliente (`/clientes/:id`)

Layout:
```
┌─────────────────────────────────────────────────┐
│ Header com borda-esquerda colorida + badge       │
├────────────┬────────────┬───────────┬───────────┤
│ KPI Occ    │ KPI DM     │ KPI RevPAR│ KPI Receita│
├────────────┴────────────┼───────────┴───────────┤
│ Pickup Chart (com toggle)│ OTB Bar Chart         │
├──────────────────────────┼──────────────────────┤
│ Competitor Table         │ Fechamento Mensal     │
├──────────────────────────┼──────────────────────┤
│ Grade BAR                │ Leitura Consolidada   │
└──────────────────────────┴──────────────────────┘
```

Comportamento:
- Breadcrumb na navbar: Home > Clientes > [Nome do Hotel]
- KPIs com pickup delta animado
- Toggle no gráfico de pickup (OCC/DM/RevPAR)
- Insights dinâmicos baseados nos dados reais do hotel:
  - Se pkOcc > 2 → insight positivo sobre aceleração
  - Se pkOcc entre 0-2 → warning sobre ritmo lento
  - Se pkOcc < 0 → alerta de cancelamentos
  - Se pkDm < 0 → warning de pressão na diária
  - Se pkDm >= 0 → positivo sobre estabilidade
  - Recomendação de BAR baseada na ocupação atual

**Artefato de saída**: 3 páginas funcionais com navegação completa.

---

### AGENTE 6 — POLISH, QA E BUILD

**Objetivo**: Refinar, testar e gerar build de produção.

**Tarefas**:

1. **Verificação visual**:
   - Comparar cada tela com o JSX de referência
   - Ajustar espaçamentos, tamanhos de fonte, cores, radius
   - Verificar responsividade (desktop 1440px, tablet 1024px, mobile 768px)
   - Testar animações (entrada, hover, transições)

2. **Verificação de dados**:
   - Confirmar que dados reais (das planilhas) estão corretamente mapeados
   - Verificar cálculos derivados (metaPct, fazerPorDia, agregados)
   - Confirmar que status é coerente com os KPIs

3. **Verificação funcional**:
   - Navegação Home → Clientes → Detalhe e volta
   - Breadcrumb funciona corretamente
   - Ordenação na lista de clientes
   - Toggle no gráfico de pickup
   - Todos os cliques de cards navegam corretamente

4. **Performance**:
   - Nenhum re-render desnecessário (React.memo onde aplicável)
   - Lazy loading de páginas com React.lazy/Suspense
   - Imagens otimizadas (se houver)

5. **Build**:
```bash
npm run build
npm run preview
```
   - Zero erros de TypeScript
   - Zero warnings do ESLint
   - Bundle size razoável (< 500KB gzip)

6. **Documentação final**:
   - README.md com instruções de setup
   - Decisões de arquitetura documentadas

**Artefato de saída**: Build de produção funcional em `WEBAPP/dist/`.

---

## REGRAS GLOBAIS PARA TODOS OS AGENTES

### Leitura obrigatória do workspace

```
ANTES de escrever qualquer código:
1. Liste TODOS os arquivos do workspace
2. Leia TODOS os JSONs e extraia a estrutura
3. Leia TODAS as transcrições e extraia contexto
4. Leia o JSX de referência linha por linha
5. Só então comece a implementar
```

### Padrões de código

- TypeScript strict mode
- Componentes funcionais com hooks
- Props sempre tipadas com interface (não type)
- Nomes em inglês para código, português para labels/textos da UI
- Formatação de moeda: `R$ X.XXX` (ponto como separador de milhar, conforme pt-BR)
- Formatação de percentual: `XX,X%` (vírgula decimal)
- Datas no formato brasileiro: `dd/mm/yyyy`

### Padrões de design

- NUNCA usar Inter, Roboto, Arial ou system fonts genéricas
- NUNCA usar gradientes roxos genéricos
- SEGUIR a paleta do protótipo aprovado (azul #3B82F6 como accent)
- Border radius generoso (16px nos cards)
- Espaçamento consistente (múltiplos de 4px)
- Sombras sutis, nunca pesadas
- Animações de entrada suaves (0.3-0.5s, ease-out)

### Dados do domínio hoteleiro

- **Ocupação (Occ%)**: Percentual de UHs vendidas. Bom acima de 70%.
- **Diária Média (DM)**: Receita de hospedagem / UHs vendidas. Varia muito por mercado.
- **RevPAR**: Receita por UH disponível = Occ% × DM. Principal indicador de performance.
- **Pickup**: Variação diária dos indicadores. Mostra tendência de curto prazo.
- **OTB (On The Books)**: Reservas já confirmadas para o período futuro.
- **BAR (Best Available Rate)**: Nível tarifário vigente. BAR 1 = mais barato, RACK = preço cheio.
- **Fazer por dia**: (Meta - Realizado - OTB) / Dias restantes. Mostra esforço necessário.
- **Set competitivo**: Hotéis concorrentes usados para balizamento de tarifa.

---

## CHECKLIST DE ENTREGA

Ao final de todos os agentes, verificar:

- [ ] `npm run dev` roda sem erros
- [ ] `npm run build` gera bundle sem erros
- [ ] Home mostra KPIs agregados + grid de hotéis
- [ ] Clientes mostra lista ordenável com todos os KPIs
- [ ] Detalhe mostra análise completa com 6 cards (pickup, OTB, competitivo, meta, BAR, insights)
- [ ] Navegação funciona em todas as direções
- [ ] Dados reais do workspace estão refletidos (quando disponíveis)
- [ ] Visual segue o padrão Apple/Lovable do protótipo
- [ ] Responsivo funciona em 3 breakpoints
- [ ] Zero erros TypeScript
- [ ] README.md com instruções claras

---

## EXEMPLO DE EXECUÇÃO

```
[AGENTE 1] Explorando workspace...
  → Encontrados: 3 transcrições, 8 JSONs, 2 planilhas, 1 JSX referência
  → Hotéis identificados: Sol Alphaville, Vitória Palace, Porto Sul Resort, ...
  → Gerado: WEBAPP/docs/discovery-report.md

[AGENTE 2] Criando projeto Vite...
  → npm create vite + dependências instaladas
  → Estrutura de pastas criada
  → npm run dev: ✓ compilando

[AGENTE 3] Modelando dados...
  → 8 hotéis tipados com dados reais + mock complementar
  → Interfaces definidas
  → Funções de transformação criadas

[AGENTE 4] Construindo componentes...
  → 18 componentes criados e exportados
  → Paleta e tipografia do protótipo aplicadas

[AGENTE 5] Montando páginas...
  → Home, Clientes, ClienteDetalhe funcionais
  → Navegação completa com React Router

[AGENTE 6] Polish e build...
  → Ajustes visuais finais
  → npm run build: ✓ 0 erros
  → Bundle: 287KB gzip
```