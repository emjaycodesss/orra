"use client";

import { useSyncExternalStore, useCallback } from "react";
import { TICKER_FEED_META } from "@/lib/ticker-feed-meta";

export interface TickerFeed {
  id: number;
  symbol: string;
  label: string;
  price: number;
  change24h: number | null;
  exponent: number;
  confidence: number;
  emaPrice: number;
  emaDivergencePct: number;
  publisherCount: number;
  spreadPct: number;
  bid: number;
  ask: number;
}

const EMPTY_FEEDS: TickerFeed[] = TICKER_FEED_META.map((m) => ({
  id: m.id, symbol: m.symbol, label: m.label, price: 0, change24h: null, exponent: 0,
  confidence: 0, emaPrice: 0, emaDivergencePct: 0, publisherCount: 0,
  spreadPct: 0, bid: 0, ask: 0,
}));

type Listener = () => void;

class TickerStripStore {
  private feeds = new Map<number, TickerFeed>();
  private prices24hAgo = new Map<number, number>();
  private listeners = new Set<Listener>();
  private eventSource: EventSource | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private historicalFetched = false;
  private hermesFallbackDone = false;
  private cachedSnapshot: TickerFeed[] = EMPTY_FEEDS;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    if (!this.eventSource) this.connect();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.disconnect();
    };
  };

  getSnapshot = (): TickerFeed[] => this.cachedSnapshot;

  private static SERVER_SNAPSHOT: TickerFeed[] = EMPTY_FEEDS;
  getServerSnapshot = (): TickerFeed[] => TickerStripStore.SERVER_SNAPSHOT;

  private connect() {
    if (typeof window === "undefined") return;
    this.disconnect();

    const es = new EventSource("/api/pyth-ticker");
    this.eventSource = es;

    es.onmessage = (event) => {
      try {
        const feeds: { priceFeedId: number; price: string; exponent: number; confidence?: string; emaPrice?: string; emaConfidence?: string; publisherCount?: number; bestBidPrice?: string; bestAskPrice?: string }[] = JSON.parse(event.data);
        feeds.forEach((f) => {
          const meta = TICKER_FEED_META.find((m) => m.id === f.priceFeedId);
          if (!meta) return;
          const exp = 10 ** f.exponent;
          const price = Number(f.price) * exp;
          const prev24h = this.prices24hAgo.get(f.priceFeedId);
          const change24h = prev24h && prev24h > 0 ? ((price - prev24h) / prev24h) * 100 : null;
          const emaRaw = f.emaPrice ? Number(f.emaPrice) * exp : 0;
          const confRaw = f.confidence ? Number(f.confidence) * exp : 0;
          const confPct = Math.abs(price) > 0 ? (confRaw / Math.abs(price)) * 100 : 0;
          const emaDivPct = Math.abs(emaRaw) > 0 ? ((price - emaRaw) / Math.abs(emaRaw)) * 100 : 0;
          const bidRaw = f.bestBidPrice ? Number(f.bestBidPrice) * exp : 0;
          const askRaw = f.bestAskPrice ? Number(f.bestAskPrice) * exp : 0;
          const spreadPctVal = Math.abs(price) > 0 && askRaw > 0 && bidRaw > 0 ? ((askRaw - bidRaw) / Math.abs(price)) * 100 : 0;
          this.feeds.set(f.priceFeedId, {
            id: f.priceFeedId, symbol: meta.symbol, label: meta.label,
            price, change24h, exponent: f.exponent,
            confidence: confPct, emaPrice: emaRaw, emaDivergencePct: emaDivPct,
            publisherCount: f.publisherCount ?? 0,
            spreadPct: spreadPctVal, bid: bidRaw, ask: askRaw,
          });
        });
        this.rebuildSnapshot();
        this.notify();
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      es.close();
      this.eventSource = null;
      this.retryTimer = setTimeout(() => {
        if (this.listeners.size > 0) this.connect();
      }, 3000);
    };

    this.fetch24hPrices();
    this.scheduleFallback();
  }

  private disconnect() {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    if (this.fallbackTimer) { clearTimeout(this.fallbackTimer); this.fallbackTimer = null; }
    this.eventSource?.close();
    this.eventSource = null;
  }

  private rebuildSnapshot() {
    this.cachedSnapshot = TICKER_FEED_META.map((m) => {
      const f = this.feeds.get(m.id);
      return f ?? { id: m.id, symbol: m.symbol, label: m.label, price: 0, change24h: null, exponent: 0,
        confidence: 0, emaPrice: 0, emaDivergencePct: 0, publisherCount: 0,
        spreadPct: 0, bid: 0, ask: 0 };
    });
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private scheduleFallback() {
    if (this.hermesFallbackDone) return;
    this.fallbackTimer = setTimeout(() => this.fetchHermesFallback(), 3000);
  }

  private async fetchHermesFallback() {
    if (this.hermesFallbackDone) return;
    this.hermesFallbackDone = true;

    const missing = TICKER_FEED_META.filter((m) => {
      const f = this.feeds.get(m.id);
      return !f || f.price === 0;
    });
    if (missing.length === 0) return;

    try {
      const idsParam = missing.map((m) => `ids[]=${m.hermesId}`).join("&");
      const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?${idsParam}&parsed=true`);
      if (!res.ok) return;
      const data = await res.json();
      const parsed: { id: string; price: { price: string; expo: number; conf: string }; ema_price?: { price: string; expo: number; conf: string } }[] = data?.parsed ?? [];
      parsed.forEach((p) => {
        const meta = missing.find((m) => m.hermesId === p.id);
        if (!meta) return;
        const exp = 10 ** p.price.expo;
        const price = Number(p.price.price) * exp;
        if (isNaN(price) || price === 0) return;
        const prev24h = this.prices24hAgo.get(meta.id);
        const change24h = prev24h && prev24h > 0 ? ((price - prev24h) / prev24h) * 100 : null;
        const confRaw = Number(p.price.conf) * exp;
        const confPct = Math.abs(price) > 0 ? (confRaw / Math.abs(price)) * 100 : 0;
        const emaRaw = p.ema_price ? Number(p.ema_price.price) * exp : 0;
        const emaDivPct = Math.abs(emaRaw) > 0 ? ((price - emaRaw) / Math.abs(emaRaw)) * 100 : 0;
        this.feeds.set(meta.id, {
          id: meta.id, symbol: meta.symbol, label: meta.label,
          price, change24h, exponent: p.price.expo,
          confidence: confPct, emaPrice: emaRaw, emaDivergencePct: emaDivPct, publisherCount: 0,
          spreadPct: 0, bid: 0, ask: 0,
        });
      });
      this.rebuildSnapshot();
      this.notify();
    } catch { /* ignore */ }
  }

  private async fetch24hPrices() {
    if (this.historicalFetched) return;
    this.historicalFetched = true;

    const ts24hAgo = Math.floor(Date.now() / 1000) - 86400;
    try {
      const params = new URLSearchParams();
      params.set("timestamp", ts24hAgo.toString());
      TICKER_FEED_META.forEach((m) => params.append("symbols", m.historySymbol));

      const res = await fetch(`/api/pyth-history-snapshot?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach((item: { symbol: string; price: number }) => {
            const meta = TICKER_FEED_META.find((m) => m.historySymbol === item.symbol);
            if (meta) this.prices24hAgo.set(meta.id, item.price);
          });
          this.rebuildSnapshot();
          this.notify();
        }
      }
    } catch { /* ignore */ }
  }
}

const tickerStore = new TickerStripStore();

export function useTickerStrip(): TickerFeed[] {
  return useSyncExternalStore(
    tickerStore.subscribe,
    tickerStore.getSnapshot,
    tickerStore.getServerSnapshot
  );
}
