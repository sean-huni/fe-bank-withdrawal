import { Routes, Route } from 'react-router-dom'
import { AuthenticatedLayout } from './components/AuthenticatedLayout'
import { Welcome } from './screens/Welcome'
import { Pin } from './screens/Pin'
import { Menu } from './screens/Menu'
import { Balance } from './screens/Balance'
import { Withdraw } from './screens/Withdraw'
import { Deposit } from './screens/Deposit'
import { Statement } from './screens/Statement'
import { Receipt } from './screens/Receipt'
import { PasskeyAuth } from './screens/PasskeyAuth'
import { EnablePasskey } from './screens/EnablePasskey'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/pin" element={<Pin />} />
      {/* Passkey authentication — username-less discoverable credential flow */}
      <Route path="/passkey-auth" element={<PasskeyAuth />} />
      {/* Post-PIN passkey enrollment — one-time prompt, dismissible */}
      <Route path="/enable-passkey" element={<EnablePasskey />} />
      <Route element={<AuthenticatedLayout />}>
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
