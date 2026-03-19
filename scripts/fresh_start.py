#!/usr/bin/env python3
"""
Fresh Start Script — Wipe all trading data and reset to clean state.

Connects to Redis and PostgreSQL directly (no docker/redis-cli needed).
Run from project root: python scripts/fresh_start.py

Usage:
    python scripts/fresh_start.py              # Interactive (asks for confirmation)
    python scripts/fresh_start.py --yes        # Skip confirmation
    python scripts/fresh_start.py --dry-run    # Show what would be done without doing it
"""
import argparse
import json
import os
import sys
import time

# ---------------------------------------------------------------------------
# Load environment from config/trading.env
# ---------------------------------------------------------------------------
ENV_FILE = os.path.join(os.path.dirname(__file__), "..", "config", "trading.env")


def load_env(path: str):
    """Parse KEY=VALUE lines from an env file into os.environ."""
    if not os.path.exists(path):
        print(f"[WARN] Env file not found: {path}")
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())


load_env(ENV_FILE)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))
POSTGRES_DB = os.getenv("POSTGRES_DB", "goblin")
POSTGRES_USER = os.getenv("POSTGRES_USER", "goblin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")

STARTING_CAPITAL = float(os.getenv("STARTING_CAPITAL", 1000.0))


# ---------------------------------------------------------------------------
# Redis cleanup
# ---------------------------------------------------------------------------
def clean_redis(dry_run: bool = False):
    try:
        import redis
    except ImportError:
        print("[ERROR] 'redis' package not installed. Run: pip install redis")
        return False

    print(f"\n{'='*60}")
    print(f"  REDIS CLEANUP  ({REDIS_HOST}:{REDIS_PORT})")
    print(f"{'='*60}")

    try:
        r = redis.Redis(
            host=REDIS_HOST, port=REDIS_PORT,
            password=REDIS_PASSWORD, decode_responses=True,
            socket_connect_timeout=5,
        )
        r.ping()
        print(f"  Connected to Redis")
    except Exception as e:
        print(f"  [ERROR] Cannot connect to Redis: {e}")
        return False

    # Show what exists before wiping
    db_size = r.dbsize()
    print(f"  Current keys: {db_size}")

    # Show key categories
    important_keys = [
        "positions", "portfolio_state", "risk_parameters",
        "regime_state", "exit_explanations", "latest_ticks",
    ]
    for key in important_keys:
        key_type = r.type(key)
        if key_type != "none":
            if key_type == "hash":
                count = r.hlen(key)
                print(f"    {key} ({key_type}): {count} entries")
            elif key_type == "list":
                count = r.llen(key)
                print(f"    {key} ({key_type}): {count} entries")
            elif key_type == "string":
                print(f"    {key} ({key_type}): exists")

    if dry_run:
        print(f"  [DRY RUN] Would flush all {db_size} keys")
        return True

    r.flushall()
    print(f"  FLUSHED all {db_size} keys")

    # Re-seed starting portfolio state
    portfolio_state = {
        "total_capital": STARTING_CAPITAL,
        "available_capital": STARTING_CAPITAL,
        "positions_value": 0,
        "open_positions": 0,
    }
    r.set("portfolio_state", json.dumps(portfolio_state))
    print(f"  Seeded portfolio_state: ${STARTING_CAPITAL:.2f}")

    print(f"  Redis cleanup complete")
    return True


# ---------------------------------------------------------------------------
# PostgreSQL cleanup
# ---------------------------------------------------------------------------
def clean_postgres(dry_run: bool = False):
    try:
        import psycopg2
    except ImportError:
        # Try asyncpg as fallback (already used by services)
        print("[WARN] 'psycopg2' not installed, trying asyncpg via subprocess...")
        return clean_postgres_asyncpg(dry_run)

    print(f"\n{'='*60}")
    print(f"  POSTGRESQL CLEANUP  ({POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB})")
    print(f"{'='*60}")

    try:
        conn = psycopg2.connect(
            host=POSTGRES_HOST, port=POSTGRES_PORT,
            dbname=POSTGRES_DB, user=POSTGRES_USER,
            password=POSTGRES_PASSWORD, connect_timeout=5,
        )
        conn.autocommit = False
        cur = conn.cursor()
        print(f"  Connected to PostgreSQL")
    except Exception as e:
        print(f"  [ERROR] Cannot connect to PostgreSQL: {e}")
        return False

    # Tables to clean (order matters for foreign keys)
    tables_to_truncate = [
        "trade_history",
        "portfolio_snapshots",
        "signals",
    ]

    # Show current row counts
    for table in tables_to_truncate:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            print(f"    {table}: {count} rows")
        except Exception:
            conn.rollback()
            print(f"    {table}: does not exist (skipping)")

    if dry_run:
        print(f"  [DRY RUN] Would truncate {len(tables_to_truncate)} tables and re-seed")
        cur.close()
        conn.close()
        return True

    # Truncate
    for table in tables_to_truncate:
        try:
            cur.execute(f"TRUNCATE TABLE {table} CASCADE")
            print(f"  Truncated: {table}")
        except Exception as e:
            conn.rollback()
            print(f"  [WARN] Could not truncate {table}: {e}")

    # Re-seed initial portfolio snapshot
    try:
        cur.execute(
            """INSERT INTO portfolio_snapshots (time, total_value, cash_balance, positions_value, daily_pnl)
               VALUES (NOW(), %s, %s, 0, 0)""",
            (STARTING_CAPITAL, STARTING_CAPITAL),
        )
        print(f"  Seeded portfolio_snapshots: ${STARTING_CAPITAL:.2f}")
    except Exception as e:
        conn.rollback()
        print(f"  [WARN] Could not seed portfolio_snapshots: {e}")

    conn.commit()
    cur.close()
    conn.close()
    print(f"  PostgreSQL cleanup complete")
    return True


