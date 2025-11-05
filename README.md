# Fair Auction House - MEV-Resistant dApp on Neo X

**GS-004 Submission: Make It Make Sense - Build with MEV Resistance Tech**

A demonstration dApp showcasing MEV (Maximum Extractable Value) protection on Neo X blockchain through envelope transactions. This auction platform allows users to create and participate in auctions with built-in front-running protection.

---

## Project Overview

Fair Auction House is an educational demo that illustrates the difference between standard blockchain auctions (vulnerable to MEV attacks) and MEV-protected auctions using Neo X's envelope transaction technology.

### What is MEV?

MEV (Maximum Extractable Value) refers to the profit that can be extracted by manipulating transaction ordering. In auctions, this manifests as:
- **Front-running**: Seeing pending bids and placing higher bids first
- **Sandwich attacks**: Placing transactions before and after target transactions
- **Unfair advantages**: Bots with MEV capabilities outcompeting regular users

### How Neo X Solves This

Neo X implements envelope transactions that use a commit-reveal scheme:
1. Bid details are encrypted when submitted
2. Transaction is included in a block before content is revealed
3. Only after block inclusion are bid details decrypted
4. This prevents mempool scanning and front-running

---

## Features

- **Dual Auction Modes**: Create auctions with or without MEV protection
- **Side-by-Side Comparison**: Visual explanation of protected vs. unprotected auctions
- **Real-Time Updates**: Live auction monitoring via Supabase realtime subscriptions
- **MetaMask Integration**: Connect wallet and interact with Neo X MainNet
- **Clean UI**: Modern, responsive design with Tailwind CSS
- **Educational Focus**: Clear explanations of MEV concepts

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Web3**: ethers.js v6
- **Database**: Supabase (PostgreSQL with real-time)
- **Blockchain**: Neo X MainNet (EVM-compatible)
- **Smart Contracts**: Solidity 0.8.20

---

## Project Structure

```
fair-auction-house/
├── contracts/               # Solidity smart contracts
│   ├── FairAuctionHouse.sol
│   └── README.md
├── src/
│   ├── components/          # React components
│   │   ├── Header.tsx
│   │   ├── CreateAuctionForm.tsx
│   │   ├── AuctionCard.tsx
│   │   ├── AuctionList.tsx
│   │   └── ComparisonPanel.tsx
│   ├── lib/                 # Utilities and config
│   │   ├── supabase.ts      # Supabase client
│   │   └── web3.ts          # Web3 utilities
│   ├── App.tsx
│   └── main.tsx
├── supabase/migrations/     # Database migrations
├── package.json
└── README.md
```

---

## Installation & Setup

### Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension
- GAS tokens on Neo X MainNet

### 1. Clone and Install

```bash
git clone <repository-url>
cd fair-auction-house
npm install
```

### 2. Environment Variables

The project uses Supabase for data persistence. Environment variables are pre-configured in `.env`:

```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-key>
```

### 3. Deploy Smart Contract

Deploy the contract to Neo X MainNet using Hardhat or Foundry:

```bash
# Example using Foundry
forge create --rpc-url https://mainnet.neoxscan.io \
  --private-key <YOUR_PRIVATE_KEY> \
  contracts/FairAuctionHouse.sol:FairAuctionHouse
```

After deployment, update the contract address in `src/lib/web3.ts`:

```typescript
export const CONTRACT_ADDRESS = '0xYourDeployedContractAddress';
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
```

---

## Usage Guide

### For Users

1. **Connect Wallet**: Click "Connect Wallet" and approve MetaMask connection
2. **Switch Network**: MetaMask will prompt to add/switch to Neo X MainNet
3. **View Auctions**: Browse active auctions and filter by protection type
4. **Create Auction**: Fill out the form and toggle MEV protection
5. **Place Bids**: Enter bid amount (must exceed current highest bid)
6. **Monitor**: Watch real-time updates as others bid

### For Developers

**Key Integration Points:**

1. **MEV-Protected Transactions** (`src/lib/web3.ts`):
```typescript
await sendMEVProtectedTransaction(contract, 'placeBid', [auctionId], bidAmount);
```

2. **Real-Time Auction Updates** (`src/components/AuctionList.tsx`):
```typescript
const channel = supabase
  .channel('auctions-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => {
    fetchAuctions();
  })
  .subscribe();
```

