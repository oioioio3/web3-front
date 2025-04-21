# 市场合约功能分析

本文档为 `MarketplaceContract.sol`、`NFTSimple.sol` 和 `ReputationContract.sol` 智能合约提供功能概述，适用于去中心化市场。合约支持创建者发布商品（以 NFT 形式表示）、参与者请求交易，并管理交易生命周期和用户信誉。市场使用固定 ERC20 代币（6 位小数）进行支付和质押，禁止接收以太币（ETH）。

## 目录
1. [概述](#概述)
2. [结构体定义](#结构体定义)
   - [Item（MarketplaceContract）](#itemmarketplacecontract)
   - [Transaction（MarketplaceContract）](#transactionmarketplacecontract)
   - [Reputation（ReputationContract）](#reputationreputationcontract)
3. [合约功能](#合约功能)
   - [MarketplaceContract](#marketplacecontract)
   - [NFTSimple](#nftsimple)
   - [ReputationContract](#reputationcontract)

## 概述
`MarketplaceContract` 是核心合约，继承了 `NFTSimple`（用于 NFT 管理）、`ReputationContract`（用于用户信誉）、`ReentrancyGuard`（用于安全）和 `Pausable`（用于紧急控制）。主要功能包括：
- **商品发布**：创建者发布商品（以 NFT 表示），指定价格、质押要求和元数据。
- **交易管理**：参与者请求交易，创建者批准交易，参与者确认完成或协商结果。
- **超时处理**：平台所有者可处理超时的交易，将质押转移至平台钱包。
- **信誉跟踪**：记录创建者和参与者的成功、协商和超时交易。
- **NFT 管理**：商品以不可转移的 NFT 表示，由创建者铸造，撤回时销毁。
- **暂停控制**：所有者可暂停/取消暂停合约以停止操作。

所有支付和质押使用 ERC20 代币（6 位小数）。合约不接受 ETH。

## 结构体定义

### Item（MarketplaceContract）
表示创建者发布的商品（产品或服务），存储在 `items` 映射中。

| 参数                      | 类型      | 描述                                                                 |
|---------------------------|-----------|----------------------------------------------------------------------|
| `creator`                 | `address` | 商品发布者的地址（卖家或服务提供者）。                               |
| `price`                   | `uint256` | 商品单价，单位为 ERC20 代币最小单位（6 位小数，例如 `1e6` = 1 代币）。 |
| `creatorDepositMultiplier`| `uint256` | 创建者质押倍数（例如，`2` 表示质押 = `price * 2`）。                 |
| `buyerDepositMultiplier`  | `uint256` | 参与者质押倍数（例如，`1` 表示质押 = `price * 1`）。                 |
| `duration`                | `uint256` | 交易最长持续时间，单位为秒（例如，`86400` 表示 1 天）。              |
| `ipfsHash`                | `string`  | 商品元数据的 IPFS 哈希（例如，描述、图片）。                         |
| `totalQuantity`           | `uint256` | 商品总单位数（NFT 数量）。                                           |
| `availableQuantity`       | `uint256` | 可用于交易的剩余单位数。                                             |
| `active`                  | `bool`    | 商品是否有效（`true` 表示有效，`false` 表示已撤回或无效）。          |

### Transaction（MarketplaceContract）
表示商品的交易，存储在 `transactions` 映射中。

| 参数           | 类型      | 描述                                                                 |
|----------------|-----------|----------------------------------------------------------------------|
| `itemId`       | `uint256` | 交易关联的商品 ID。                                                  |
| `participant`  | `address` | 参与者（买家或服务接收者）的地址。                                   |
| `nftId`        | `uint256` | 交易关联的 NFT ID（批准后设置）。                                    |
| `deposit`      | `uint256` | 参与者质押的代币数量（例如，`price * buyerDepositMultiplier`）。      |
| `endTime`      | `uint256` | 交易截止时间戳（批准后设置）。                                       |
| `status`       | `uint8`   | 交易状态：`0`（待确认），`1`（进行中），`2`（成功），`3`（协商），`4`（超时/取消）。 |

### Reputation（ReputationContract）
跟踪用户的交易信誉，存储在 `reputations` 映射中。

| 参数                | 类型      | 描述                                                                 |
|---------------------|-----------|----------------------------------------------------------------------|
| `successfulTrades`  | `uint256` | 成功完成的交易数量（状态 `2`）。                                     |
| `negotiatedTrades`  | `uint256` | 通过协商完成的交易数量（状态 `3`）。                                 |
| `timedOutTrades`    | `uint256` | 超时或取消的交易数量（状态 `4`）。                                   |

## 合约功能

### MarketplaceContract
市场操作的核心合约。

#### 构造函数
```solidity
constructor(address _erc20Token)
```
- **用途**：初始化合约，设置 ERC20 代币地址，并将平台钱包和 NFT 所有者设为部署者。
- **参数**：
  - `_erc20Token`：用于支付和质押的 ERC20 代币合约地址（6 位小数）。
- **效果**：设置 `erc20Token` 和 `platformWallet`，初始化 NFT 合约。

#### pause
```solidity
function pause() external onlyOwner
```
- **用途**：暂停合约，禁用非视图函数。
- **参数**：无。
- **效果**：将合约置于暂停状态（通过 `Pausable`）。

#### unpause
```solidity
function unpause() external onlyOwner
```
- **用途**：取消暂停合约，重新启用非视图函数。
- **参数**：无。
- **效果**：将合约置于非暂停状态（通过 `Pausable`）。

#### addItemQuantity
```solidity
function addItemQuantity(uint256 itemId, uint256 additionalQuantity) external nonReentrant whenNotPaused
```
- **用途**：允许商品创建者增加有效商品的单位数量。
- **参数**：
  - `itemId`：要更新的商品 ID。
  - `additionalQuantity`：要添加的单位数量。
- **效果**：
  - 要求调用者是商品创建者且商品有效。
  - 从调用者转入 `price * creatorDepositMultiplier * additionalQuantity` 代币作为质押。
  - 增加 `totalQuantity` 和 `availableQuantity`。
  - 触发 `ItemQuantityAdded` 事件。

#### publishItem
```solidity
function publishItem(uint256 price, uint256 creatorDepositMultiplier, uint256 buyerDepositMultiplier, uint256 duration, string memory ipfsHash, uint256 quantity) external nonReentrant whenNotPaused returns (uint256)
```
- **用途**：发布单个商品（以 NFT 表示），可用于交易。
- **参数**：
  - `price`：商品单价，单位为代币最小单位（6 位小数，最大 `1e14`）。
  - `creatorDepositMultiplier`：创建者质押倍数。
  - `buyerDepositMultiplier`：参与者质押倍数。
  - `duration`：交易最长持续时间（秒）。
  - `ipfsHash`：商品元数据的 IPFS 哈希。
  - `quantity`：发布的商品单位数量。
- **效果**：
  - 从调用者转入 `price * creatorDepositMultiplier * quantity` 代币作为质押。
  - 创建商品并铸造 NFT。
  - 触发 `ItemPublished` 事件。
- **返回**：创建的商品 ID。

#### batchPublishItems
```solidity
function batchPublishItems(uint256[] memory prices, uint256[] memory creatorDepositMultipliers, uint256[] memory buyerDepositMultipliers, uint256[] memory durations, string[] memory ipfsHashes, uint256[] memory quantities) external nonReentrant whenNotPaused returns (uint256[] memory)
```
- **用途**：一次性发布多个商品。
- **参数**：
  - `prices`：商品单价数组（6 位小数，最大 `1e14`）。
  - `creatorDepositMultipliers`：创建者质押倍数数组。
  - `buyerDepositMultipliers`：参与者质押倍数数组。
  - `durations`：交易持续时间数组（秒）。
  - `ipfsHashes`：商品元数据 IPFS 哈希数组。
  - `quantities`：商品单位数量数组。
- **效果**：
  - 从调用者转入所有商品的质押总和（`prices[i] * creatorDepositMultipliers[i] * quantities[i]`）。
  - 创建多个商品并铸造对应 NFT。
  - 触发 `ItemsBatchPublished` 事件。
- **返回**：创建的商品 ID 数组。

#### withdrawItem
```solidity
function withdrawItem(uint256 itemId, uint256 quantity) external nonReentrant whenNotPaused
```
- **用途**：允许创建者撤回商品的部分或全部单位，退还质押。
- **参数**：
  - `itemId`：要撤回的商品 ID。
  - `quantity`：要撤回的单位数量。
- **效果**：
  - 要求调用者是商品创建者且有足够可用数量。
  - 退还 `price * creatorDepositMultiplier * quantity` 代币给调用者。
  - 减少 `totalQuantity` 和 `availableQuantity`。
  - 如果 `availableQuantity` 变为 0，标记商品为无效并销毁 NFT。
- **效果**：无事件触发。

#### requestTransaction
```solidity
function requestTransaction(uint256 itemId) external nonReentrant whenNotPaused returns (uint256)
```
- **用途**：允许参与者为商品请求交易。
- **参数**：
  - `itemId`：请求的商品 ID。
- **效果**：
  - 要求商品有效、有可用数量，且调用者不是创建者。
  - 从调用者转入 `price * buyerDepositMultiplier` 代币作为质押。
  - 创建待确认交易（状态 `0`）。
  - 触发 `TransactionRequested` 事件。
- **返回**：创建的交易 ID。

#### batchRequestTransactions
```solidity
function batchRequestTransactions(uint256[] memory itemIds) external nonReentrant whenNotPaused returns (uint256[] memory)
```
- **用途**：允许参与者为多个商品请求交易。
- **参数**：
  - `itemIds`：请求的商品 ID 数组。
- **效果**：
  - 从调用者转入每个商品的质押总和（`price * buyerDepositMultiplier`）。
  - 为每个商品创建待确认交易（状态 `0`）。
  - 触发 `TransactionsBatchRequested` 事件。
- **返回**：创建的交易 ID 数组。

#### batchCancelTransactions
```solidity
function batchCancelTransactions(uint256[] memory transactionIds) external nonReentrant whenNotPaused
```
- **用途**：允许参与者取消多个待确认交易。
- **参数**：
  - `transactionIds`：要取消的交易 ID 数组。
- **效果**：
  - 要求调用者是参与者且交易为待确认（状态 `0`）。
  - 退还所有交易的质押总和给调用者。
  - 将交易状态设为 `4`（取消）。
  - 为每个交易触发 `TransactionCancelled` 事件。

#### approveTransaction
```solidity
function approveTransaction(uint256 transactionId) external nonReentrant whenNotPaused returns (uint256)
```
- **用途**：允许商品创建者批准单个待确认交易。
- **参数**：
  - `transactionId`：要批准的交易 ID。
- **效果**：
  - 要求调用者是商品创建者，交易为待确认（状态 `0`），且商品有可用数量。
  - 设置交易状态为 `1`（进行中），记录 NFT ID，减少商品可用数量，设置截止时间。
  - 触发 `TransactionApproved` 事件。
- **返回**：批准的交易 ID。

#### batchApproveTransactions
```solidity
function batchApproveTransactions(uint256[] memory transactionIds) external nonReentrant whenNotPaused returns (uint256[] memory)
```
- **用途**：允许商品创建者批准多个待确认交易。
- **参数**：
  - `transactionIds`：要批准的交易 ID 数组。
- **效果**：
  - 为每个交易设置状态为 `1`（进行中），记录 NFT ID，减少商品可用数量，设置截止时间。
  - 触发 `TransactionsBatchApproved` 事件。
- **返回**：批准的交易 ID 数组。

#### confirmReceipt
```solidity
function confirmReceipt(uint256 transactionId, uint8 status) external nonReentrant whenNotPaused
```
- **用途**：允许参与者确认交易完成（成功或协商）。
- **参数**：
  - `transactionId`：要确认的交易 ID。
  - `status`：确认状态（`2` 表示成功，`3` 表示协商）。
- **效果**：
  - 要求调用者是参与者，交易为进行中（状态 `1`），未超时，且状态有效。
  - 向创建者转移 `price` 代币，向参与者退还 `deposit - price` 代币。
  - 更新创建者和参与者的信誉。
  - 增加商品可用数量（重新上架）。
  - 设置交易状态为 `status`。
  - 触发 `TransactionConfirmed` 事件。

#### handleTimeout
```solidity
function handleTimeout(uint256 transactionId) external onlyOwner nonReentrant whenNotPaused
```
- **用途**：允许平台所有者处理单个超时交易。
- **参数**：
  - `transactionId`：要处理的交易 ID。
- **效果**：
  - 要求交易为进行中（状态 `1`）且已超时。
  - 将 `deposit` 和 `price * creatorDepositMultiplier` 代币转移至平台钱包。
  - 减少商品总数量。
  - 更新创建者和参与者的信誉（超时）。
  - 设置交易状态为 `4`（超时）。
  - 触发 `TransactionTimedOut` 事件。

#### batchHandleTimeout
```solidity
function batchHandleTimeout(uint256[] memory transactionIds) external onlyOwner nonReentrant whenNotPaused
```
- **用途**：允许平台所有者处理多个超时交易。
- **参数**：
  - `transactionIds`：要处理的交易 ID 数组。
- **效果**：
  - 为每个交易转移 `deposit` 和 `price * creatorDepositMultiplier` 代币至平台钱包。
  - 减少每个商品的总数量。
  - 更新创建者和参与者的信誉（超时）。
  - 设置交易状态为 `4`（超时）。
  - 触发 `TransactionBatchTimedOut` 事件。

#### getItemDetails
```solidity
function getItemDetails(uint256 itemId) external view returns (address creator, uint256 price, uint256 creatorDepositMultiplier, uint256 buyerDepositMultiplier, uint256 duration, string memory ipfsHash, uint256 totalQuantity, uint256 availableQuantity, bool active)
```
- **用途**：查询商品的详细信息。
- **参数**：
  - `itemId`：要查询的商品 ID。
- **返回**：
  - `creator`：商品创建者地址。
  - `price`：商品单价。
  - `creatorDepositMultiplier`：创建者质押倍数。
  - `buyerDepositMultiplier`：参与者质押倍数。
  - `duration`：交易持续时间。
  - `ipfsHash`：IPFS 元数据哈希。
  - `totalQuantity`：总单位数量。
  - `availableQuantity`：可用单位数量。
  - `active`：商品是否有效。

#### getTransactionDetails
```solidity
function getTransactionDetails(uint256 transactionId) external view returns (uint256 itemId, address participant, uint256 nftId, uint256 deposit, uint256 endTime, uint8 status)
```
- **用途**：查询交易的详细信息。
- **参数**：
  - `transactionId`：要查询的交易 ID。
- **返回**：
  - `itemId`：关联的商品 ID。
  - `participant`：参与者地址。
  - `nftId`：关联的 NFT ID。
  - `deposit`：参与者质押金额。
  - `endTime`：交易截止时间。
  - `status`：交易状态。

#### timestamp
```solidity
function timestamp() external view returns (uint256)
```
- **用途**：返回当前区块时间戳。
- **参数**：无。
- **返回**：当前时间戳（秒）。

#### setErc20Token
```solidity
function setErc20Token(address _erc20Token) external onlyOwner returns (bool)
```
- **用途**：允许平台所有者更新 ERC20 代币地址。
- **参数**：
  - `_erc20Token`：新的 ERC20 代币合约地址。
- **效果**：更新 `erc20Token` 地址。
- **返回**：`true` 表示成功。

#### receive
```solidity
receive() external payable
```
- **用途**：禁止合约接收 ETH。
- **效果**：任何 ETH 转账都会失败并抛出错误“ETH not accepted”。

### NFTSimple
管理不可转移的 NFT，表示市场中的商品。

#### Constructor
```solidity
constructor(address _owner)
```
- **用途**：初始化 NFT 合约，设置名称和符号。
- **参数**：
  - `_owner`：NFT 合约的所有者地址。
- **效果**：设置 `owner`、`name`（“MarketplaceNFT”）和 `symbol`（“MNFT”）。

#### balanceOf
```solidity
function balanceOf(address _owner) public view virtual returns (uint256)
```
- **用途**：查询地址拥有的 NFT 数量。
- **参数**：
  - `_owner`：要查询的地址。
- **返回**：NFT 数量。

#### ownerOf
```solidity
function ownerOf(uint256 tokenId) public view virtual returns (address)
```
- **用途**：查询 NFT 的所有者。
- **参数**：
  - `tokenId`：NFT ID。
- **返回**：所有者地址。

#### name
```solidity
function name() public view virtual returns (string memory)
```
- **用途**：返回 NFT 集合名称。
- **返回**：“MarketplaceNFT”。

#### symbol
```solidity
function symbol() public view virtual returns (string memory)
```
- **用途**：返回 NFT 集合符号。
- **返回**：“MNFT”。

#### tokenURI
```solidity
function tokenURI(uint256 tokenId) public view virtual returns (string memory)
```
- **用途**：查询 NFT 的元数据 URI。
- **参数**：
  - `tokenId`：NFT ID。
- **返回**：IPFS 元数据哈希。

### ReputationContract
跟踪用户信誉。

#### getReputation
```solidity
function getReputation(address account) public view returns (uint256 successfulTrades, uint256 negotiatedTrades, uint256 timedOutTrades)
```
- **用途**：查询用户的信誉记录。
- **参数**：
  - `account`：要查询的地址。
- **返回**：
  - `successfulTrades`：成功交易数量。
  - `negotiatedTrades`：协商交易数量。
  - `timedOutTrades`：超时/取消交易数量。