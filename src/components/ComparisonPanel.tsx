import { Shield, ShieldOff, AlertTriangle, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react';

export function ComparisonPanel() {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-2">Understanding MEV Protection</h2>
      <p className="text-sm text-slate-400 mb-6">
        This educational demo shows how commit-reveal patterns prevent front-running and MEV attacks
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <ShieldOff className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Standard Auction</h3>
              <p className="text-xs text-slate-400">Immediate Visibility</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <Eye className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Bids Visible Immediately</p>
                <p className="text-xs text-slate-400 mt-1">
                  Everyone can see your bid amount the moment you submit it
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Vulnerable to Front-Running</p>
                <p className="text-xs text-slate-400 mt-1">
                  Other bidders can see your bid and quickly place a higher one before yours is processed
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">MEV Extraction Risk</p>
                <p className="text-xs text-slate-400 mt-1">
                  Bots can monitor the mempool and manipulate transaction ordering for profit
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-300 font-medium mb-2">How it works:</p>
            <div className="space-y-1 text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                <span>User submits bid → Visible immediately</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                <span>Others see bid and can outbid</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                <span>Winner determined by highest bid</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Shield className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">MEV-Protected Auction</h3>
              <p className="text-xs text-slate-400">Commit-Reveal Pattern</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <EyeOff className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Bids Hidden During Commit</p>
                <p className="text-xs text-slate-400 mt-1">
                  Your bid amount is encrypted and hidden from everyone including the blockchain
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Lock className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Cryptographic Commitment</p>
                <p className="text-xs text-slate-400 mt-1">
                  Uses hash function to commit to your bid without revealing the amount
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Fair Competition</p>
                <p className="text-xs text-slate-400 mt-1">
                  All bids revealed simultaneously after commit phase, preventing front-running
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-emerald-500/20">
            <p className="text-xs text-emerald-300 font-medium mb-2">How it works:</p>
            <div className="space-y-1 text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                <span><strong className="text-blue-300">Commit:</strong> Submit hash(bid + secret)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                <span>Bid amounts remain hidden</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                <span><strong className="text-amber-300">Reveal:</strong> After commit ends, reveal bid + secret</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                <span>Contract verifies hash and determines winner</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <p className="text-sm font-medium text-orange-300">Standard Auction Risk</p>
          </div>
          <p className="text-xs text-slate-400">
            In traditional blockchain auctions (like Ethereum), your bid is visible in the mempool before it's mined.
            MEV bots can see your bid and front-run you by paying higher gas fees.
          </p>
        </div>

        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-300">Protected Auction Security</p>
          </div>
          <p className="text-xs text-slate-400">
            With commit-reveal, nobody knows your bid during the commit phase. All bids are revealed
            simultaneously, making front-running impossible. This demo simulates MEV protection on Neo X.
          </p>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-300">
          <strong className="text-blue-200">Educational Note:</strong> This is a demonstration of commit-reveal pattern for MEV protection.
          In production, Neo X provides built-in MEV resistance through its dBFT 2.0 consensus mechanism, which ensures
          fair transaction ordering at the protocol level without requiring explicit commit-reveal schemes.
        </p>
      </div>
    </div>
  );
}
