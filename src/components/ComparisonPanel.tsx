import { Shield, ShieldOff, AlertTriangle, CheckCircle } from 'lucide-react';

export function ComparisonPanel() {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">MEV Protection Comparison</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <ShieldOff className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Standard Auction</h3>
              <p className="text-xs text-slate-400">No MEV Protection</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Vulnerable to Front-Running</p>
                <p className="text-xs text-slate-400 mt-1">
                  Attackers can see your bid in the mempool and place a higher bid with more gas to get processed first
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Sandwich Attacks</p>
                <p className="text-xs text-slate-400 mt-1">
                  Bots can place bids before and after yours to manipulate auction outcomes
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Unfair Competition</p>
                <p className="text-xs text-slate-400 mt-1">
                  Users with MEV bots have an unfair advantage over regular bidders
                </p>
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
              <p className="text-xs text-slate-400">Neo X Envelope Transactions</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Front-Running Protection</p>
                <p className="text-xs text-slate-400 mt-1">
                  Envelope transactions prevent attackers from seeing and exploiting your bids
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Fair Ordering</p>
                <p className="text-xs text-slate-400 mt-1">
                  Bids are processed in the order they arrive, not by gas price manipulation
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Equal Opportunity</p>
                <p className="text-xs text-slate-400 mt-1">
                  All participants compete fairly without MEV extraction tactics
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-blue-300">
          <strong>How it works:</strong> Neo X's envelope transactions use a commit-reveal scheme where bid details
          are encrypted until after the transaction is included in a block, preventing MEV attacks while maintaining
          transparency and verifiability.
        </p>
      </div>
    </div>
  );
}
