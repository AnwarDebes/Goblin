"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFamiliarStore } from "@/stores/familiarStore";
import {
  getSignals,
  getWhaleActivity,
  getSentiment,
  getPredictionCone,
  getCorrelations,
} from "@/lib/api";
import { computeMood } from "@/lib/familiar-utils";

export function useFamiliarInsights(dailyPnl: number = 0, lastTradeMinutesAgo: number = 0) {
  const { familiar, addInsight, updateMood, tickHappiness } = useFamiliarStore();

  // Tick happiness every 5 minutes
  useEffect(() => {
    const interval = setInterval(tickHappiness, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tickHappiness]);

  // Update mood based on PnL
  useEffect(() => {
    const newMood = computeMood(dailyPnl, familiar.happiness, lastTradeMinutesAgo);
    if (newMood !== familiar.mood) {
      updateMood(newMood);
    }
  }, [dailyPnl, familiar.happiness, lastTradeMinutesAgo, familiar.mood, updateMood]);

  // ── Danger Sense (uses sentiment score) ──
  const dangerSenseEnabled = familiar.unlockedAbilities.includes("danger-sense");
  const { data: sentimentData } = useQuery({
    queryKey: ["familiar-sentiment"],
    queryFn: getSentiment,
    refetchInterval: 30_000,
    enabled: dangerSenseEnabled,
  });

  useEffect(() => {
    if (!dangerSenseEnabled || !sentimentData) return;
    const fearful = sentimentData.filter((s) => s.score < -0.5);
    if (fearful.length >= 2) {
      addInsight({
        abilityId: "danger-sense",
        title: "Danger Sense Triggered!",
        message: `High fear detected across ${fearful.length} assets. Consider reducing exposure.`,
        severity: "warning",
      });
    }
  }, [dangerSenseEnabled, sentimentData, addInsight]);

  // ── Gold Nose (uses whale transactions) ──
  const goldNoseEnabled = familiar.unlockedAbilities.includes("gold-nose");
  const { data: whaleData } = useQuery({
    queryKey: ["familiar-whales"],
    queryFn: () => getWhaleActivity(5),
    refetchInterval: 60_000,
    enabled: goldNoseEnabled,
  });

  useEffect(() => {
    if (!goldNoseEnabled || !whaleData?.transactions?.length) return;
    const bigMoves = whaleData.transactions.filter((t) => t.amount_usd > 1_000_000);
    if (bigMoves.length > 0) {
      const latest = bigMoves[0];
      addInsight({
        abilityId: "gold-nose",
        title: "Whale Movement Detected!",
        message: `Large ${latest.direction} of $${(latest.amount_usd / 1_000_000).toFixed(1)}M ${latest.symbol} spotted. Significance: ${latest.significance}.`,
        severity: latest.significance === "bearish" ? "warning" : "info",
      });
    }
  }, [goldNoseEnabled, whaleData, addInsight]);

  // ── Market Whisper (uses signals) ──
  const marketWhisperEnabled = familiar.unlockedAbilities.includes("market-whisper");
  const { data: signalData } = useQuery({
    queryKey: ["familiar-signals"],
    queryFn: getSignals,
    refetchInterval: 30_000,
    enabled: marketWhisperEnabled,
  });

  useEffect(() => {
    if (!marketWhisperEnabled || !signalData?.length) return;
    const recentSignals = signalData.slice(0, 3);
    const buyCount = recentSignals.filter((s) => s.action === "BUY").length;
    const sellCount = recentSignals.filter((s) => s.action === "SELL").length;
    const sentiment = buyCount > sellCount ? "bullish" : sellCount > buyCount ? "bearish" : "neutral";
    const avgConfidence = recentSignals.reduce((sum, s) => sum + s.confidence, 0) / recentSignals.length;

    addInsight({
      abilityId: "market-whisper",
      title: "Market Whisper",
      message: `Signals are leaning ${sentiment} with ${(avgConfidence * 100).toFixed(0)}% avg confidence. ${recentSignals.length} recent signals analyzed.`,
      severity: sentiment === "bullish" ? "positive" : sentiment === "bearish" ? "warning" : "info",
    });
  }, [marketWhisperEnabled, signalData, addInsight]);

  // ── Crystal Gaze (uses prediction cone) ──
  const crystalGazeEnabled = familiar.unlockedAbilities.includes("crystal-gaze");
  const { data: predictionData } = useQuery({
    queryKey: ["familiar-predictions"],
    queryFn: () => getPredictionCone("BTCUSDT"),
    refetchInterval: 120_000,
    enabled: crystalGazeEnabled,
  });

  useEffect(() => {
    if (!crystalGazeEnabled || !predictionData) return;
    const direction = predictionData.prediction.direction;
    const confidence = predictionData.prediction.confidence;

    addInsight({
      abilityId: "crystal-gaze",
      title: "Crystal Gaze Prediction",
      message: `BTC prediction points ${direction} with ${(confidence * 100).toFixed(0)}% confidence. ${direction === "up" ? "Bullish" : "Bearish"} outlook.`,
      severity: direction === "up" ? "positive" : "warning",
    });
  }, [crystalGazeEnabled, predictionData, addInsight]);

  // ── Correlation Web ──
  const correlationWebEnabled = familiar.unlockedAbilities.includes("correlation-web");
  const { data: correlationData } = useQuery({
    queryKey: ["familiar-correlations"],
    queryFn: () => getCorrelations("30d"),
    refetchInterval: 300_000,
    enabled: correlationWebEnabled,
  });

  useEffect(() => {
    if (!correlationWebEnabled || !correlationData) return;
    const { matrix, symbols } = correlationData;
    if (!symbols?.length) return;

    let maxCorr = 0;
    let pair = ["", ""];
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const val = Math.abs(matrix[symbols[i]]?.[symbols[j]] ?? 0);
        if (val > maxCorr && val < 1) {
          maxCorr = val;
          pair = [symbols[i], symbols[j]];
        }
      }
    }

    if (maxCorr > 0.8) {
      addInsight({
        abilityId: "correlation-web",
        title: "High Correlation Alert",
        message: `${pair[0]} and ${pair[1]} show ${(maxCorr * 100).toFixed(0)}% correlation. Diversification risk detected.`,
        severity: "warning",
      });
    }
  }, [correlationWebEnabled, correlationData, addInsight]);

  return { familiar };
}
