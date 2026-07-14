# Token Staking Platform

A Solidity smart contract system that lets users stake ERC-20 tokens and earn rewards based on staking duration.

## Features
- Stake and unstake ERC-20 tokens
- Reward calculation based on time staked
- Withdraw accumulated rewards
- Built and tested with Hardhat

## Tech Stack
- Solidity
- Hardhat
- Ethers.js
- OpenZeppelin (ERC-20 standards)

## How It Works
1. User approves tokens for the staking contract
2. User calls `stake()` to lock tokens
3. Rewards accrue over time based on the staking period
4. User can `withdraw()` staked tokens + earned rewards anytime

## Getting Started
\`\`\`bash
npm install
npx hardhat compile
npx hardhat test
\`\`\`

## Author
Kainat Amir — Blockchain Developer
[LinkedIn](https://linkedin.com/in/kainatamir)
