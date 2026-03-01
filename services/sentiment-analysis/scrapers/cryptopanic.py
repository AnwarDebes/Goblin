"""
CryptoPanic news scraper - fetches trending crypto news posts.
"""
import asyncio
import os
from datetime import datetime, timezone
from typing import List, Optional

import httpx
import structlog
from pydantic import BaseModel

logger = structlog.get_logger()

# CryptoPanic developer endpoint (v2). v1 endpoint now returns 404.
CRYPTOPANIC_API_URL = "https://cryptopanic.com/api/developer/v2/posts/"
CRYPTOPANIC_API_KEY = os.getenv("CRYPTOPANIC_API_KEY", "")

# Map common currency symbols to trading pairs
SYMBOL_TO_PAIR = {
    "BTC": "BTC/USDT",
    "ETH": "ETH/USDT",
    "SOL": "SOL/USDT",
    "BNB": "BNB/USDT",
    "XRP": "XRP/USDT",
    "ADA": "ADA/USDT",
    "DOGE": "DOGE/USDT",
    "AVAX": "AVAX/USDT",
    "DOT": "DOT/USDT",
    "MATIC": "MATIC/USDT",
    "LINK": "LINK/USDT",
    "UNI": "UNI/USDT",
    "ATOM": "ATOM/USDT",
    "LTC": "LTC/USDT",
    "FIL": "FIL/USDT",
    "ARB": "ARB/USDT",
    "OP": "OP/USDT",
    "APT": "APT/USDT",
    "SUI": "SUI/USDT",
    "NEAR": "NEAR/USDT",
}


class NewsItem(BaseModel):
    text: str
    symbol: str
    source: str
    timestamp: datetime


class CryptoPanicScraper:
    """Fetches latest rising posts from CryptoPanic API."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or CRYPTOPANIC_API_KEY
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers={"User-Agent": "mangococo-sentiment/2.0"},
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def fetch(self) -> List[NewsItem]:
        """Fetch latest rising posts from CryptoPanic."""
        if not self.api_key:
            logger.warning("cryptopanic_no_api_key", msg="CRYPTOPANIC_API_KEY not set, skipping")
            return []

        client = await self._get_client()
        items: List[NewsItem] = []

        try:
            params = {
                "auth_token": self.api_key,
                "filter": "rising",
                "kind": "news",
            }
            resp = None
            for attempt in range(3):
                resp = await client.get(CRYPTOPANIC_API_URL, params=params)
                if resp.status_code in (429, 500, 502, 503, 504):
                    delay = min(2 ** attempt, 8)
                    logger.warning(
                        "cryptopanic_retryable_status",
                        status=resp.status_code,
                        attempt=attempt + 1,
                        retry_in_s=delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                break

            resp.raise_for_status()
            data = resp.json()

            for post in data.get("results", []):
                title = post.get("title", "")
                description = post.get("description") or ""
                published = post.get("published_at", "")
                source_data = post.get("source") or {}
                if isinstance(source_data, dict):
                    source_name = source_data.get("title", "cryptopanic")
                else:
                    source_name = str(source_data)
                currencies = post.get("currencies", []) or []
                text_blob = f"{title} {description}".lower()

                try:
                    ts = datetime.fromisoformat(published.replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    ts = datetime.now(timezone.utc)

                if currencies:
                    for currency in currencies:
                        code = currency.get("code", "").upper()
                        if not code:
                            continue
                        pair = SYMBOL_TO_PAIR.get(code, f"{code}/USDT")
                        items.append(
                            NewsItem(
                                text=(f"{title} {description}").strip(),
                                symbol=pair,
                                source=source_name,
                                timestamp=ts,
                            )
                        )
                else:
                    # v2 responses may not include explicit currencies on lower tiers.
                    # Derive symbol from title/description content.
                    for sym, pair in SYMBOL_TO_PAIR.items():
                        if sym.lower() in text_blob or pair.split("/")[0].lower() in text_blob:
                            items.append(
                                NewsItem(
                                    text=(f"{title} {description}").strip(),
                                    symbol=pair,
                                    source=source_name,
                                    timestamp=ts,
                                )
                            )
                            break

            logger.info("cryptopanic_fetched", count=len(items))
        except httpx.HTTPStatusError as e:
            logger.error("cryptopanic_http_error", status=e.response.status_code, detail=str(e))
        except Exception as e:
            logger.error("cryptopanic_error", error=str(e))

        return items
