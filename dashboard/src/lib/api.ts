import type {
  ModelStatus,
  PortfolioState,
  Position,
  SentimentData,
  Signal,
  SystemHealth,
  Trade,
} from "@/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toIso(value: unknown): string {
  if (typeof value === "string" && value.trim() !== "") return value;
  return new Date().toISOString();
}

function toSignalAction(value: unknown): Signal["action"] {
  const v = String(value || "").toLowerCase();
  if (v === "buy") return "BUY";
  if (v === "sell") return "SELL";
  return "HOLD";
}

function toPositionSide(value: unknown): Position["side"] {
  const v = String(value || "").toLowerCase();
  if (v === "short") return "short";
  return "long";
}

async function requestJson<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

function mapPortfolio(payload: unknown): PortfolioState {
  const root = asRecord(payload);
  const summary = asRecord(root.summary);

  const totalValue = asNumber(summary.total_value, asNumber(root.total_value));
  const cash = asNumber(
    summary.cash_balance,
    asNumber(root.cash_balance, asNumber(root.available_capital))
  );
  const posValue = asNumber(
    summary.positions_value,
    asNumber(root.positions_value, asNumber(root.total_unrealized_pnl))
  );
  const dailyPnl = asNumber(summary.daily_pnl, asNumber(root.daily_pnl));
  const openPositions = asNumber(
    summary.open_positions,
    asNumber(root.open_positions, asNumber(root.open_positions_count))
  );

  return {
    total_value: totalValue,
    cash_balance: cash,
    positions_value: posValue,
    daily_pnl: dailyPnl,
    open_positions: openPositions,
  };
}

function mapPosition(symbolKey: string, rawValue: unknown): Position {
  const row = asRecord(rawValue);
  return {
    symbol: String(row.symbol || symbolKey || "").toUpperCase(),
    side: toPositionSide(row.side),
    entry_price: asNumber(row.entry_price),
    current_price: asNumber(row.current_price, asNumber(row.entry_price)),
    amount: asNumber(row.amount),
    unrealized_pnl: asNumber(row.unrealized_pnl),
    stop_loss_price: asNumber(row.stop_loss_price),
    take_profit_price: asNumber(row.take_profit_price),
    opened_at: toIso(row.opened_at || row.entry_time || row.created_at),
  };
}

function mapTrade(rawValue: unknown): Trade {
  const row = asRecord(rawValue);
  const sideValue = String(row.side || "").toLowerCase();
  const side: Trade["side"] = sideValue === "short" ? "short" : "long";

  const entryPrice = asNumber(row.entry_price);
  const exitPrice = asNumber(
    row.exit_price,
    asNumber(row.close_price, asNumber(row.price, entryPrice))
  );
  const realizedPnl = asNumber(
    row.realized_pnl,
    asNumber(row.pnl, asNumber(row.total_pnl))
  );

  let pnlPct = asNumber(row.pnl_pct);
  if (pnlPct === 0 && entryPrice > 0 && exitPrice > 0) {
    const rawPct = ((exitPrice - entryPrice) / entryPrice) * 100;
    pnlPct = side === "long" ? rawPct : -rawPct;
  }

  const createdAt = toIso(row.created_at || row.entry_time || row.opened_at);
  const closedAt = toIso(
    row.closed_at || row.exit_time || row.timestamp || createdAt
  );

  return {
    symbol: String(row.symbol || "").toUpperCase(),
    side,
    entry_price: entryPrice,
    exit_price: exitPrice,
    amount: asNumber(row.amount),
    realized_pnl: realizedPnl,
    pnl_pct: pnlPct,
    exit_reason: String(row.exit_reason || row.reason || "unknown"),
    strategy: String(row.strategy || row.model_name || "ml_ensemble"),
    hold_time_seconds: asNumber(
      row.hold_time_seconds,
      asNumber(row.hold_time_minutes) * 60
    ),
    created_at: createdAt,
    closed_at: closedAt,
  };
}

function normalizeSentimentScore(score: number): number {
  // Backends may provide [-1,1], [0,1], or [0,100]. UI expects [0,100].
  if (score >= -1 && score <= 1) {
    return (score + 1) * 50;
  }
  if (score >= 0 && score <= 1) {
    return score * 100;
  }
  return Math.max(0, Math.min(100, score));
}

function mapSentiment(symbol: string, rawValue: unknown, fearGreed: number): SentimentData {
  const row = asRecord(rawValue);
  const rawScore = asNumber(row.score);

  return {
    symbol: symbol.toUpperCase(),
    score: normalizeSentimentScore(rawScore),
    momentum_1h: asNumber(row.sentiment_momentum_1h, asNumber(row.momentum_1h)),
    momentum_24h: asNumber(
      row.sentiment_momentum_24h,
      asNumber(row.momentum_24h, asNumber(row.sentiment_momentum_4h))
    ),
    volume: asNumber(row.volume, asNumber(row.sample_count)),
    fear_greed_index: fearGreed,
  };
}

export async function getPortfolio(): Promise<PortfolioState> {
  try {
    const data = await requestJson("/api/v2/portfolio");
    return mapPortfolio(data);
  } catch {
    const data = await requestJson("/api/portfolio");
    return mapPortfolio(data);
  }
}

