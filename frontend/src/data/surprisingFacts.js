/**
 * Pre-computed “surprising facts” for the Banks tab carousel (not LLM-driven).
 * exploreQuery is natural language to send through the chat pipeline.
 */
export const SURPRISING_FACTS = [
  {
    id: '1',
    fact: 'The largest US banks by deposits are highly concentrated in a handful of institutions.',
    exploreQuery: 'top 10 banks by total deposits',
  },
  {
    id: '2',
    fact: 'Return on assets (ROA) varies widely between community banks and the largest institutions.',
    exploreQuery: 'highest ROA banks',
  },
  {
    id: '3',
    fact: 'State banking markets differ in average bank size and profitability.',
    exploreQuery: 'Texas banking landscape',
  },
  {
    id: '4',
    fact: 'Credit card lending is concentrated among banks that report significant card portfolios.',
    exploreQuery: 'top banks by credit card loans',
  },
  {
    id: '5',
    fact: 'Capital ratios help compare safety across banks of different sizes.',
    exploreQuery: 'banks with best capital ratio',
  },
  {
    id: '6',
    fact: 'Net interest margin (NIM) reflects how efficiently banks earn spread income.',
    exploreQuery: 'banks with highest net interest margin',
  },
  {
    id: '7',
    fact: 'Deposit growth trends can highlight regional or strategic shifts over time.',
    exploreQuery: 'compare deposits over time for large banks',
  },
  {
    id: '8',
    fact: 'Peer comparisons help place one bank’s metrics in context with similar-sized peers.',
    exploreQuery: 'banks similar in size to JPMorgan Chase',
  },
];