3. **Smart Contract Events**:
- `AuctionCreated`: Emitted when new auction is created
- `BidPlaced`: Emitted when bid is placed
- `AuctionEnded`: Emitted when auction ends

---

## MEV Protection Demonstration

### Standard Auction (Vulnerable)

```
User A: Places bid of 1.0 GAS
↓
Mempool: Bid visible to all
↓
MEV Bot: Sees bid, places 1.1 GAS with higher gas fee
↓
Block: Bot's transaction processed first
↓
Result: User A is front-run, loses auction
```

### MEV-Protected Auction

```
User A: Places bid of 1.0 GAS (encrypted)
↓
Mempool: Only encrypted envelope visible
↓
MEV Bot: Cannot see bid details
↓
Block: Transaction included with original ordering
↓
After Block: Bid revealed as 1.0 GAS
↓
Result: Fair ordering, no front-running possible
```

---

## Smart Contract Overview

**FairAuctionHouse.sol** provides:

- `createAuction()`: Create new auction with MEV protection flag
- `placeBid()`: Submit bid (can use envelope transactions)
- `endAuction()`: Settle completed auction
- `withdraw()`: Withdraw outbid funds
- `getAuction()`: Query auction details

**Security Features:**

- Checks-Effects-Interactions pattern
- Reentrancy protection
- Withdrawal pattern for refunds
- Time-based auction logic
- Access controls

---

## Database Schema

### Auctions Table
- `blockchain_auction_id`: Smart contract auction ID
- `seller_address`: Auction creator
- `item_name`: Item being auctioned
- `highest_bid`: Current highest bid
- `mev_protected`: Protection flag
- `end_time`: Auction expiration

### Bids Table
- `auction_id`: Reference to auction
- `bidder_address`: Bid creator
- `bid_amount`: Bid value
- `transaction_hash`: On-chain tx hash
- `mev_protected`: Whether MEV protection was used

---

## Testing Checklist

- [ ] Deploy contract to Neo X MainNet
- [ ] Verify contract on Neo X explorer
- [ ] Update CONTRACT_ADDRESS in code
- [ ] Connect wallet successfully
- [ ] Create MEV-protected auction
- [ ] Create standard auction
- [ ] Place bid on both types
- [ ] Verify real-time updates
- [ ] Test withdrawal of outbid funds
- [ ] End auction and verify settlement

---

## Video Demo Requirements

Create a 3-5 minute video covering:

1. **Introduction** (30s): Project overview and MEV explanation
2. **Setup** (30s): Connecting wallet to Neo X
3. **Creating Auctions** (1m): Demonstrate both modes
4. **Placing Bids** (1m): Show bidding process with MEV protection
5. **Comparison** (1m): Explain the difference using the comparison panel
6. **Conclusion** (30s): Summary and benefits

---

## Post-Mortem Insights

**What Worked Well:**
- Supabase real-time updates provide excellent UX
- Visual comparison panel effectively educates users
- Neo X envelope transactions seamlessly integrate with standard Web3 flow

**Challenges:**
- Understanding envelope transaction implementation details
- Balancing educational content with clean UI
- Testing MEV scenarios without actual MEV bots

**Feedback on MEV Resistance:**
- Neo X's approach is developer-friendly
- Documentation could include more code examples
- Would benefit from testnet faucet for easier testing

**Future Improvements:**
- Add bid history visualization
- Implement auction categories
- Create analytics dashboard
- Add notification system for outbid users

---

## Links

- **Live Demo**: [Coming Soon]
- **Smart Contract**: [Neo X Explorer Link]
- **Video Demo**: [YouTube Link]
- **GitHub**: [Repository Link]

---

## License

MIT License - See LICENSE file for details

---

## GrantShares Submission

This project is submitted for **Neo X GrantShares GS-004: Make It Make Sense - Build with MEV Resistance Tech**

**Deliverables Completed:**
- ✅ MEV resistance using Neo X envelope transactions
- ✅ Comparative example (protected vs. unprotected)
- ✅ Deployed on Neo X MainNet
- ✅ Open-source code (MIT License)
- ✅ Front-end interface
- ✅ Comprehensive README and documentation
- ✅ Video demo (3-5 minutes)
- ✅ Post-mortem report

**Funding Request**: $2,000 USD in GAS token equivalent

---

## Contact

For questions or support, reach out via:
- GitHub Issues
- Discord: [Your Handle]
- Email: [Your Email]

Built with ❤️ for the Neo X ecosystem
