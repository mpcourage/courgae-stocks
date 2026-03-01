export interface BlueChip {
  symbol: string;
  name: string;
  sector: string;
}

export const BLUE_CHIPS: BlueChip[] = [
  // Technology (10)
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology" },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
  { symbol: "META", name: "Meta Platforms", sector: "Technology" },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology" },
  { symbol: "IBM", name: "IBM Corp.", sector: "Technology" },
  { symbol: "CSCO", name: "Cisco Systems", sector: "Technology" },
  { symbol: "ORCL", name: "Oracle Corp.", sector: "Technology" },
  { symbol: "ADBE", name: "Adobe Inc.", sector: "Technology" },
  { symbol: "INTC", name: "Intel Corp.", sector: "Technology" },
  // Consumer Discretionary (5)
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Disc." },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Disc." },
  { symbol: "HD", name: "Home Depot Inc.", sector: "Consumer Disc." },
  { symbol: "MCD", name: "McDonald's Corp.", sector: "Consumer Disc." },
  { symbol: "NKE", name: "Nike Inc.", sector: "Consumer Disc." },
  // Financials (8)
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials" },
  { symbol: "BAC", name: "Bank of America", sector: "Financials" },
  { symbol: "GS", name: "Goldman Sachs", sector: "Financials" },
  { symbol: "V", name: "Visa Inc.", sector: "Financials" },
  { symbol: "MA", name: "Mastercard Inc.", sector: "Financials" },
  { symbol: "WFC", name: "Wells Fargo & Co.", sector: "Financials" },
  { symbol: "MS", name: "Morgan Stanley", sector: "Financials" },
  { symbol: "BRK-B", name: "Berkshire Hathaway B", sector: "Financials" },
  // Healthcare (6)
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
  { symbol: "MRK", name: "Merck & Co.", sector: "Healthcare" },
  { symbol: "ABT", name: "Abbott Laboratories", sector: "Healthcare" },
  { symbol: "LLY", name: "Eli Lilly & Co.", sector: "Healthcare" },
  // Consumer Staples (5)
  { symbol: "PG", name: "Procter & Gamble", sector: "Cons. Staples" },
  { symbol: "KO", name: "Coca-Cola Co.", sector: "Cons. Staples" },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Cons. Staples" },
  { symbol: "PEP", name: "PepsiCo Inc.", sector: "Cons. Staples" },
  { symbol: "COST", name: "Costco Wholesale", sector: "Cons. Staples" },
  // Energy (4)
  { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy" },
  { symbol: "CVX", name: "Chevron Corp.", sector: "Energy" },
  { symbol: "COP", name: "ConocoPhillips", sector: "Energy" },
  { symbol: "SLB", name: "SLB (Schlumberger)", sector: "Energy" },
  // Industrials (5)
  { symbol: "BA", name: "Boeing Co.", sector: "Industrials" },
  { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
  { symbol: "HON", name: "Honeywell Intl.", sector: "Industrials" },
  { symbol: "MMM", name: "3M Co.", sector: "Industrials" },
  { symbol: "GE", name: "GE Aerospace", sector: "Industrials" },
  // Communication Services (4)
  { symbol: "DIS", name: "Walt Disney Co.", sector: "Comm. Services" },
  { symbol: "NFLX", name: "Netflix Inc.", sector: "Comm. Services" },
  { symbol: "T", name: "AT&T Inc.", sector: "Comm. Services" },
  { symbol: "VZ", name: "Verizon Communications", sector: "Comm. Services" },
  // Materials (2)
  { symbol: "LIN", name: "Linde plc", sector: "Materials" },
  { symbol: "APD", name: "Air Products & Chem.", sector: "Materials" },
  // Real Estate (1)
  { symbol: "AMT", name: "American Tower Corp.", sector: "Real Estate" },
];

export const BLUE_CHIP_SYMBOLS = BLUE_CHIPS.map((c) => c.symbol);