export async function getPositions(): Promise<Position[]> {
  let data: unknown;
  try {
    data = await requestJson("/api/v2/positions");
  } catch {
    data = await requestJson("/api/positions");
  }

  const root = asRecord(data);
  const mapSource =
    Object.keys(root).length > 0 && !Array.isArray(data)
      ? root
      : asRecord((data as Record<string, unknown> | undefined)?.positions);

  return Object.entries(mapSource)
    .map(([symbol, value]) => mapPosition(symbol, value))
    .filter((p) => p.symbol.length > 0);
}

export async function getTrades(): Promise<Trade[]> {
  let data: unknown;
  try {
    data = await requestJson("/api/v2/trades");
  } catch {
    data = await requestJson("/api/trades");
  }

  const root = asRecord(data);
  const items = Array.isArray(data)
    ? data
    : Array.isArray(root.trades)
    ? root.trades
    : [];

  return items
    .map((item) => mapTrade(item))
    .sort(
      (a, b) =>
        new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime()
    );
}

export async function getSignals(): Promise<Signal[]> {
  let data: unknown;
  try {
    data = await requestJson("/api/v2/signals");
  } catch {
    data = await requestJson("/api/signals");
  }

  const items = Array.isArray(data)
    ? data
    : Object.values(asRecord(data));

  return items
    .map((raw) => {
      const row = asRecord(raw);
      return {
        signal_id: String(
          row.signal_id ||
            `${String(row.symbol || "UNKNOWN")}_${toIso(row.timestamp)}`
        ),
        symbol: String(row.symbol || "").toUpperCase(),
        action: toSignalAction(row.action),
        confidence: asNumber(row.confidence),
        price: asNumber(row.price),
        timestamp: toIso(row.timestamp),
      } as Signal;
    })
    .filter((s) => s.symbol.length > 0)
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

export async function getSystemHealth(): Promise<SystemHealth[]> {
  try {
    const data = await requestJson("/api/v2/system");
    const services = Array.isArray(asRecord(data).services)
      ? (asRecord(data).services as unknown[])
      : [];

    return services.map((raw) => {
      const row = asRecord(raw);
      const status = String(row.status || "down").toLowerCase();

      return {
        service_name: String(row.name || row.service_name || "unknown"),
        status:
          status === "healthy"
            ? "healthy"
            : status === "degraded"
            ? "degraded"
            : "down",
        uptime: asNumber(row.uptime, 0),
        last_heartbeat: toIso(row.last_heartbeat || row.timestamp),
      } as SystemHealth;
    });
  } catch {
    const statusResp = await requestJson("/status");
    const servicesMap = asRecord(asRecord(statusResp).services);

    return Object.entries(servicesMap).map(([name, info]) => {
      const row = asRecord(info);
      const healthy = Boolean(row.healthy);
      return {
        service_name: name,
        status: healthy ? "healthy" : "down",
        uptime: 0,
        last_heartbeat: new Date().toISOString(),
      } as SystemHealth;
    });
  }
}

export async function getSentiment(): Promise<SentimentData[]> {
  const data = await requestJson("/api/v2/sentiment");
  const root = asRecord(data);

  const fearGreed = asNumber(asRecord(root.fear_greed).value, 50);

  // Shape A: { symbols: { BTC/USDT: {...} }, fear_greed: {...} }
  const symbolsFromNested = asRecord(root.symbols);
  if (Object.keys(symbolsFromNested).length > 0) {
    return Object.entries(symbolsFromNested)
      .map(([symbol, value]) => mapSentiment(symbol, value, fearGreed))
      .sort((a, b) => b.score - a.score);
  }

  // Shape B: { BTC/USDT: {...}, ETH/USDT: {...} }
  const directEntries = Object.entries(root).filter(
    ([k, v]) => k !== "fear_greed" && k !== "symbols" && typeof v === "object"
  );
  if (directEntries.length > 0) {
    return directEntries
      .map(([symbol, value]) => mapSentiment(symbol, value, fearGreed))
      .sort((a, b) => b.score - a.score);
  }

  return [];
}

export async function getModelStatus(): Promise<ModelStatus[]> {
  const data = await requestJson("/api/v2/models");
  const root = asRecord(data);

  // Shape A: future/legacy array form
  const modelsArray = Array.isArray(root.models) ? (root.models as unknown[]) : [];
  if (modelsArray.length > 0) {
    return modelsArray.map((raw) => {
      const row = asRecord(raw);
      const statusRaw = String(row.status || "inactive").toLowerCase();
      return {
        model_name: String(row.model_name || row.name || "unknown"),
        version: String(row.version || "n/a"),
        accuracy: asNumber(row.accuracy, 0),
        last_retrain: toIso(row.last_retrain || row.updated_at),
        status:
          statusRaw === "active" || statusRaw === "training"
            ? (statusRaw as ModelStatus["status"])
            : "inactive",
      };
    });
  }

  // Shape B: prediction /model-status contract
  const tcnLoaded = Boolean(root.tcn_loaded);
  const xgbLoaded = Boolean(root.xgb_loaded);
  const mode = String(root.mode || "legacy").toLowerCase();
  const now = new Date().toISOString();

  return [
    {
      model_name: "tcn",
      version: String(root.tcn_version || "unavailable"),
      accuracy: tcnLoaded ? (mode === "ml" ? 0.7 : 0.55) : 0,
      last_retrain: now,
      status: tcnLoaded ? "active" : "inactive",
    },
    {
      model_name: "xgboost",
      version: String(root.xgb_version || "unavailable"),
      accuracy: xgbLoaded ? (mode === "ml" ? 0.7 : 0.55) : 0,
      last_retrain: now,
      status: xgbLoaded ? "active" : "inactive",
    },
  ];
}
