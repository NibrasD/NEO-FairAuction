# Fair Auction House Smart Contracts

## Overview

This directory contains the Solidity smart contracts for the Fair Auction House dApp, demonstrating MEV resistance on Neo X.

## Contract: FairAuctionHouse.sol

The main auction contract that handles:
- Creating auctions with MEV protection flag
- Placing bids (can use MEV-resistant envelope transactions)
- Automatic refunds for outbid participants
- Auction settlement

## Deployment

### Prerequisites
- Neo X MainNet RPC endpoint
- Private key with GAS tokens for deployment
- Hardhat or Foundry for deployment

### Deploy to Neo X MainNet

```bash
# Using Hardhat
npx hardhat run scripts/deploy.js --network neox

# Or using Foundry
forge create --rpc-url https://mainnet.neoxscan.io --private-key YOUR_PRIVATE_KEY contracts/FairAuctionHouse.sol:FairAuctionHouse
```

## MEV Protection

This contract is designed to work with Neo X's MEV-resistant envelope transactions. When creating an auction with `mevProtected = true`, bidders should submit their transactions using Neo X's envelope transaction format to prevent front-running.

## Security Features

- Checks-Effects-Interactions pattern
- Withdrawal pattern for refunds
- Access controls on critical functions
- Time-based auction mechanics
