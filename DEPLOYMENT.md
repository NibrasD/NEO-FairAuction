# Deployment Guide - Fair Auction House

This guide covers deploying the Fair Auction House dApp to Neo X MainNet.

---

## Prerequisites

Before deploying, ensure you have:

- [ ] Neo X MainNet GAS tokens (for deployment and testing)
- [ ] MetaMask installed and configured
- [ ] Hardhat or Foundry installed
- [ ] Private key with sufficient GAS balance
- [ ] Supabase project set up

---

## Step 1: Deploy Smart Contract

### Option A: Using Hardhat

1. Install Hardhat dependencies:

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```

2. Configure `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    neox: {
      url: "https://mainnet.neoxscan.io",
      chainId: 12227,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
```

3. Create deployment script `scripts/deploy.js`:

```javascript
async function main() {
  const FairAuctionHouse = await ethers.getContractFactory("FairAuctionHouse");
  const auction = await FairAuctionHouse.deploy();
  await auction.waitForDeployment();
  console.log("FairAuctionHouse deployed to:", await auction.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

4. Deploy:

```bash
npx hardhat run scripts/deploy.js --network neox
```

### Option B: Using Foundry

1. Install Foundry:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Deploy contract:

```bash
forge create --rpc-url https://mainnet.neoxscan.io \
  --private-key YOUR_PRIVATE_KEY \
  --constructor-args \
  contracts/FairAuctionHouse.sol:FairAuctionHouse

# Verify on Neo X Explorer
forge verify-contract \
  --chain-id 12227 \
  --compiler-version v0.8.20 \
  CONTRACT_ADDRESS \
  contracts/FairAuctionHouse.sol:FairAuctionHouse
```

3. Save the deployed contract address.

---

## Step 2: Update Contract Address

Edit `src/lib/web3.ts` and replace the placeholder:

```typescript
export const CONTRACT_ADDRESS = '0xYourActualContractAddress';
```

---

## Step 3: Configure Supabase

Your Supabase database is already set up with migrations applied. Verify:

1. Visit Supabase dashboard
2. Check Tables: `auctions` and `bids` should exist
3. Verify RLS policies are enabled
4. Test connection in your app

---

## Step 4: Deploy Frontend

### Option A: Vercel

1. Install Vercel CLI:

```bash
npm install -g vercel
```

2. Deploy:

```bash
npm run build
vercel --prod
```

3. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Option B: Netlify

1. Install Netlify CLI:

```bash
npm install -g netlify-cli
```

2. Build and deploy:

```bash
npm run build
netlify deploy --prod --dir=dist
```

3. Set environment variables in Netlify dashboard.

### Option C: GitHub Pages

1. Install gh-pages:

```bash
npm install --save-dev gh-pages
```

2. Add to `package.json`:

```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

3. Update `vite.config.ts`:

```typescript
export default defineConfig({
  base: '/fair-auction-house/',
  // ... rest of config
});
```

4. Deploy:

```bash
npm run deploy
```

---

## Step 5: Verify Deployment

Test all functionality:

1. **Wallet Connection**
   - Connect MetaMask
   - Verify Neo X MainNet switch works
   - Check connected address displays

2. **Create Auction**
   - Fill form with test data
   - Toggle MEV protection on/off
   - Submit transaction
   - Verify auction appears in list
   - Check Supabase database

3. **Place Bid**
   - Select an auction
   - Enter bid amount
   - Submit transaction
   - Verify bid updates in UI
   - Check transaction on Neo X Explorer

4. **Real-Time Updates**
   - Open app in two browser windows
   - Create auction in one
   - Verify it appears in other
   - Place bid and watch update

5. **Auction End**
   - Wait for auction to expire
   - Call `endAuction()`
   - Verify winner display
   - Test withdrawal for outbid users

---

## Step 6: Create Video Demo

Record a 3-5 minute walkthrough covering:

1. **Introduction**
   - Project name and purpose
   - Brief MEV explanation

2. **Live Demo**
   - Connect wallet
   - Show comparison panel
   - Create both auction types
   - Place bids
   - Show real-time updates

3. **Code Highlights**
   - Show smart contract
   - Explain MEV protection
   - Show envelope transaction code

4. **Conclusion**
   - Benefits of MEV protection
   - Neo X advantages

### Recording Tools:
- OBS Studio (free, open-source)
- Loom (easy browser recording)
- ScreenFlow (Mac)
- Camtasia (Windows/Mac)

### Upload to:
- YouTube (unlisted or public)
- Vimeo
- Google Drive (publicly accessible)

---

## Step 7: Submit to GrantShares

1. Prepare submission materials:
   - Deployed contract address
   - Frontend URL
   - GitHub repository (public)
   - Video demo link
   - Post-mortem document

2. Create GrantShares proposal:
   - Go to GrantShares dApp
   - Select "Request For Funding"
   - Title: "GS-004: Fair Auction House"
   - Request: $2,000 USD in GAS equivalent
   - Include all links and documentation

3. Submit after November 5, 2025

---

## Troubleshooting

### Common Issues

**Issue**: Transaction fails with "insufficient funds"
- **Solution**: Ensure wallet has enough GAS for gas fees

**Issue**: Contract not found
- **Solution**: Verify CONTRACT_ADDRESS is correct in `web3.ts`

**Issue**: Supabase connection errors
- **Solution**: Check environment variables are set correctly

**Issue**: MetaMask doesn't switch networks
- **Solution**: Manually add Neo X MainNet to MetaMask:
  - Network Name: Neo X MainNet
  - RPC URL: https://mainnet.neoxscan.io
  - Chain ID: 12227
  - Currency Symbol: GAS
  - Block Explorer: https://xexplorer.neo.org

**Issue**: Real-time updates not working
- **Solution**: Check Supabase realtime is enabled in project settings

---

## Security Checklist

Before going live:

- [ ] Never commit private keys to git
- [ ] Use environment variables for sensitive data
- [ ] Test with small amounts first
- [ ] Verify contract on block explorer
- [ ] Check RLS policies are restrictive
- [ ] Test all user flows
- [ ] Review smart contract for vulnerabilities
- [ ] Enable rate limiting if needed
- [ ] Set up monitoring and alerts

---

## Monitoring

After deployment, monitor:

1. **Smart Contract**
   - Transaction count
   - Gas usage
   - Event emissions
   - Error logs

2. **Frontend**
   - User visits
   - Wallet connections
   - Transaction success rate
   - Error tracking (Sentry)

3. **Database**
   - Query performance
   - Storage usage
   - API request count
   - Real-time connections

---

## Post-Deployment

1. Share on social media:
   - Twitter/X with #NeoX #MEV #Web3
   - Discord (Neo community)
   - Reddit (r/NEO, r/cryptocurrency)

2. Gather feedback:
   - User testing sessions
   - Community feedback
   - Bug reports

3. Iterate:
   - Fix reported bugs
   - Add requested features
   - Improve documentation

---

## Support Resources

- Neo X Documentation: https://docs.neo.org
- Neo X Explorer: https://xexplorer.neo.org
- Neo Discord: https://discord.gg/neo
- Supabase Docs: https://supabase.com/docs
- Ethers.js Docs: https://docs.ethers.org

---

Good luck with your deployment! 🚀