def clean_postgres_asyncpg(dry_run: bool = False):
    """Fallback: use asyncpg via asyncio if psycopg2 is not available."""
    try:
        import asyncio
        import asyncpg
    except ImportError:
        print("[ERROR] Neither 'psycopg2' nor 'asyncpg' installed.")
        print("        Run: pip install psycopg2-binary  OR  pip install asyncpg")
        return False

    print(f"\n{'='*60}")
    print(f"  POSTGRESQL CLEANUP  ({POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB})")
    print(f"{'='*60}")

    async def _run():
        try:
            conn = await asyncpg.connect(
                host=POSTGRES_HOST, port=POSTGRES_PORT,
                database=POSTGRES_DB, user=POSTGRES_USER,
                password=POSTGRES_PASSWORD, timeout=5,
            )
            print(f"  Connected to PostgreSQL (asyncpg)")
        except Exception as e:
            print(f"  [ERROR] Cannot connect to PostgreSQL: {e}")
            return False

        tables = ["trade_history", "portfolio_snapshots", "signals"]

        for table in tables:
            try:
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
                print(f"    {table}: {count} rows")
            except Exception:
                print(f"    {table}: does not exist (skipping)")

        if dry_run:
            print(f"  [DRY RUN] Would truncate tables and re-seed")
            await conn.close()
            return True

        for table in tables:
            try:
                await conn.execute(f"TRUNCATE TABLE {table} CASCADE")
                print(f"  Truncated: {table}")
            except Exception as e:
                print(f"  [WARN] Could not truncate {table}: {e}")

        try:
            await conn.execute(
                """INSERT INTO portfolio_snapshots (time, total_value, cash_balance, positions_value, daily_pnl)
                   VALUES (NOW(), $1, $2, 0, 0)""",
                STARTING_CAPITAL, STARTING_CAPITAL,
            )
            print(f"  Seeded portfolio_snapshots: ${STARTING_CAPITAL:.2f}")
        except Exception as e:
            print(f"  [WARN] Could not seed portfolio_snapshots: {e}")

        await conn.close()
        print(f"  PostgreSQL cleanup complete")
        return True

    return asyncio.run(_run())


# ---------------------------------------------------------------------------
# Clean local caches
# ---------------------------------------------------------------------------
def clean_local(dry_run: bool = False):
    import shutil

    print(f"\n{'='*60}")
    print(f"  LOCAL CACHE CLEANUP")
    print(f"{'='*60}")

    project_root = os.path.join(os.path.dirname(__file__), "..")
    dirs_to_clean = []

    # Find __pycache__ dirs
    for root, dirs, files in os.walk(os.path.join(project_root, "services")):
        for d in dirs:
            if d == "__pycache__":
                dirs_to_clean.append(os.path.join(root, d))

    # Temporary model files
    models_dir = os.path.join(project_root, "shared", "models")
    if os.path.isdir(models_dir):
        for f in os.listdir(models_dir):
            if f.endswith(".tmp"):
                dirs_to_clean.append(os.path.join(models_dir, f))

    if not dirs_to_clean:
        print(f"  Nothing to clean")
        return True

    for path in dirs_to_clean:
        if dry_run:
            print(f"  [DRY RUN] Would remove: {path}")
        else:
            try:
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
                print(f"  Removed: {path}")
            except Exception as e:
                print(f"  [WARN] Could not remove {path}: {e}")

    print(f"  Local cleanup complete")
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Fresh Start — Wipe all trading data")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    args = parser.parse_args()

    print("""
    ╔══════════════════════════════════════════════════╗
    ║          GOBLIN FRESH START                      ║
    ║                                                  ║
    ║  This will:                                      ║
    ║    1. Flush ALL Redis data                       ║
    ║    2. Truncate trade_history, portfolio,signals   ║
    ║    3. Re-seed starting capital ($%.2f)       ║
    ║    4. Clean local __pycache__ dirs               ║
    ║                                                  ║
    ║  Running services will auto-recover with         ║
    ║  clean state on their next cycle.                ║
    ╚══════════════════════════════════════════════════╝
    """ % STARTING_CAPITAL)

    if args.dry_run:
        print("  *** DRY RUN MODE — no changes will be made ***\n")

    if not args.yes and not args.dry_run:
        answer = input("  Are you sure? Type 'yes' to continue: ")
        if answer.strip().lower() != "yes":
            print("  Aborted.")
            sys.exit(0)

    results = {}
    results["redis"] = clean_redis(dry_run=args.dry_run)
    results["postgres"] = clean_postgres(dry_run=args.dry_run)
    results["local"] = clean_local(dry_run=args.dry_run)

    print(f"\n{'='*60}")
    print(f"  SUMMARY")
    print(f"{'='*60}")
    for name, ok in results.items():
        status = "OK" if ok else "FAILED"
        print(f"    {name:.<20} {status}")

    if all(results.values()):
        print(f"\n  Fresh start complete.")
        print(f"  Starting capital: ${STARTING_CAPITAL:.2f}")
        print(f"  Services will pick up clean state automatically.")
        if not args.dry_run:
            print(f"\n  TIP: If services seem stuck, ask your admin to run:")
            print(f"       docker compose restart")
    else:
        print(f"\n  Some steps failed — check errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
