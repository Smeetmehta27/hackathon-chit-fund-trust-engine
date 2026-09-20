import { useState, useEffect } from 'react'
import './index.css'

const API_BASE = "https://lm684rdz5h.execute-api.us-east-1.amazonaws.com/prod";

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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, monthlyAmount: groupAmount })
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
    // Initialize payments state
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
        if (data.paid && data.paidDate) {
          paidDateVal = Math.floor(new Date(data.paidDate).getTime() / 1000);
        } else if (data.paid) {
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

  return (
    <div className="container">
      <header>
        <h1>Hackathon Fund Manager</h1>
        {groupId && <p className="subtitle">Group ID: {groupId}</p>}
      </header>

      {error && <div className="error-banner">{error}</div>}

      <main>
        {view === 'CREATE_GROUP' && (
          <div className="card form-card">
            <h2>Create New Group</h2>
            <form onSubmit={createGroup}>
              <div className="form-group">
                <label>Group Name</label>
                <input required value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Vacation Fund" />
              </div>
              <div className="form-group">
                <label>Monthly Amount (₹)</label>
                <input type="number" required value={groupAmount} onChange={e => setGroupAmount(e.target.value)} />
              </div>
              <button disabled={loading} type="submit" className="btn primary block">
                {loading ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>
        )}

        {view === 'ADD_MEMBER' && (
          <div className="card form-card">
            <h2>Add Members</h2>
            <p>Group: <strong>{groupProfile?.name}</strong></p>
            
            <form onSubmit={addMember} className="inline-form">
              <input required value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Member Name" />
              <input value={memberPhone} onChange={e => setMemberPhone(e.target.value)} placeholder="Phone or UPI" />
              <button disabled={loading} type="submit" className="btn secondary">Add</button>
            </form>

            <div className="members-list">
              <h3>Current Members ({members.length})</h3>
              <ul>
                {members.map(m => <li key={m.memberId}>{m.name}</li>)}
                {members.length === 0 && <li className="empty">No members added yet</li>}
              </ul>
            </div>

            <div className="actions">
              <button disabled={members.length === 0} onClick={goToLogRounds} className="btn primary block">Proceed to Log Rounds</button>
            </div>
          </div>
        )}

        {view === 'LOG_ROUND' && (
          <div className="card form-card log-round-card">
            <h2>Log Payment Round</h2>
            <div className="form-group">
              <label>Round Number</label>
              <input type="number" min="1" value={roundNumber} onChange={e => setRoundNumber(e.target.value)} />
            </div>

            <form onSubmit={logRound}>
              <div className="payments-grid">
                {members.map(m => {
                  const data = roundPayments[m.memberId] || {};
                  return (
                    <div key={m.memberId} className="payment-row card">
                      <div className="payment-info">
                        <strong>{m.name}</strong>
                      </div>
                      <div className="payment-inputs">
                        <label className="checkbox-label">
                          <input type="checkbox" checked={data.paid || false} onChange={e => updatePayment(m.memberId, 'paid', e.target.checked)} />
                          Paid
                        </label>
                        <input type="number" value={data.amount || ''} onChange={e => updatePayment(m.memberId, 'amount', e.target.value)} placeholder="Amount" />
                        {data.paid && (
                          <input type="date" value={data.paidDate || ''} onChange={e => updatePayment(m.memberId, 'paidDate', e.target.value)} title="Paid Date" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <button disabled={loading} type="submit" className="btn primary block submit-round">
                {loading ? 'Logging...' : 'Submit Round'}
              </button>
            </form>
          </div>
        )}

        {view === 'DASHBOARD' && (
          <div className="dashboard">
            <div className="dashboard-header">
              <h2>Group Dashboard</h2>
              <button onClick={loadDashboard} className="btn secondary small">Refresh</button>
            </div>
            
            {loading && !dashboardData && <p className="loading">Loading dashboard data...</p>}
            
            {dashboardData && (
              <div className="dashboard-content">
                <div className="stats-cards">
                  <div className="stat-card">
                    <h4>Total Rounds</h4>
                    <p>{dashboardData.profile.totalRounds}</p>
                  </div>
                  <div className="stat-card">
                    <h4>Monthly Amount</h4>
                    <p>₹{dashboardData.profile.monthlyAmount}</p>
                  </div>
                  <div className="stat-card">
                    <h4>Members</h4>
                    <p>{dashboardData.profile.memberCount}</p>
                  </div>
                </div>

                <h3>Trust Rankings</h3>
                <div className="rankings-list">
                  {dashboardData.payoutOrder.map((m, index) => {
                    const trustScore = parseFloat(m.trustScore || 0);
                    const isHighTrust = trustScore >= 0.7;
                    const isLowTrust = trustScore <= 0.4;
                    let trustClass = "trust-medium";
                    if (isHighTrust) trustClass = "trust-high";
                    if (isLowTrust) trustClass = "trust-low";

                    return (
                      <div key={m.PK} className={`member-card ${trustClass}`}>
                        <div className="member-header">
                          <div className="member-identity">
                            <span className="rank">#{index + 1}</span>
                            <span className="name">{m.name}</span>
                          </div>
                          <div className="score-badge">
                            {Math.round(trustScore * 100)}% Trust
                          </div>
                        </div>
                        <div className="member-explanation">
                          <p>{m.explanation}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
