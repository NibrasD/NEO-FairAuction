// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FairAuctionHouse {
    struct Auction {
        address seller;
        string itemName;
        string description;
        uint256 startingBid;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        uint256 revealTime;
        bool ended;
        bool mevProtected;
    }

    struct CommittedBid {
        bytes32 commitment;
        uint256 deposit;
        bool revealed;
    }

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;
    mapping(uint256 => mapping(address => CommittedBid)) public commitments;

    uint256 public auctionCount;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        string itemName,
        uint256 startingBid,
        uint256 endTime,
        uint256 revealTime,
        bool mevProtected
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        bool mevProtected
    );

    event BidCommitted(
        uint256 indexed auctionId,
        address indexed bidder,
        bytes32 commitment
    );

    event BidRevealed(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );

    event AuctionEnded(
        uint256 indexed auctionId,
        address winner,
        uint256 amount
    );

    function createAuction(
        string memory _itemName,
        string memory _description,
        uint256 _startingBid,
        uint256 _duration,
        bool _mevProtected
    ) external returns (uint256) {
        require(_startingBid > 0, "Starting bid must be greater than 0");
        require(_duration >= 60, "Duration must be at least 60 seconds");

        uint256 auctionId = auctionCount++;
        uint256 endTime = block.timestamp + _duration;
        uint256 revealTime = _mevProtected ? endTime + 300 : endTime;

        auctions[auctionId] = Auction({
            seller: msg.sender,
            itemName: _itemName,
            description: _description,
            startingBid: _startingBid,
            highestBid: 0,
            highestBidder: address(0),
            endTime: endTime,
            revealTime: revealTime,
            ended: false,
            mevProtected: _mevProtected
        });

        emit AuctionCreated(
            auctionId,
            msg.sender,
            _itemName,
            _startingBid,
            endTime,
            revealTime,
            _mevProtected
        );

        return auctionId;
    }

    function placeBid(uint256 _auctionId) external payable {
        Auction storage auction = auctions[_auctionId];

        require(!auction.mevProtected, "Use commitBid for MEV-protected auctions");
        require(!auction.ended, "Auction has ended");
        require(block.timestamp < auction.endTime, "Auction time expired");
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(
            msg.value > auction.highestBid && msg.value >= auction.startingBid,
            "Bid must be higher than current highest bid"
        );

        if (auction.highestBidder != address(0)) {
            pendingReturns[_auctionId][auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        emit BidPlaced(_auctionId, msg.sender, msg.value, false);
    }

    function commitBid(uint256 _auctionId, bytes32 _commitment) external payable {
        Auction storage auction = auctions[_auctionId];

        require(auction.mevProtected, "Use placeBid for normal auctions");
        require(!auction.ended, "Auction has ended");
        require(block.timestamp < auction.endTime, "Commit phase expired");
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(msg.value >= auction.startingBid, "Deposit must be at least starting bid");
        require(commitments[_auctionId][msg.sender].commitment == bytes32(0), "Already committed");

        commitments[_auctionId][msg.sender] = CommittedBid({
            commitment: _commitment,
            deposit: msg.value,
            revealed: false
        });

        emit BidCommitted(_auctionId, msg.sender, _commitment);
    }

    function revealBid(uint256 _auctionId, uint256 _amount, string memory _secret) external {
        Auction storage auction = auctions[_auctionId];
        CommittedBid storage committedBid = commitments[_auctionId][msg.sender];

        require(auction.mevProtected, "Not an MEV-protected auction");
        require(!auction.ended, "Auction has ended");
        require(block.timestamp >= auction.endTime, "Reveal phase not started");
        require(block.timestamp < auction.revealTime, "Reveal phase expired");
        require(committedBid.commitment != bytes32(0), "No commitment found");
        require(!committedBid.revealed, "Already revealed");

        bytes32 hash = keccak256(abi.encodePacked(_amount, _secret, msg.sender));
        require(hash == committedBid.commitment, "Invalid reveal");

        committedBid.revealed = true;

        if (_amount > auction.highestBid && _amount >= auction.startingBid && _amount <= committedBid.deposit) {
            if (auction.highestBidder != address(0)) {
                pendingReturns[_auctionId][auction.highestBidder] += auction.highestBid;
            }

            auction.highestBid = _amount;
            auction.highestBidder = msg.sender;

            uint256 refund = committedBid.deposit - _amount;
            if (refund > 0) {
                pendingReturns[_auctionId][msg.sender] += refund;
            }

            emit BidRevealed(_auctionId, msg.sender, _amount);
        } else {
            pendingReturns[_auctionId][msg.sender] += committedBid.deposit;
        }
    }

    function withdraw(uint256 _auctionId) external {
        uint256 amount = pendingReturns[_auctionId][msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingReturns[_auctionId][msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function endAuction(uint256 _auctionId) external {
        Auction storage auction = auctions[_auctionId];

        require(!auction.ended, "Auction already ended");

        if (auction.mevProtected) {
            require(block.timestamp >= auction.revealTime, "Reveal phase not ended");
        } else {
            require(block.timestamp >= auction.endTime, "Auction not yet ended");
        }

        auction.ended = true;

        if (auction.highestBidder != address(0)) {
            (bool success, ) = auction.seller.call{value: auction.highestBid}("");
            require(success, "Transfer to seller failed");
        }

        emit AuctionEnded(_auctionId, auction.highestBidder, auction.highestBid);
    }

    function getAuction(uint256 _auctionId) external view returns (
        address seller,
        string memory itemName,
        string memory description,
        uint256 startingBid,
        uint256 highestBid,
        address highestBidder,
        uint256 endTime,
        uint256 revealTime,
        bool ended,
        bool mevProtected
    ) {
        Auction memory auction = auctions[_auctionId];
        return (
            auction.seller,
            auction.itemName,
            auction.description,
            auction.startingBid,
            auction.highestBid,
            auction.highestBidder,
            auction.endTime,
            auction.revealTime,
            auction.ended,
            auction.mevProtected
        );
    }

    function getCommitment(uint256 _auctionId, address _bidder) external view returns (
        bytes32 commitment,
        uint256 deposit,
        bool revealed
    ) {
        CommittedBid memory bid = commitments[_auctionId][_bidder];
        return (bid.commitment, bid.deposit, bid.revealed);
    }

    function getPendingReturn(uint256 _auctionId, address _bidder) external view returns (uint256) {
        return pendingReturns[_auctionId][_bidder];
    }
}
