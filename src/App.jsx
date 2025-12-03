import { useMemo, useState } from 'react'
import './App.css'
import { createPublicClient, createWalletClient, custom, http, parseUnits, formatUnits } from 'viem'
import { polygon } from 'viem/chains'
import Plans from './components/Plans'

function App() {
  const [account, setAccount] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [address] = useState('0x7aDEE88c5fbc6D48cE5D7b2A0f3448AFa75ac057')
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState('')
  const [success, setSuccess] = useState('')
  const [stakingTokenAddress, setStakingTokenAddress] = useState('0x760DC9a5197C9400D82dA44Bb57e0176cf102F40')
  const [stakingTokenDecimals, setStakingTokenDecimals] = useState(18)
  const rewardsTokenAddress = '0x03BF9202D2b7FAf18805f2C450Cca74d5FC9fe1A'
  const [rewardsTokenDecimals, setRewardsTokenDecimals] = useState(18)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositPlan, setDepositPlan] = useState(0)
  const [withdrawRewardAmount, setWithdrawRewardAmount] = useState('')
  const [page, setPage] = useState('home')
  const [contractRewardsBalance, setContractRewardsBalance] = useState('')
  const [userStakeAmount, setUserStakeAmount] = useState('')
  const [pendingRewards, setPendingRewards] = useState('')
  const [STAKING_TOKEN_BALANCE_UNUSED, setStakingTokenBalance] = useState('')
  const [REWARDS_TOKEN_BALANCE_UNUSED, setRewardsTokenBalance] = useState('')
  const [USER_PLAN_UNUSED, setUserPlan] = useState(null)
  const [STAKE_START_TIME_UNUSED, setStakeStartTime] = useState(null)
  const [LAST_CLAIM_UNUSED, setLastClaim] = useState(null)
  const [REWARD_RATE_UNUSED, setRewardRate] = useState('')
  const [ownerAddress, setOwnerAddress] = useState(null)

  const potentialRewards = useMemo(() => {
    const amt = Number(depositAmount || 0)
    const planPct = depositPlan === 1 ? 0.10 : depositPlan === 2 ? 0.06 : depositPlan === 3 ? 0.02 : 0
    if (!amt || !planPct) return ''
    const val = amt * planPct
    return String(val.toFixed(4))
  }, [depositAmount, depositPlan])

  const hasEthereum = typeof window !== 'undefined' && window.ethereum

  const walletClient = useMemo(() => {
    if (!hasEthereum) return null
    return createWalletClient({ chain: polygon, transport: custom(window.ethereum) })
  }, [hasEthereum])

  const publicClient = useMemo(() => {
    return createPublicClient({ chain: polygon, transport: http() })
  }, [])

  const connect = async () => {
    try {
      setError('')
      setSuccess('')
      if (!hasEthereum) {
        setError('No injected wallet found')
        return
      }
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(accounts?.[0] || null)
      if ((accounts?.[0] || null)) setPage('dashboard')
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }],
        })
      } catch {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x89',
              chainName: 'Polygon Mainnet',
              nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
              rpcUrls: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
              blockExplorerUrls: ['https://polygonscan.com'],
            }],
          })
        } catch (addErr) {
          setError(String(addErr?.message || addErr))
        }
      }
      await refreshDashboard()
      if (window.ethereum && window.ethereum.on) {
        try {
          window.ethereum.on('accountsChanged', async (accs) => { setAccount(accs?.[0] || null); setPage(accs?.[0] ? 'dashboard' : 'home'); await refreshDashboard() })
          window.ethereum.on('chainChanged', async () => { await refreshDashboard() })
        } catch (err) { void err }
      }
    } catch (err) {
      setError(String(err?.message || err))
    }
  }

  const stakingAbi = useMemo(() => ([
    { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [], outputs: [] },
    { type: 'function', name: 'deposit', stateMutability: 'nonpayable', inputs: [ { name: 'amount', type: 'uint256' }, { name: '_plan', type: 'uint8' } ], outputs: [] },
    { type: 'function', name: 'withdrawRewardTokens', stateMutability: 'nonpayable', inputs: [ { name: 'amount', type: 'uint256' } ], outputs: [] },
  ]), [])

  const erc20Abi = useMemo(() => ([
    { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [ { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' } ], outputs: [ { type: 'bool' } ] },
    { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [ { type: 'uint8' } ] },
    { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [ { name: 'owner', type: 'address' } ], outputs: [ { type: 'uint256' } ] },
    { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [ { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' } ], outputs: [ { type: 'bool' } ] },
    { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [ { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' } ], outputs: [ { type: 'uint256' } ] },
  ]), [])

  const ensureStakingDecimals = async () => {
    try {
      const dec = await publicClient.readContract({ address: stakingTokenAddress, abi: erc20Abi, functionName: 'decimals' })
      setStakingTokenDecimals(Number(dec))
      return Number(dec)
    } catch {
      return stakingTokenDecimals
    }
  }

  const ensureRewardsDecimals = async () => {
    try {
      const dec = await publicClient.readContract({ address: rewardsTokenAddress, abi: erc20Abi, functionName: 'decimals' })
      setRewardsTokenDecimals(Number(dec))
      return Number(dec)
    } catch {
      return rewardsTokenDecimals
    }
  }

  const simulateAndWrite = async (config) => {
    const { request } = await publicClient.simulateContract(config)
    const tx = await walletClient.writeContract(request)
    return tx
  }

  const refreshDashboard = async () => {
    try {
      setError('')
      if (!publicClient || !account) return
      try {
        const dec = await publicClient.readContract({ address: stakingTokenAddress, abi: erc20Abi, functionName: 'decimals' })
        setStakingTokenDecimals(Number(dec))
      } catch (err) { void err }
      try {
        const decR = await publicClient.readContract({ address: rewardsTokenAddress, abi: erc20Abi, functionName: 'decimals' })
        setRewardsTokenDecimals(Number(decR))
      } catch (err) { void err }
      try {
        const bal = await publicClient.readContract({ address: stakingTokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
        setStakingTokenBalance(formatUnits(bal, stakingTokenDecimals))
      } catch (err) { void err }
      try {
        const balR = await publicClient.readContract({ address: rewardsTokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
        setRewardsTokenBalance(formatUnits(balR, rewardsTokenDecimals))
      } catch (err) { void err }
      try {
        const cBalR = await publicClient.readContract({ address: rewardsTokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
        setContractRewardsBalance(formatUnits(cBalR, rewardsTokenDecimals))
      } catch (err) { void err }
      const stakeInfoCandidates = [
        { type: 'function', name: 'stakers', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }] },
        { type: 'function', name: 'getStakeInfo', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] },
        { type: 'function', name: 'userInfo', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] },
      ]
      for (const abi of stakeInfoCandidates) {
        try {
          const info = await publicClient.readContract({ address, abi: [abi], functionName: abi.name, args: [account] })
          const amt = info?.[0] ?? 0n
          const plan = Number(info?.[2] ?? info?.[1] ?? 0)
          const start = Number(info?.[3] ?? info?.[2] ?? 0)
          const last = Number(info?.[4] ?? info?.[3] ?? 0)
          setUserStakeAmount(formatUnits(amt, stakingTokenDecimals))
          setUserPlan(plan)
          setStakeStartTime(start || null)
          setLastClaim(last || null)
          break
        } catch (err) { void err }
      }
      const pendingAbiOptions = [
        { type: 'function', name: 'pendingRewards', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
        { type: 'function', name: 'earned', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
        { type: 'function', name: 'pending', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
      ]
      for (const abi of pendingAbiOptions) {
        try {
          const p = await publicClient.readContract({ address, abi: [abi], functionName: abi.name, args: [account] })
          setPendingRewards(formatUnits(p, rewardsTokenDecimals))
          break
        } catch (err) { void err }
      }
      try {
        const rr = await publicClient.readContract({ address, abi: [{ type: 'function', name: 'rewardRate', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }], functionName: 'rewardRate' })
        setRewardRate(formatUnits(rr, 18))
      } catch (err) { void err }
      try {
        const own = await publicClient.readContract({ address, abi: [{ type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }], functionName: 'owner' })
        setOwnerAddress(own)
      } catch (err) { void err }
    } catch (err) {
      setError(String(err?.message || err))
    }
  }

  const approveStakingToken = async () => {
    try {
      setError('')
      setSuccess('')
      setTxHash('')
      if (!walletClient) {
        setError('Wallet not connected')
        return
      }
      if (!account) {
        await connect()
        if (!account) return
      }
      if (!stakingTokenAddress) {
        setError('Enter staking token address')
        return
      }
      if (!depositAmount || Number(depositAmount) <= 0) {
        setError('Enter deposit amount')
        return
      }
      const dec = await ensureStakingDecimals()
      const amt = parseUnits(depositAmount, dec)
      const hash = await walletClient.writeContract({ account, address: stakingTokenAddress, abi: erc20Abi, functionName: 'approve', args: [address, amt] })
      await publicClient.waitForTransactionReceipt({ hash })
      setTxHash(hash)
      setSuccess('Approval transaction sent')
    } catch (err) {
      setError(String(err?.message || err))
    }
  }

  const deposit = async () => {
    try {
      setError('')
      setSuccess('')
      setTxHash('')
      if (!walletClient) {
        setError('Wallet not connected')
        return
      }
      if (!account) {
        await connect()
        if (!account) return
      }
      if (!depositAmount || Number(depositAmount) <= 0) {
        setError('Enter deposit amount')
        return
      }
      const dec = await ensureStakingDecimals()
      const amt = parseUnits(depositAmount, dec)
      try {
        const userBal = await publicClient.readContract({ address: stakingTokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
        if (userBal < amt) { setError('Insufficient staking token balance'); return }
      } catch {
        setError('Cannot fetch balance'); return
      }
      try {
        const alw = await publicClient.readContract({ address: stakingTokenAddress, abi: erc20Abi, functionName: 'allowance', args: [account, address] })
        if (alw < amt) {
          const ahash = await walletClient.writeContract({ account, address: stakingTokenAddress, abi: erc20Abi, functionName: 'approve', args: [address, amt] })
          await publicClient.waitForTransactionReceipt({ hash: ahash })
        }
      } catch {
        setError('Cannot fetch allowance'); return
      }
      if (Number.isNaN(Number(depositPlan))) { setError('Enter valid plan'); return }
      const hash = await simulateAndWrite({ account, address, abi: stakingAbi, functionName: 'deposit', args: [amt, Number(depositPlan)] })
      setTxHash(hash)
      setSuccess('Deposit transaction sent')
    } catch (err) {
      setError(String(err?.message || err))
    }
  }

  const claim = async () => {
    try {
      setError('')
      setSuccess('')
      setTxHash('')
      if (!walletClient) {
        setError('Wallet not connected')
        return
      }
      if (!account) {
        await connect()
        if (!account) return
      }
      await refreshDashboard()
      try {
        const owner = await publicClient.readContract({ address, abi: [{ type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }], functionName: 'owner' })
        if (owner && account && owner.toLowerCase() === account.toLowerCase()) { setError('Owner should use Admin Withdraw'); return }
      } catch (err) { void err }
      let pendingBig = 0n
      const pendingAbiOptions = [
        { type: 'function', name: 'pendingRewards', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
        { type: 'function', name: 'earned', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
        { type: 'function', name: 'pending', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
      ]
      for (const abi of pendingAbiOptions) {
        try { pendingBig = await publicClient.readContract({ address, abi: [abi], functionName: abi.name, args: [account] }); break } catch (err) { void err }
      }
      let contractBal = 0n
      try { contractBal = await publicClient.readContract({ address: rewardsTokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) } catch (err) { void err }
      if (contractBal > 0n && pendingBig >= contractBal) { setError('Pending equals contract rewards balance'); return }
      const hash = await simulateAndWrite({ account, address, abi: stakingAbi, functionName: 'claim' })
      setTxHash(hash)
      setSuccess('Claim transaction sent')
    } catch (err) {
      setError(String(err?.message || err))
    }
  }

  const claimMaxFive = async () => {
    try {
      setError('')
      setSuccess('')
      setTxHash('')
      if (!walletClient) { setError('Wallet not connected'); return }
      if (!account) { await connect(); if (!account) return }

      const max = parseUnits('5', stakingTokenDecimals)

      const pendingAbiOptions = [
        { type: 'function', name: 'pendingRewards', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
        { type: 'function', name: 'earned', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
        { type: 'function', name: 'pending', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
      ]

      try {
        const owner = await publicClient.readContract({ address, abi: [{ type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }], functionName: 'owner' })
        if (owner && account && owner.toLowerCase() === account.toLowerCase()) { setError('Owner should use Admin Withdraw'); return }
      } catch (err) { void err }
      let pending = null
      for (const abi of pendingAbiOptions) {
        try {
          pending = await publicClient.readContract({ address, abi: [abi], functionName: abi.name, args: [account] })
          break
        } catch (err) { void err }
      }

      if (pending == null) {
        setError('Cannot estimate pending rewards to enforce 5 token cap')
        return
      }

      if (pending > max) {
        setError('Pending rewards exceed 5 tokens. Please wait or reduce rewards.')
        return
      }

      const hash = await simulateAndWrite({ account, address, abi: stakingAbi, functionName: 'claim' })
      setTxHash(hash)
      setSuccess('Claim <= 5 tokens transaction sent')
    } catch (err) {
      setError(String(err?.message || err))
    }
  }

  

  const withdrawRewardTokens = async () => {
    try {
      setError('')
      setSuccess('')
      setTxHash('')
      if (!walletClient) {
        setError('Wallet not connected')
        return
      }
      if (!account) {
        await connect()
        if (!account) return
      }
      await refreshDashboard()
      if (!withdrawRewardAmount || Number(withdrawRewardAmount) <= 0) {
        setError('Enter withdraw amount')
        return
      }
      const rdec = await ensureRewardsDecimals()
      const amt = parseUnits(withdrawRewardAmount, rdec)
      try {
        const owner = await publicClient.readContract({ address, abi: [{ type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }], functionName: 'owner' })
        if (owner && account && owner.toLowerCase() !== account.toLowerCase()) { setError('Only owner can withdraw reward tokens'); return }
      } catch { void 0 }
      try {
        const rbal = await publicClient.readContract({ address: rewardsTokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
        if (rbal < amt) { setError('Contract reward balance too low'); return }
      } catch { void 0 }
      const hash = await simulateAndWrite({ account, address, abi: stakingAbi, functionName: 'withdrawRewardTokens', args: [amt] })
      setTxHash(hash)
      setSuccess('Admin withdraw transaction sent')
    } catch (err) {
      setError(String(err?.message || err))
    }
  }

  return (
    <div className={`page theme-ocean`}>
      <nav className="navbar">
        <div className="navbar-container">
          {/* Logo/Brand */}
          <div className="navbar-brand">
          </div>

          {/* Hamburger Menu Button */}
          <button className="hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
          </button>

          {/* Navigation Links */}
          <div className={`nav-menu ${mobileMenuOpen ? 'active' : ''}`}>
            <button className={`nav-item ${page === 'staking' ? 'active' : ''}`} onClick={() => { setPage('staking'); setMobileMenuOpen(false); }}>Staking</button>
            <button className={`nav-item ${page === 'wallet' ? 'active' : ''}`} onClick={() => { setPage('wallet'); setMobileMenuOpen(false); }}>Wallet</button>
            <button className={`nav-item ${page === 'plans' ? 'active' : ''}`} onClick={() => { setPage('plans'); setMobileMenuOpen(false); }}>Plans</button>
            <button className={`nav-item ${page === 'claim' ? 'active' : ''}`} onClick={() => { setPage('claim'); setMobileMenuOpen(false); }}>Claim</button>
            {account && <button className={`nav-item admin-link ${page === 'admin' ? 'active' : ''}`} onClick={() => { setPage('admin'); setMobileMenuOpen(false); }}>Admin</button>}
          </div>

          {/* Connect Wallet Button */}
          <div className="navbar-actions">
            {!account && <button className="btn btn-secondary" onClick={connect}>Connect Wallet</button>}
            {account && <span className="wallet-badge">{account.slice(0, 6)}...{account.slice(-4)}</span>}
          </div>
        </div>
      </nav>
      {/* sub-nav removed to match screenshot */}

      {page === 'home' && (
        <div className="hero" style={{ position: 'relative' }}>
          <div className="hero-ring" />
          <div className="hero-title">STAKE / EARN</div>
        </div>
      )}
      {(account || page === 'dashboard') && page === 'dashboard' && (
      <div className="section">
        <div className="card">
          <div className="card-title">Dashboard</div>
          <div className="dashboard-grid pill-decor">
            <div className="metric gradient-metric"><div className="metric-label">Wallet</div><div className="metric-value">{account || ''}</div></div>
            <div className="metric gradient-metric"><div className="metric-label">Staked Amount</div><div className="metric-value">{userStakeAmount || ''}</div></div>
            <div className="metric gradient-metric"><div className="metric-label">Pending Rewards</div><div className="metric-value">{pendingRewards || ''}</div></div>
            
          </div>
          <div className="card-actions" style={{ marginTop: 12 }}>
            <button className="btn-outline btn btn-raised" disabled={!account} onClick={refreshDashboard}>Refresh</button>
          </div>
        </div>
      </div>
      )}
      {page === 'plans' && (
        <Plans />
      )}
      {(page === 'staking') && (
      <div className="section">
        <div className="split">
          <div>
            <div className="staking-title">STAKE</div>
            <div className="form-stack visual">
              <div className="form-block visual">
                <label>Staking Token Address</label>
                <input value={stakingTokenAddress} onChange={(e) => setStakingTokenAddress(e.target.value)} placeholder="0x760DC9a5197C9400D82dA44Bb57e0176cf102F40" />
              </div>
              <div className="form-block visual">
                <label>Token Decimals</label>
                <input type="number" value={stakingTokenDecimals} onChange={(e) => setStakingTokenDecimals(Number(e.target.value || 0))} placeholder="18" />
              </div>
              <div className="form-block visual">
                <label>Amount</label>
                <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="e.g. 100" />
              </div>
              <div className="form-block visual">
                <label>Plan </label>
                <input type="number" value={depositPlan} onChange={(e) => setDepositPlan(Number(e.target.value || 0))} placeholder="0" />
              </div>
              {/* <div className="form-block visual">
                <label>Potential Rewards</label>
                <div style={{ color: '#cfe1ff', paddingTop: 8, fontSize: '14px' }}>{potentialRewards || '-'} RWD</div>
              </div> */}
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="btn-outline btn btn-raised" disabled={!account} onClick={approveStakingToken}>Approve</button>
                <button className="btn btn-secondary btn-raised" disabled={!account} onClick={deposit}>Deposit</button>
              </div>
            </div>
          </div>
          <div className="neon-square" />
        </div>
      </div>
      )}
      {(account || page === 'deposit') && page === 'deposit' && (
        <div className="section">
          <div className="card">
          <div className="card-title">Deposit</div>
          <div className="grid2">
            <div>
              <label>Staking Token Address</label>
              <input value={stakingTokenAddress} onChange={(e) => setStakingTokenAddress(e.target.value)} placeholder="0x..." />
            </div>
            <div>
              <label>Token Decimals</label>
              <input type="number" value={stakingTokenDecimals} onChange={(e) => setStakingTokenDecimals(Number(e.target.value || 0))} />
            </div>
          </div>
          <div className="grid2" style={{ marginTop: 12 }}>
            <div>
              <label>Amount</label>
              <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="e.g. 100" />
            </div>
            <div>
              <label>Plan (uint8)</label>
              <input type="number" value={depositPlan} onChange={(e) => setDepositPlan(Number(e.target.value || 0))} />
            </div>
          </div>
          <div style={{ marginTop: 10, color: '#cfe1ff' }}>Potential Rewards: {potentialRewards || '—'} rRWD</div>
          <div className="card-actions" style={{ marginTop: 12 }}>
            <button className="btn-outline btn btn-raised" disabled={!account} onClick={approveStakingToken}>Approve</button>
            <button className="btn btn-secondary btn-raised" disabled={!account} onClick={deposit}>Deposit</button>
          </div>
          </div>
        </div>
      )}
      {(account || page === 'claim') && page === 'claim' && (
      <div className="section">
        <div className="split">
          <div className="form-stack">
            <div className="form-block">          <p className="extra">Earn Rewards</p>

              <input readOnly value={pendingRewards || ''} placeholder="Pending Rewards" />  
            </div>
            <div className="form-block">  <p className='extra'>Token amount</p>
              <input readOnly value={contractRewardsBalance || ''} placeholder="Contract Rewards Balance" />
               
            </div>
            <div className="actions" style={{ marginTop: 4 }}>
              <button className="btn btn-secondary btn-raised" disabled={!account} onClick={claim}>Claim Rewards</button>
              <button className="btn-outline btn btn-raised" disabled={!account} onClick={claimMaxFive}>Claim Max 5</button>
            </div>
          </div>
          <div className="neon-square" />
        </div>
      </div>
      )}
      {(account || page === 'wallet') && page === 'wallet' && (
      <div className="section">
        <div className="card">
          <div className="card-title">Wallet</div>
          <div className="dashboard-grid">
            <div className="metric gradient-metric"><div className="metric-label">Address</div><div className="metric-value">{account || ''}</div></div>
            <div className="metric gradient-metric"><div className="metric-label">Staking Token</div><div className="metric-value">{STAKING_TOKEN_BALANCE_UNUSED || ''}</div></div>
            <div className="metric gradient-metric"><div className="metric-label">Rewards Token</div><div className="metric-value">{REWARDS_TOKEN_BALANCE_UNUSED || ''}</div></div>
          </div>
          <div className="card-actions" style={{ marginTop: 12 }}>
            <button className="btn-outline btn btn-raised" disabled={!account} onClick={refreshDashboard}>Refresh</button>
          </div>
        </div>
      </div>
      )}
      {page === 'admin' && (
      <div className="section">
        <div className="card">
        <div className="card-title">Admin: Withdraw Reward Tokens</div>
        {(!account || !ownerAddress || ownerAddress?.toLowerCase() !== account?.toLowerCase()) && (
          <div style={{ color: '#ff9d9d', marginBottom: 10 }}>Access restricted. Connect as contract owner to use admin tools.</div>
        )}
        <div className="grid2">
          <div>
            <label>Amount</label>
            <input value={withdrawRewardAmount} onChange={(e) => setWithdrawRewardAmount(e.target.value)} placeholder="e.g. 100" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-raised" disabled={!account || !ownerAddress || ownerAddress?.toLowerCase() !== account?.toLowerCase()} onClick={withdrawRewardTokens}>Withdraw</button>
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <div>
            <label>Deposit Rewards To Contract</label>
            <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="e.g. 100" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn-outline btn btn-raised" disabled={!account} onClick={async () => {
              try {
                setError('')
                setSuccess('')
                setTxHash('')
                const rdec = await ensureRewardsDecimals()
                if (!depositAmount || Number(depositAmount) <= 0) { setError('Enter reward amount'); return }
                const amt = parseUnits(depositAmount, rdec)
                const userBal = await publicClient.readContract({ address: rewardsTokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
                if (userBal < amt) { setError('Insufficient rewards token balance'); return }
                const hash = await simulateAndWrite({ account, address: rewardsTokenAddress, abi: erc20Abi, functionName: 'transfer', args: [address, amt] })
                setTxHash(hash)
                setSuccess('Deposited rewards into contract')
              } catch (err) {
                setError(String(err?.message || err))
              }
            }}>Deposit Rewards</button>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <h2 style={{ color: '#e7ecf7' }}>Data</h2>
          <div className="grid2">
            <div className="metric gradient-metric"><div className="metric-label">Total Stakes</div><div className="metric-value">—</div></div>
            <div className="metric gradient-metric"><div className="metric-label">Total Rewards</div><div className="metric-value">—</div></div>
          </div>
        </div>
        </div>
      </div>
      )}
      {error && (
        <div className="error" style={{ marginTop: 12 }}>{error}</div>
      )}
      {txHash && (
        <div className="status">
          <div>Tx Hash</div>
          <a target="_blank" href={`https://polygonscan.com/tx/${txHash}`}>{txHash}</a>
        </div>
      )}
      {success && (
        <div className="success" style={{ marginTop: 12 }}>{success}</div>
      )}
      <div style={{ marginTop: 24 }}>
        <a target="_blank" href={`https://polygonscan.com/address/${address}#writeContract`}>Polygonscan Contract</a>
      

      </div>
    </div>
  )
}

export default App
