import { Routes, Route } from 'react-router-dom'
import { RequireSession } from './components/RequireSession'
import { Welcome } from './screens/Welcome'
import { Pin } from './screens/Pin'
import { Menu } from './screens/Menu'
import { Balance } from './screens/Balance'
import { Withdraw } from './screens/Withdraw'
import { Deposit } from './screens/Deposit'
import { Statement } from './screens/Statement'
import { Receipt } from './screens/Receipt'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/pin" element={<Pin />} />
      <Route element={<RequireSession />}>
        <Route path="/menu" element={<Menu />} />
        <Route path="/balance" element={<Balance />} />
        <Route path="/withdraw" element={<Withdraw />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/statement" element={<Statement />} />
        <Route path="/receipt" element={<Receipt />} />
      </Route>
    </Routes>
  )
}
