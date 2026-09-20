import { useState, useEffect } from 'react'
import './index.css'

const API_BASE = "https://lm684rdz5h.execute-api.us-east-1.amazonaws.com/prod";

function CountUp({ endValue, delayMs = 0, isHigh, isMid, isLow }) {
  const [value, setValue] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setValue(endValue);
      return;
    }
    
    let startTimestamp = null;
    const duration = 500;
    let animationFrame;
    let timeout;
    
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setValue(Math.floor(easeProgress * endValue));
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      } else {
        setValue(endValue);
      }
    };
    
    timeout = setTimeout(() => {
      animationFrame = window.requestAnimationFrame(step);
    }, delayMs);

    return () => {
      clearTimeout(timeout);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [endValue, delayMs, prefersReducedMotion]);

  let rankClass = "rank-score";
  if (isHigh) rankClass += " high";
  else if (isMid) rankClass += " mid";
  else if (isLow) rankClass += " low";

  return <div className={rankClass}>{value}%</div>;
}

function App() {
  const [view, setView] = useState('CREATE_GROUP'); // CREATE_GROUP, ADD_MEMBER, LOG_ROUND, DASHBOARD
  const [groupId, setGroupId] = useState(null);
  const [groupProfile, setGroupProfile] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Forms state
  const [groupName, setGroupName] = useState('');
  const [groupAmount, setGroupAmount] = useState(1000);
  
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');

  const [roundNumber, setRoundNumber] = useState(1);
  const [roundPayments, setRoundPayments] = useState({});

  // Dashboard state
  const [dashboardData, setDashboardData] = useState(null);

  const handleApiError = (err) => {
    console.error(err);
    setError(err.message || 'An error occurred');
    setLoading(false);
  };

  const createGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, monthlyAmount: parseFloat(groupAmount) })
      });
      if (!res.ok) throw new Error('Failed to create group');
      const data = await res.json();
      setGroupId(data.groupId);
      setGroupProfile(data.profile);
      setView('ADD_MEMBER');
    } catch (err) {
      handleApiError(err);
    }
    setLoading(false);
  };

  const addMember = async (e) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: memberName, phoneUpi: memberPhone })
      });
      if (!res.ok) throw new Error('Failed to add member');
      const data = await res.json();
      setMembers([...members, { memberId: data.memberId, ...data.member }]);
      setMemberName('');
      setMemberPhone('');
    } catch (err) {
      handleApiError(err);
    }
    setLoading(false);
  };

  const goToLogRounds = () => {
    const initialPayments = {};
    members.forEach(m => {
      initialPayments[m.memberId] = { paid: false, amount: groupProfile.monthlyAmount, dueDate: Math.floor(Date.now() / 1000), paidDate: '' };
    });
    setRoundPayments(initialPayments);
    setView('LOG_ROUND');
  };

  const updatePayment = (memberId, field, value) => {
    setRoundPayments(prev => ({
      ...prev,
      [memberId]: { ...prev[memberId], [field]: value }
    }));
  };

  const logRound = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = Object.entries(roundPayments).map(([memberId, data]) => {
        let paidDateVal = 0;
        if (data.paid) {
          paidDateVal = Math.floor(Date.now() / 1000);
        }
        return {
          memberId,
          paid: data.paid,
          amount: parseFloat(data.amount),
          dueDate: data.dueDate,
          paidDate: paidDateVal
        };
      });

      const res = await fetch(`${API_BASE}/groups/${groupId}/rounds/${roundNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to log round');
      setView('DASHBOARD');
      loadDashboard();
    } catch (err) {
      handleApiError(err);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/groups/${groupId}/dashboard`);
      if (!res.ok) throw new Error('Failed to load dashboard');
      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      handleApiError(err);
    }
    setLoading(false);
  };

  const logAnotherRound = () => {
    setRoundNumber(prev => parseInt(prev, 10) + 1);
    const initialPayments = {};
    members.forEach(m => {
      initialPayments[m.memberId] = { paid: false, amount: groupProfile.monthlyAmount, dueDate: Math.floor(Date.now() / 1000), paidDate: '' };
    });
    setRoundPayments(initialPayments);
    setView('LOG_ROUND');
  };

  const startOver = () => {
    setGroupId(null);
    setGroupProfile(null);
    setMembers([]);
    setGroupName('');
    setGroupAmount(1000);
    setRoundNumber(1);
    setDashboardData(null);
    setView('CREATE_GROUP');
  };

  // Helper for formatting currency
  const formatCurrency = (val) => {
    if (!val) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN');
  };

  return (
    <div id="root">
      <div className="screen">
        <div className="status-bar"></div>
        {error && <div className="error-banner">{error}</div>}

        {view === 'CREATE_GROUP' && (
          <>
            <div className="topbar">
              <div className="eyebrow">step 1 of 3</div>
              <h1>Start a group</h1>
              <p>Give it a name your group will recognize.</p>
            </div>
            <div className="scroll-area">
              <form id="create-group-form" className="form-stack" onSubmit={createGroup}>
                <div className="field">
                  <label>What's it called?</label>
                  <input required value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Hackathon Fund" />
                  <div className="helper">Only your group sees this.</div>
                </div>
                <div className="field">
                  <label>How much, per person, per round?</label>
                  <input type="number" required value={groupAmount} onChange={e => setGroupAmount(e.target.value)} />
                </div>
              </form>
            </div>
            <div className="bottom-cta">
              <button disabled={loading} form="create-group-form" type="submit" className="btn btn-primary">
                {loading ? 'Creating...' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {view === 'ADD_MEMBER' && (
          <>
            <div className="topbar">
              <div className="eyebrow">step 2 of 3 · {groupProfile?.name}</div>
              <h1>Who's in?</h1>
              <p>Add everyone before logging the first round.</p>
            </div>
            <div className="scroll-area">
              {members.map(m => (
                <div key={m.memberId} className="member-pill">
                  <div className="who">
                    <div className="avatar">{m.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="name">{m.name}</div>
                      {m.phoneUpi && <div className="sub">{m.phoneUpi}</div>}
                    </div>
                  </div>
                </div>
              ))}
              
              <form onSubmit={addMember} className="form-stack" style={{marginTop: '8px'}}>
                <div className="field">
                  <label>Add another</label>
                  <input required value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Name" />
                </div>
                <div className="field">
                  <input value={memberPhone} onChange={e => setMemberPhone(e.target.value)} placeholder="UPI ID or phone" />
                </div>
                <button disabled={loading} type="submit" className="btn btn-secondary">+ Add member</button>
              </form>
            </div>
            <div className="bottom-cta">
              <button disabled={members.length < 2} onClick={goToLogRounds} className="btn btn-primary">
                Done adding — log a round
              </button>
            </div>
          </>
        )}

        {view === 'LOG_ROUND' && (
          <>
            <div className="topbar">
              <div className="eyebrow">{groupProfile?.name}</div>
              <h1>Round {roundNumber}</h1>
              <p>Mark who paid. Everyone else counts as missed.</p>
            </div>
            <div className="scroll-area">
              <div className="form-stack" style={{marginBottom: '16px'}}>
                <div className="field">
                  <label>Round Number</label>
                  <input type="number" min="1" value={roundNumber} onChange={e => setRoundNumber(e.target.value)} />
                </div>
              </div>

              {members.map(m => {
                const data = roundPayments[m.memberId] || {};
                const isPaid = data.paid || false;
                return (
                  <div key={m.memberId} className="round-member-row">
                    <div>
                      <div className="name" style={{color: 'var(--ink-high)', fontWeight: '600', fontSize: '14px'}}>
                        {m.name}
                      </div>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <input 
                        type="number" 
                        className="amount-input" 
                        value={data.amount || ''} 
                        onChange={e => updatePayment(m.memberId, 'amount', e.target.value)} 
                      />
                      <div className="toggle">
                        <button 
                          type="button"
                          className={isPaid ? "active-paid" : ""} 
                          onClick={() => updatePayment(m.memberId, 'paid', true)}
                        >
                          Paid
                        </button>
                        <button 
                          type="button"
                          className={!isPaid ? "active-unpaid" : ""} 
                          onClick={() => updatePayment(m.memberId, 'paid', false)}
                        >
                          Not yet
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="bottom-cta">
              <button disabled={loading} onClick={logRound} className="btn btn-primary">
                {loading ? 'Logging...' : 'Submit round'}
              </button>
            </div>
          </>
        )}

        {view === 'DASHBOARD' && (
          <>
            <div className="topbar">
              <div className="eyebrow">
                {groupProfile?.name} · {dashboardData?.profile?.totalRounds || 0} {(dashboardData?.profile?.totalRounds || 0) === 1 ? 'round logged' : 'rounds logged'}
              </div>
              <h1>Who's solid.</h1>
            </div>
            
            {loading && !dashboardData && <p className="loading">Loading dashboard...</p>}
            
            {dashboardData && (
              <>
                <div className="stat-strip">
                  <div className="stat-tile">
                    <div className="num">{formatCurrency((dashboardData.profile.totalRounds || 0) * (dashboardData.profile.memberCount || 0) * (dashboardData.profile.monthlyAmount || 0))}</div>
                    <div className="lbl">collected so far</div>
                  </div>
                  <div className="stat-tile">
                    <div className="num">{dashboardData.profile.memberCount}</div>
                    <div className="lbl">members</div>
                  </div>
                  <div className="stat-tile">
                    <div className="num">{dashboardData.profile.totalRounds}</div>
                    <div className="lbl">rounds done</div>
                  </div>
                </div>

                <div className="scroll-area">
                  {dashboardData.payoutOrder.map((m, index) => {
                    const trustScore = parseFloat(m.trustScore || 0);
                    const isHigh = trustScore >= 0.7;
                    const isLow = trustScore <= 0.4;
                    const isMid = !isHigh && !isLow;
                    
                    let cardClass = "rank-card";
                    if (isMid) cardClass += " mid";
                    if (isLow) cardClass += " low";

                    return (
                      <div key={m.PK} className={cardClass}>
                        <div className="rank-top">
                          <div className="rank-name">
                            <span className="pos">#{index + 1}</span>
                            <span className="who">{m.name}</span>
                          </div>
                          <CountUp 
                            endValue={Math.round(trustScore * 100)} 
                            delayMs={index * 80}
                            isHigh={isHigh}
                            isMid={isMid}
                            isLow={isLow}
                          />
                        </div>
                        <div className="rank-explain">{m.explanation}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="bottom-cta" style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  <button onClick={logAnotherRound} className="btn btn-secondary">Log another round</button>
                  <button onClick={startOver} className="btn btn-ghost">Switch groups</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App
