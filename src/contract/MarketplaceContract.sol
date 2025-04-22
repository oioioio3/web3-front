// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./NFTSimple.sol";
import "./ReputationContract.sol";

contract MarketplaceContract is ReentrancyGuard, Pausable, ReputationContract, NFTSimple {
    address public platformWallet;
    address public erc20Token; // 固定ERC20代币
    enum Country {
        CN, // 中国
        US, // 美国
        JP, // 日本
        GB, // 英国
        DE, // 德国
        FR, // 法国
        AU, // 澳大利亚
        CA // 加拿大
    }

    enum TaskCategory {
        service, //服务
        user,    //用户
        demand,  //需求
        company  //公司
    }
    struct Item {
        address creator; // 商家/需求方
        uint256 price; // 价格/报酬
        uint256 creatorDepositMultiplier; // 发布者质押倍数
        uint256 duration; // 交易最长持续时间（秒）
        string ipfsHash; // IPFS元数据
        uint256 totalQuantity; // NFT数量
        uint256 availableQuantity; // 剩余数量
        bool active; // 是否有效
        Country country; // 国家分类
        TaskCategory taskCategory; // 任务分类
    }

    struct Transaction {
        uint256 itemId; // 商品/任务ID
        address participant; // 买家/服务方
        uint256 nftId; // NFT ID
        uint256 buyerDepositMultiplier;
        uint256 deposit; // 参与者押金
        uint256 endTime; // 交易截止时间
        uint8 status; // 0-待确认，1-进行中，2-正常，3-协商，4-超时
    }

    mapping(uint256 => Item) public items;
    mapping(uint256 => Transaction) public transactions;
    uint256 public itemCounter = 1;
    uint256 public transactionCounter = 1;

    event ItemPublished(uint256 indexed itemId, address indexed creator, uint256 price, uint256 quantity, uint8 country, uint8 taskCategory);
    event ItemsBatchPublished(uint256[] itemIds, address indexed creator,uint8[] countries,uint8[] taskCategories);
    event TransactionRequested(uint256 indexed transactionId, uint256 indexed itemId, address indexed participant, uint256 buyerDepositMultiplier);
    event TransactionsBatchRequested(uint256[] transactionIds, uint256[] itemIds, address indexed participant, uint256[] buyerDepositMultipliers);
    event TransactionApproved(uint256 indexed transactionId, address indexed participant);
    event TransactionsBatchApproved(uint256[] transactionIds, address indexed creator);
    event TransactionConfirmed(uint256 indexed transactionId, uint8 status);
    event TransactionCancelled(uint256 indexed transactionId);
    event TransactionTimedOut(uint256 indexed transactionId);
    event TransactionBatchTimedOut(uint256[] transactionIds);
    event ItemQuantityAdded(uint256 indexed itemId, address indexed creator, uint256 additionalQuantity);
    event ItemWithdraw(uint256 indexed itemId, uint256 quantity);
    constructor(
        address _erc20Token
    ) NFTSimple(msg.sender) {
        erc20Token = _erc20Token;
        platformWallet = msg.sender;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function addItemQuantity(uint256 itemId, uint256 additionalQuantity)
        external
        nonReentrant
        whenNotPaused
    {
        Item storage item = items[itemId];
        require(item.active, "Item not active");
        require(item.creator == msg.sender, "Not creator");
        require(additionalQuantity > 0, "Quantity must be positive");

        // 计算需要质押的代币数量
        uint256 additionalDeposit = item.price * item.creatorDepositMultiplier * additionalQuantity;
        // 从商家账户转入质押代币
        IERC20(erc20Token).transferFrom(msg.sender, address(this), additionalDeposit);

        // 更新 item 的数量
        item.totalQuantity += additionalQuantity;
        item.availableQuantity += additionalQuantity;

        // 触发事件
        emit ItemQuantityAdded(itemId, msg.sender, additionalQuantity);
    }

    function _publishItem(
        uint256 price,
        uint256 creatorDepositMultiplier,
        uint256 duration,
        string memory ipfsHash,
        uint256 quantity,
        bool isBatch,
        Country country,
        TaskCategory taskCategory
    ) internal returns (uint256) {
        require(price > 0 && price <= 1e14, "Price out of range");
        require(quantity > 0, "Quantity must be positive");
        require(duration > 0, "Invalid duration");
        require(creatorDepositMultiplier > 0, "The multiple must be greater than 0");

        uint256 itemId = itemCounter;
        unchecked {
            itemCounter++;
        }
        items[itemId] = Item({
            creator: msg.sender,
            price: price,
            creatorDepositMultiplier: creatorDepositMultiplier,
            duration: duration,
            ipfsHash: ipfsHash,
            totalQuantity: quantity,
            availableQuantity: quantity,
            active: true,
            country: country,
            taskCategory: taskCategory
        });

        createNFT(msg.sender, itemId, ipfsHash);

        if (!isBatch) {
            emit ItemPublished(itemId, msg.sender, price, quantity, uint8(country), uint8(taskCategory));
        }

        return itemId;
    }

    function publishItem(
        uint256 price,
        uint256 creatorDepositMultiplier,
        uint256 duration,
        string memory ipfsHash,
        uint256 quantity,
        Country country,
        TaskCategory taskCategory
    ) external nonReentrant whenNotPaused returns (uint256) {
        uint256 itemId = _publishItem(
            price,
            creatorDepositMultiplier,
            duration,
            ipfsHash,
            quantity,
            false,
            country,
            taskCategory
        );
        uint256 deposit = price * creatorDepositMultiplier * quantity;
        IERC20(erc20Token).transferFrom(msg.sender, address(this), deposit);

        return itemId;
    }

    function batchPublishItems(
        uint256[] memory prices,
        uint256[] memory creatorDepositMultipliers,
        uint256[] memory durations,
        string[] memory ipfsHashes,
        uint256[] memory quantities,
        Country[] memory countries,
        TaskCategory[] memory taskCategories
    ) external nonReentrant whenNotPaused returns (uint256[] memory) {
        require(prices.length == quantities.length, "Array length mismatch");
        require(prices.length == creatorDepositMultipliers.length, "Array length mismatch");
        require(prices.length == durations.length, "Array length mismatch");
        require(prices.length == ipfsHashes.length, "Array length mismatch");
        require(prices.length == countries.length, "Array length mismatch");
        require(prices.length == taskCategories.length, "Array length mismatch");

        uint256[] memory itemIds = new uint256[](prices.length);
        uint256 totalDeposit;
        uint8[] memory emittedCountries = new uint8[](prices.length);
        uint8[] memory emittedTaskCategories = new uint8[](prices.length);
        for (uint256 i = 0; i < prices.length; i++) {
            itemIds[i] = _publishItem(
                prices[i],
                creatorDepositMultipliers[i],
                durations[i],
                ipfsHashes[i],
                quantities[i],
                true,
                countries[i],
                taskCategories[i]
            );
            totalDeposit += prices[i] * creatorDepositMultipliers[i] * quantities[i];
            emittedCountries[i] = uint8(countries[i]);
            emittedTaskCategories[i] = uint8(taskCategories[i]);
        }
        IERC20(erc20Token).transferFrom(msg.sender, address(this), totalDeposit);
        emit ItemsBatchPublished(itemIds, msg.sender, emittedCountries, emittedTaskCategories);
        return itemIds;
    }

    function withdrawItem(uint256 itemId, uint256 quantity) external nonReentrant whenNotPaused {
        Item storage item = items[itemId];
        require(item.active, "Item not active");
        require(item.creator == msg.sender, "Not creator");
        require(item.availableQuantity >= quantity, "Insufficient quantity");

        uint256 refund = item.price * item.creatorDepositMultiplier * quantity;
        item.availableQuantity -= quantity;
        item.totalQuantity -= quantity;
        if (item.availableQuantity == 0) {
            item.active = false;
            _burn(itemId);
        }
        emit ItemWithdraw(itemId, quantity);
        IERC20(erc20Token).transfer(msg.sender, refund);
    }

    function _requestTransaction(
        uint256 itemId,
        bool isBatch,
        uint256 buyerDepositMultiplier
    ) internal returns (uint256) {
        Item storage item = items[itemId];
        require(item.active && item.availableQuantity > 0, "Item not available");
        require(item.creator != msg.sender, "Cannot be picked up by oneself");
        require(buyerDepositMultiplier > 0, "The multiple must be greater than 0");

        uint256 deposit = item.price * buyerDepositMultiplier;

        uint256 transactionId = transactionCounter;
        unchecked {
            transactionCounter++;
        }
        transactions[transactionId] = Transaction({
            itemId: itemId,
            participant: msg.sender,
            nftId: 0,
            buyerDepositMultiplier: buyerDepositMultiplier,
            deposit: deposit,
            endTime: 0,
            status: 0
        });

        if (!isBatch) {
            emit TransactionRequested(transactionId, itemId, msg.sender, buyerDepositMultiplier);
        }

        return transactionId;
    }

    function requestTransaction(
        uint256 itemId,
        uint256 buyerDepositMultiplier
    ) external nonReentrant whenNotPaused returns (uint256) {
        uint256 transactionId = _requestTransaction(itemId, false, buyerDepositMultiplier);
        Transaction storage txn = transactions[transactionId];
        IERC20(erc20Token).transferFrom(msg.sender, address(this), txn.deposit);
        return transactionId;
    }

    function batchRequestTransactions(
        uint256[] memory itemIds,
        uint256[] memory buyerDepositMultipliers
    ) external nonReentrant whenNotPaused returns (uint256[] memory) {
        require(itemIds.length == buyerDepositMultipliers.length, "Array length mismatch");

        uint256[] memory transactionIds = new uint256[](itemIds.length);
        uint256 totalDeposit;
        for (uint256 i = 0; i < itemIds.length; i++) {
            transactionIds[i] = _requestTransaction(itemIds[i], true, buyerDepositMultipliers[i]);
            totalDeposit += transactions[transactionIds[i]].deposit;
        }
        IERC20(erc20Token).transferFrom(msg.sender, address(this), totalDeposit);
        emit TransactionsBatchRequested(transactionIds, itemIds, msg.sender,buyerDepositMultipliers);
        return transactionIds;
    }


    function batchCancelTransactions(uint256[] memory transactionIds) external nonReentrant whenNotPaused {
        uint256 totalRefund;
        for (uint256 i = 0; i < transactionIds.length; i++) {
            Transaction storage txn = transactions[transactionIds[i]];
            require(txn.participant == msg.sender, "Not participant");
            require(txn.status == 0, "Transaction not pending");
            totalRefund += txn.deposit;
            // Item storage item = items[txn.itemId];
            txn.status = 4;

            emit TransactionCancelled(transactionIds[i]);
        }
        IERC20(erc20Token).transfer(msg.sender, totalRefund);
    }

    function _approveTransaction(uint256 transactionId, bool isBatch) internal returns (uint256) {
        Transaction storage txn = transactions[transactionId];
        Item storage item = items[txn.itemId];
        require(item.creator == msg.sender, "Not creator");
        require(txn.status == 0, "Transaction not pending");
        require(item.availableQuantity > 0, "No available quantity");

        txn.nftId = txn.itemId;
        item.availableQuantity--;
        txn.status = 1;
        txn.endTime = block.timestamp + item.duration;

        if (!isBatch) {
            emit TransactionApproved(transactionId, txn.participant);
        }

        return transactionId;
    }

    function approveTransaction(uint256 transactionId) external nonReentrant whenNotPaused returns (uint256) {
        return _approveTransaction(transactionId, false);
    }

    function batchApproveTransactions(uint256[] memory transactionIds)
        external
        nonReentrant
        whenNotPaused
        returns (uint256[] memory)
    {
        uint256[] memory approvedIds = new uint256[](transactionIds.length);

        for (uint256 i = 0; i < transactionIds.length; i++) {
            approvedIds[i] = _approveTransaction(transactionIds[i], true);
        }

        emit TransactionsBatchApproved(approvedIds, msg.sender);
        return approvedIds;
    }

    function confirmReceipt(uint256 transactionId, uint8 status) external nonReentrant whenNotPaused {
        Transaction storage txn = transactions[transactionId];
        Item storage item = items[txn.itemId];
        require(txn.participant == msg.sender, "Not authorized");
        require(txn.status == 1, "Transaction not active");
        require(status == 2 || status == 3, "Invalid status");
        require(block.timestamp <= txn.endTime, "Transaction timed out");

        IERC20(erc20Token).transfer(item.creator, item.price);
        IERC20(erc20Token).transfer(txn.participant, txn.deposit - item.price);

        updateReputation(item.creator, status);
        updateReputation(txn.participant, status);
        item.availableQuantity++;

        txn.status = status;
        emit TransactionConfirmed(transactionId, status);
    }

    function _handleTimeout(uint256 transactionId, bool isBatch) internal {
        Transaction storage txn = transactions[transactionId];
        require(txn.status == 1, "Transaction not active");
        require(block.timestamp > txn.endTime, "Not timed out");
        Item storage item = items[txn.itemId];

        item.totalQuantity--;

        updateReputation(item.creator, 4);
        updateReputation(txn.participant, 4);

        txn.status = 4;
        if (!isBatch) {
            emit TransactionTimedOut(transactionId);
        }

    }

    function handleTimeout(uint256 transactionId) external onlyOwner nonReentrant whenNotPaused {
        Transaction storage txn = transactions[transactionId];
        Item storage item = items[txn.itemId];
        _handleTimeout(transactionId, false);
        uint256 totalTransfer = txn.deposit + (item.price * item.creatorDepositMultiplier);
        IERC20(erc20Token).transfer(platformWallet, totalTransfer);
    }

    function batchHandleTimeout(uint256[] memory transactionIds) external onlyOwner nonReentrant whenNotPaused {
        uint256 totalTransfer;
        for (uint256 i = 0; i < transactionIds.length; i++) {
            Transaction storage txn = transactions[transactionIds[i]];
            Item storage item = items[txn.itemId];
            _handleTimeout(transactionIds[i], true);
            totalTransfer += txn.deposit + (item.price * item.creatorDepositMultiplier);
        }
        IERC20(erc20Token).transfer(platformWallet, totalTransfer);
        emit TransactionBatchTimedOut(transactionIds);
    }

    function getItemDetails(uint256 itemId) external view returns (
        address creator,
        uint256 price,
        uint256 creatorDepositMultiplier,
        uint256 duration,
        string memory ipfsHash,
        uint256 totalQuantity,
        uint256 availableQuantity,
        bool active,
        Country country,
        TaskCategory taskCategory
    ) {
        Item storage item = items[itemId];
        return (
            item.creator,
            item.price,
            item.creatorDepositMultiplier,
            item.duration,
            item.ipfsHash,
            item.totalQuantity,
            item.availableQuantity,
            item.active,
            item.country,
            item.taskCategory
        );
    }

    function getTransactionDetails(uint256 transactionId) external view returns (
        uint256 itemId,
        address participant,
        uint256 nftId,
        uint256 buyerDepositMultiplier,
        uint256 deposit,
        uint256 endTime,
        uint8 status
    ) {
        Transaction storage txn = transactions[transactionId];
        return (
            txn.itemId,
            txn.participant,
            txn.nftId,
            txn.buyerDepositMultiplier,
            txn.deposit,
            txn.endTime,
            txn.status
        );
    }
    function timestamp() external view returns (uint256){
        return block.timestamp;
    }
    function setErc20Token(address _erc20Token) external onlyOwner returns(bool){
        erc20Token = _erc20Token;
        return true;
    }
    // 禁止接收 ETH
    receive() external payable {
        revert("ETH not accepted");
    }
}