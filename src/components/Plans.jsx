import React from 'react';
import '../styles/Plans.css';

function Plans() {
  const plans = [
    {
      id: 1,
      title: 'plan1',
      duration: 'A YEARLY',
      reward: 'AND GET 10%',
      description: 'stake MYTOKENS and get rTWD Tokens as a rewards',
      gradient: 'gradient-blue-purple'
    },
    {
      id: 2,
      title: 'plan2',
      duration: '6 MONTH',
      reward: 'AND GET 6%',
      description: 'stake MYTOKENS and get rTWD Tokens as a rewards',
      gradient: 'gradient-purple-pink'
    },
    {
      id: 3,
      title: 'plan3',
      duration: '3 MONTH',
      reward: 'AND GET 2%',
      description: 'stake MYTOKENS and get rTWD Tokens as a rewards',
      gradient: 'gradient-pink-purple'
    }
  ];

  return (
    <div className="plans-container">
      <div className="plans-title-box">
        <h1 className="plans-title">PLANS</h1>
      </div>
      
      <div className="plans-grid">
        {plans.map((plan) => (
          <div key={plan.id} className={`plan-card ${plan.gradient}`}>
            <div className="plan-content">
              <h2 className="plan-name">{plan.title}</h2>
              <p className="plan-duration">{plan.duration}</p>
              <p className="plan-reward">{plan.reward}</p>
            </div>
            <div className="plan-description">
              <p>{plan.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Plans;
