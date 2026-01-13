import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Ticker { symbol: string; price: number; change_pct: number }
interface Position { symbol: string; side: string; entry_price: number; current_price: number; amount: number; unrealized_pnl: number }
interface Portfolio { total_capital: number; available_capital: number; daily_pnl: number; open_positions: number }

function App() {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({})
  const [positions, setPositions] = useState<Record<string, Position>>({})
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [status, setStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [tickerRes, portfolioRes, statusRes] = await Promise.all([
        fetch('/api/tickers'), fetch('/api/portfolio'), fetch('/status')
      ])
      if (tickerRes.ok) setTickers(await tickerRes.json())
      if (portfolioRes.ok) {
        const data = await portfolioRes.json()
        setPortfolio(data.portfolio)
        setPositions(data.positions || {})
      }
      if (statusRes.ok) setStatus(await statusRes.json())
      setError(null)
    } catch { setError('Failed to fetch data') }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const btc = tickers['BTC/USDT']
    if (btc) {
      setPriceHistory(prev => [...prev, { time: new Date().toLocaleTimeString(), price: btc.price }].slice(-30))
    }
  }, [tickers])

  return (
    <div className="min-h-screen p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-emerald-400">🥭 MangoCoco Trading</h1>
        <p className="text-slate-400">AI-Powered Crypto Trading Dashboard</p>
      </header>

      {error && <div className="bg-red-900/50 border border-red-500 rounded p-4 mb-6">{error}</div>}

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Total Capital</p>
          <p className="text-2xl font-bold">${portfolio?.total_capital?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Available</p>
          <p className="text-2xl font-bold">${portfolio?.available_capital?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Daily P&L</p>
          <p className={`text-2xl font-bold ${(portfolio?.daily_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${portfolio?.daily_pnl?.toFixed(2) || '0.00'}
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Open Positions</p>
          <p className="text-2xl font-bold">{portfolio?.open_positions || 0}</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 mb-8">
        <h2 className="text-xl font-semibold mb-4">BTC/USDT Price</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
            <Line type="monotone" dataKey="price" stroke="#10b981" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {Object.entries(tickers).map(([symbol, ticker]) => (
          <div key={symbol} className="bg-slate-800 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">{symbol}</span>
              <span className={ticker.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {ticker.change_pct >= 0 ? '+' : ''}{ticker.change_pct?.toFixed(2)}%
              </span>
            </div>
            <p className="text-2xl font-bold mt-2">${ticker.price?.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {Object.keys(positions).length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4 mb-8">
          <h2 className="text-xl font-semibold mb-4">Open Positions</h2>
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-left">
                <th className="pb-2">Symbol</th><th className="pb-2">Side</th><th className="pb-2">Entry</th>
                <th className="pb-2">Current</th><th className="pb-2">Amount</th><th className="pb-2">P&L</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(positions).map(([symbol, pos]) => (
                <tr key={symbol}>
                  <td className="py-2">{pos.symbol}</td>
                  <td className={pos.side === 'long' ? 'text-emerald-400' : 'text-red-400'}>{pos.side.toUpperCase()}</td>
                  <td>${pos.entry_price?.toFixed(2)}</td>
                  <td>${pos.current_price?.toFixed(2)}</td>
                  <td>{pos.amount?.toFixed(6)}</td>
                  <td className={pos.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>${pos.unrealized_pnl?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status && (
        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(status.services || {}).map(([name, data]: [string, any]) => (
              <div key={name} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${data.healthy ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                <span className="capitalize">{name.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
