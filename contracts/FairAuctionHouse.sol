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
        bool ended;
        bool mevProtected;
    }

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;

    uint256 public auctionCount;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        string itemName,
        uint256 startingBid,
        uint256 endTime,
        bool mevProtected
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        bool mevProtected
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

        auctions[auctionId] = Auction({
            seller: msg.sender,
            itemName: _itemName,
            description: _description,
            startingBid: _startingBid,
            highestBid: 0,
            highestBidder: address(0),
            endTime: block.timestamp + _duration,
            ended: false,
            mevProtected: _mevProtected
        });

        emit AuctionCreated(
            auctionId,
            msg.sender,
            _itemName,
            _startingBid,
            block.timestamp + _duration,
            _mevProtected
        );

        return auctionId;
    }

    function placeBid(uint256 _auctionId) external payable {
        Auction storage auction = auctions[_auctionId];

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

        emit BidPlaced(_auctionId, msg.sender, msg.value, auction.mevProtected);
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
        require(block.timestamp >= auction.endTime, "Auction not yet ended");

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
            auction.ended,
            auction.mevProtected
        );
    }

    function getPendingReturn(uint256 _auctionId, address _bidder) external view returns (uint256) {
        return pendingReturns[_auctionId][_bidder];
    }
}
