// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * GridPulseTestnetTrading
 * ------------------------
 * TESTNET ONLY. This contract is meant to be deployed to a public test
 * network (e.g. Sepolia) using free, worthless test ETH from a faucet.
 * Nothing here should ever be deployed to Ethereum mainnet or any network
 * where the native currency has real value, without a full legal and
 * security review first — see the accompanying documentation.
 *
 * What this contract actually does:
 * - The contract owner publishes a price for each market (a stand-in for
 *   a real electricity price oracle, which this testnet version does not
 *   have — see "Known limitation" below).
 * - Anyone with a connected wallet can open a simulated long or short
 *   position by sending test ETH as their stake.
 * - Closing a position pays out based on how the price moved, using real
 *   on-chain test ETH — but every payout is capped so the contract can
 *   never owe more than it holds (max payout = 2x stake, minimum = 0).
 *
 * Known limitation (read before treating this as more than a testnet demo):
 * There is no real electricity price oracle wired in here. `setPrice` is
 * called manually by the contract owner. A production version would need
 * a real oracle (e.g. Chainlink) or a signed price feed from a trusted
 * off-chain source — building that is a separate, larger piece of work.
 */
contract GridPulseTestnetTrading {
    address public owner;

    struct Position {
        address trader;
        bytes32 marketId;
        bool isLong;
        uint256 stake;       // wei staked
        uint256 entryPrice;  // price at open, scaled by 1e8
        bool open;
    }

    mapping(bytes32 => uint256) public currentPrice; // marketId => price (scaled by 1e8)
    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;

    event PriceUpdated(bytes32 indexed marketId, uint256 price);
    event PositionOpened(uint256 indexed id, address indexed trader, bytes32 indexed marketId, bool isLong, uint256 stake, uint256 entryPrice);
    event PositionClosed(uint256 indexed id, address indexed trader, uint256 exitPrice, uint256 payout);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can do this");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Owner-only stand-in for a real price oracle. See contract-level note.
    function setPrice(bytes32 marketId, uint256 price) external onlyOwner {
        require(price > 0, "Price must be greater than zero");
        currentPrice[marketId] = price;
        emit PriceUpdated(marketId, price);
    }

    /// @notice Opens a simulated position. Send test ETH as your stake with this call.
    function openPosition(bytes32 marketId, bool isLong) external payable returns (uint256) {
        require(msg.value > 0, "Stake must be greater than zero");
        uint256 price = currentPrice[marketId];
        require(price > 0, "No price set for this market yet");

        uint256 id = nextPositionId++;
        positions[id] = Position({
            trader: msg.sender,
            marketId: marketId,
            isLong: isLong,
            stake: msg.value,
            entryPrice: price,
            open: true
        });

        emit PositionOpened(id, msg.sender, marketId, isLong, msg.value, price);
        return id;
    }

    /// @notice Closes a position and pays out the result, capped between 0 and 2x the stake.
    function closePosition(uint256 id) external {
        Position storage pos = positions[id];
        require(pos.open, "Position is not open");
        require(pos.trader == msg.sender, "This is not your position");

        uint256 exitPrice = currentPrice[pos.marketId];
        require(exitPrice > 0, "No current price available");

        pos.open = false;

        int256 priceMove = int256(exitPrice) - int256(pos.entryPrice);
        // percentage move scaled by 1e8, matching the price scale
        int256 pctMoveScaled = (priceMove * 1e8) / int256(pos.entryPrice);
        if (!pos.isLong) {
            pctMoveScaled = -pctMoveScaled;
        }

        int256 pnl = (int256(pos.stake) * pctMoveScaled) / 1e8;
        int256 payoutSigned = int256(pos.stake) + pnl;

        // Cap payout so the contract can never owe more than 2x the stake,
        // and never pay out a negative amount.
        uint256 maxPayout = pos.stake * 2;
        uint256 payout;
        if (payoutSigned <= 0) {
            payout = 0;
        } else if (uint256(payoutSigned) > maxPayout) {
            payout = maxPayout;
        } else {
            payout = uint256(payoutSigned);
        }

        require(address(this).balance >= payout, "Contract is temporarily underfunded, contact the owner");

        if (payout > 0) {
            (bool sent, ) = payable(msg.sender).call{value: payout}("");
            require(sent, "Payout transfer failed");
        }

        emit PositionClosed(id, msg.sender, exitPrice, payout);
    }

    /// @notice Lets the owner top up the contract so it can cover winning trades.
    function fundContract() external payable {}

    /// @notice Emergency owner withdrawal, e.g. to recover unused testnet funds.
    function ownerWithdraw(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough balance");
        (bool sent, ) = payable(owner).call{value: amount}("");
        require(sent, "Withdrawal failed");
    }

    receive() external payable {}
}
