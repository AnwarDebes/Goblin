"""Check which coins exist on MEXC and create clean list"""
import ccxt
import time

# Initialize MEXC exchange
exchange = ccxt.mexc({
    'enableRateLimit': True,
})

print("Fetching MEXC markets...")
try:
    markets = exchange.load_markets()
    usdt_pairs = [symbol for symbol in markets.keys() if symbol.endswith('/USDT')]
    print(f"Found {len(usdt_pairs)} USDT pairs on MEXC")

    # Filter for popular/liquid coins (top 100 by typical volume)
    popular_coins = [
        'BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP', 'DOGE', 'DOT', 'MATIC', 'AVAX',
        'LINK', 'UNI', 'ALGO', 'LTC', 'BCH', 'TRX', 'ETC', 'XLM', 'VET', 'ICP',
        'FIL', 'HBAR', 'NEAR', 'FTM', 'SAND', 'MANA', 'ENJ', 'GALA', 'AXS', 'CHZ',
        'SLP', 'THETA', 'EOS', 'OMG', 'ZRX', 'BAT', 'STORJ', 'ANT', 'CVC', 'PAY',
        'REQ', 'SNT', 'ADX', 'AST', 'BLZ', 'DASH', 'XEM', 'ZEC', 'XMR', 'LSK',
        'ARK', 'VTC', 'SYS', 'DGB', 'PPC', 'NAV', 'VIA', 'FTC', 'NMC', 'ANC',
        'BELA', 'JKC', 'LKY', 'MEC', 'ORLY', 'PRC', 'Q2C', 'SMC', 'BQC', 'CNC',
        'DVC', 'EVC', 'GVC', 'IVC', 'JVC', 'KVC', 'MVC', 'NVC', 'OVC', 'QVC',
        'RVC', 'SVC', 'UVC', 'WVC', 'XVC', 'AUR', 'CAPT', 'CLAM', 'DMD', 'EXCL',
        'FAIR', 'GAME', 'HUC', 'JBS', 'KIC', 'MAX', 'OPAL', 'QBK', 'RBY', 'TIT',
        'VRC', 'XJO', 'YAC', '42', '314', '365', '420', '666', '911', '1338',
        '2000', '2015', '2048', '2100', '2200', '2300', '2400', '2500', '2600',
        '2700', '2800', '2900', '3000', '3100', '3200', '3300', '3400', '3500',
        '3600', '3700', '3800', '3900', '4000', '4100', '4200', '4300', '4400',
        '4500', '4600', '4700', '4800', '4900', '5000', 'SHIB', 'CAKE', 'SUSHI',
        'COMP', 'MKR', 'YFI', 'BAL', 'REN', 'KNC', 'ZKS', 'CRV', 'YGG', 'IMX',
        'GMT', 'JASMY', 'OP', 'ARB', 'PEPE', 'WIF', 'ONDO', 'AEVO', 'ZK', 'TON',
        'NOT', 'PENGU', 'MEW', 'POPCAT'
    ]

    # Filter to coins that exist on MEXC
    valid_coins = []
    for coin in popular_coins[:150]:  # Check first 150 popular coins
        symbol = f"{coin}/USDT"
        if symbol in usdt_pairs:
            valid_coins.append(symbol)
            print(f"VALID: {symbol}")
        else:
            print(f"INVALID: {symbol}")

    print(f"\nValid coins found: {len(valid_coins)}")
    print("TRADING_PAIRS=" + ",".join(valid_coins))

    # Save to file
    with open('valid_trading_pairs.txt', 'w') as f:
        f.write("TRADING_PAIRS=" + ",".join(valid_coins) + "\n")

except Exception as e:
    print(f"Error: {e}")