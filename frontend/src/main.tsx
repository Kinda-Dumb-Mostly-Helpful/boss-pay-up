import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LoginGate from './components/LoginGate'
import PublicBatchView from './components/PublicBatchView'

function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  if (hash.startsWith("#/share/")) {
    const token = hash.slice("#/share/".length).split(/[/?#]/)[0];
    return token ? <PublicBatchView token={token} /> : <div style={{ textAlign: "center", padding: "4rem" }}>无效的分享链接</div>;
  }
  return <LoginGate><App /></LoginGate>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
