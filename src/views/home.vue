<script setup>
import { reactive, onMounted, ref } from 'vue';
import Web3 from 'web3';
import { getBalanceApi } from '@/apis/contracts/web3';
import { initWeb, getBalanceOf } from '@/apis/contracts/eCNY';
import { 
  initWeb as initMarketWeb, 
  getBalanceOf as getMarketBalanceOf,
  getTotalItemCount,
  getItemInfo,
  getUserItems,
  getMarketStatus,
  publishItem,
  increaseItemQuantity,
  requestTransaction,
  getUserReputation,
  getTransactionCount,
  getTransactionDetails,
  getUserTransactions,
  approveTransaction,
  confirmTransaction,
  handleTimeoutTransaction,
  withdrawItem,
  prepareItemMetadata,
  getItemCreatorDeposit,
  getItemBuyerDeposit,
  getItemDetails,
  batchPublishItems,
  batchPrepareItemMetadata,
  batchRequestTransactions,
  batchApproveTransactions,
  batchHandleTimeoutTransactions
} from '@/apis/contracts/market';

const marketData = ref({
  userAddress: '',
  itemCount: 0,
  marketActive: false,
  userItems: [],
  itemDetails: [],
  allItems: [],
  transactionCount: 0,
  userTransactions: [],
  userBalance: 0,
  userTokenBalance: 0,
  userReputation: 0,
  successCount: 0,
  failCount: 0
});

// 用户余额信息
const userBalances = ref({
  walletBalance: '0',
  tokenBalance: '0',
  marketTokenBalance: '0'
});

const loading = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

// 发布商品表单
const publishForm = ref({
  name: '',
  description: '',
  price: '',
  creatorDepositMultiplier: 1,
  buyerDepositMultiplier: 1,
  duration: 86400, // 默认1天（秒）
  quantity: 1,
  imageFile: null
});

// 增加数量表单
const quantityForm = ref({
  itemId: '',
  quantity: 1
});

// 购买表单
const buyForm = ref({
  itemId: '',
  quantity: 1
});

// 撤回商品表单
const withdrawForm = ref({
  itemId: '',
  quantity: 1
});

// 交易管理表单
const transactionForm = ref({
  transactionId: '',
  status: 2 // 默认为成功完成
});

// 弹窗状态
const showPublishForm = ref(false);
const showQuantityForm = ref(false);
const showBuyForm = ref(false);
const showWithdrawForm = ref(false);
const showTransactionForm = ref(false);
const showTransactionDetails = ref(false);

// 选中的交易详情
const selectedTransaction = ref(null);

// 当前激活的标签
const activeTab = ref('market'); // 'market', 'myItems', 'myTransactions'

// 用户信誉
const userReputation = ref(null);

// 添加eCNY交易说明提示
const showTokenInfo = ref(false);

// 信誉信息弹窗
const showReputationInfo = ref(false);
const reputationAddress = ref('');

// 批量发布商品表单
const batchPublishForm = ref({
  items: [
    {
      name: '',
      description: '',
      price: '',
      creatorDepositMultiplier: 1,
      buyerDepositMultiplier: 1,
      duration: 86400, // 默认1天（秒）
      quantity: 1,
      imageFile: null
    }
  ]
});

// 批量购买表单
const batchBuyForm = ref({
  items: [] // 改为数组对象，每个对象包含itemId和quantity
});

// 批量交易管理表单
const batchTransactionForm = ref({
  transactionIds: []
});

// 弹窗状态 - 添加批量操作相关弹窗
const showBatchPublishForm = ref(false);
const showBatchBuyForm = ref(false);
const showBatchTransactionForm = ref(false);

// 缩短地址显示
const shortenAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

// 方法：加载市场数据
const loadMarketData = async () => {
  try {
    loading.value = true;
    errorMsg.value = '';
    
    const balance = await getBalanceApi('0xD679224b4B2512A878Ef12386132e6A4d6e05dBb');
    userBalances.value.walletBalance = balance;
    console.log("用户的钱包余额" + balance);

    const accounts = await initWeb();
    console.log("用户的账户" + accounts[0]);

    const token = await getBalanceOf("0xD679224b4B2512A878Ef12386132e6A4d6e05dBb");
    userBalances.value.tokenBalance = token;
    console.log("用户的代币数量" + token);

    // 从市场合约获取数据
    const marketAccounts = await initMarketWeb();
    if (marketAccounts && marketAccounts.length > 0) {
      marketData.value.userAddress = marketAccounts[0];
      console.log("市场合约连接账户：" + marketAccounts[0]);
      
      // const marketToken = await getMarketBalanceOf(marketAccounts[0]);
      // userBalances.value.marketTokenBalance = marketToken;
      // console.log("用户在市场合约中的代币数量：" + marketToken);
      
      // 获取用户信誉
      userReputation.value = await getUserReputation(marketAccounts[0]);
      console.log("用户信誉:", userReputation.value);
      
      // 获取市场商品总数
      const itemCount = await getTotalItemCount();
      marketData.value.itemCount = itemCount;
      console.log("市场商品总数：" + itemCount);
      
      // 获取交易总数
      const transactionCount = await getTransactionCount();
      marketData.value.transactionCount = transactionCount;
      console.log("交易总数：" + transactionCount);
      
      // 获取市场状态
      const isActive = await getMarketStatus();
      marketData.value.marketActive = isActive;
      console.log("市场是否激活：" + isActive);
      
      // 获取用户拥有的商品
      const userItems = await getUserItems(marketAccounts[0]);
      marketData.value.userItems = userItems;
      console.log("用户拥有的商品ID：", userItems);
      
      // 获取商品详情
      marketData.value.itemDetails = [];
      if (userItems && userItems.length > 0) {
        for (let i = 0; i < userItems.length; i++) {
          const itemInfo = await getItemInfo(userItems[i]);
          if (itemInfo) {
            marketData.value.itemDetails.push(itemInfo);
            console.log(`商品${userItems[i]}信息:`, itemInfo);
          }
        }
      }
      
      // 获取所有商品
      marketData.value.allItems = [];
      for (let i = 1; i <= itemCount + 1; i++) {
        try {
          const itemInfo = await getItemInfo(i.toString());
          if (itemInfo && itemInfo.active) {
            marketData.value.allItems.push(itemInfo);
          }
        } catch (error) {
          console.error(`获取商品${i}信息失败:`, error);
        }
      }
      
      // 获取用户的交易
      const userTransactions = await getUserTransactions(marketAccounts[0]);
      marketData.value.userTransactions = userTransactions;
      console.log("用户交易:", userTransactions);
    }
  } catch (error) {
    console.error("获取数据时出错:", error);
    errorMsg.value = '获取区块链数据失败，请检查网络连接并确保钱包已连接';
  } finally {
    loading.value = false;
  }
};

// 方法：发布商品
const handlePublish = async () => {
  try {
    // 表单验证
    if (!publishForm.value.name || !publishForm.value.description || !publishForm.value.price || 
        !publishForm.value.quantity || publishForm.value.creatorDepositMultiplier < 1 || 
        publishForm.value.buyerDepositMultiplier < 1 || publishForm.value.duration < 60) {
      errorMsg.value = '请填写完整信息，保证金倍数必须大于等于1，持续时间必须大于60秒';
      return;
    }
    
    // 验证价格
    const price = parseFloat(publishForm.value.price);
    if (isNaN(price) || price <= 0) {
      errorMsg.value = '请输入有效的价格（大于0）';
      return;
    }
    
    // 验证价格最小单位
    if (price < 0.000001) {
      errorMsg.value = '价格不能小于0.000001 eCNY（最小单位）';
      return;
    }
    
    loading.value = true;
    errorMsg.value = '';
    successMsg.value = '';
    
    // 开始发布流程
    console.log("开始商品发布流程...");
    console.log("商品信息:", publishForm.value);
    
    // 步骤1: 上传图片和元数据到IPFS
    console.log("步骤1: 准备上传图片和元数据到IPFS");
    let ipfsHash;
    try {
      ipfsHash = await prepareItemMetadata(
        publishForm.value.name, 
        publishForm.value.description,
        publishForm.value.imageFile
      );
      console.log("IPFS元数据上传成功，哈希:", ipfsHash);
      successMsg.value = "文件上传成功! 正在继续处理交易...";
      // 强制刷新UI以展示中间状态
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (ipfsError) {
      console.error("IPFS上传失败:", ipfsError);
      errorMsg.value = `文件上传失败: ${ipfsError.message}`;
      loading.value = false;
      return;
    }
    
    // 步骤2: 调用智能合约发布商品
    console.log("步骤2: 调用智能合约发布商品");
    try {
      const result = await publishItem(
        publishForm.value.price,
        publishForm.value.creatorDepositMultiplier,
        publishForm.value.buyerDepositMultiplier,
        publishForm.value.duration,
        ipfsHash,
        publishForm.value.quantity
      );
      
      console.log("合约调用结果:", result);
      
      if (result.success) {
        successMsg.value = result.message;
        // 重置表单
        publishForm.value = {
          name: '',
          description: '',
          price: '',
          creatorDepositMultiplier: 1,
          buyerDepositMultiplier: 1,
          duration: 86400,
          quantity: 1,
          imageFile: null
        };
        showPublishForm.value = false;
        
        // 重新加载数据
        await loadMarketData();
      } else {
        errorMsg.value = result.message;
      }
    } catch (contractError) {
      console.error("调用合约失败:", contractError);
      errorMsg.value = `发布商品失败: ${contractError.message}`;
    }
  } catch (error) {
    console.error("发布商品整体流程出错:", error);
    errorMsg.value = error.message || '发布过程中发生未知错误';
  } finally {
    loading.value = false;
  }
};

// 方法：增加商品数量
const handleIncreaseQuantity = async () => {
  try {
    if (!quantityForm.value.itemId || !quantityForm.value.quantity) {
      errorMsg.value = '请选择商品并填写数量';
      return;
    }
    
    loading.value = true;
    errorMsg.value = '';
    
    const result = await increaseItemQuantity(
      quantityForm.value.itemId,
      quantityForm.value.quantity
    );
    
    if (result.success) {
      successMsg.value = result.message;
      // 重置表单
      quantityForm.value = {
        itemId: '',
        quantity: 1
      };
      showQuantityForm.value = false;
      
      // 重新加载数据
      await loadMarketData();
    } else {
      errorMsg.value = result.message;
    }
  } catch (error) {
    console.error("增加商品数量出错:", error);
    errorMsg.value = error.message || '操作失败';
  } finally {
    loading.value = false;
  }
};

// 方法：购买商品
const handleBuy = async () => {
  try {
    if (!buyForm.value.itemId) {
      errorMsg.value = '请选择要购买的商品';
      return;
    }
    
    if (buyForm.value.quantity <= 0) {
      errorMsg.value = '购买数量必须大于0';
      return;
    }
    
    loading.value = true;
    errorMsg.value = '';
    
    // 如果数量为1，直接使用单个交易
    if (buyForm.value.quantity === 1) {
      const result = await requestTransaction(buyForm.value.itemId);
      
      if (result.success) {
        successMsg.value = result.message;
        // 重置表单
        buyForm.value = {
          itemId: '',
          quantity: 1
        };
        showBuyForm.value = false;
        
        // 重新加载数据
        await loadMarketData();
      } else {
        errorMsg.value = result.message;
      }
    } else {
      // 如果数量大于1，使用批量交易
      const itemIds = Array(buyForm.value.quantity).fill(buyForm.value.itemId);
      const result = await batchRequestTransactions(itemIds);
      
      if (result.success) {
        successMsg.value = result.message;
        // 重置表单
        buyForm.value = {
          itemId: '',
          quantity: 1
        };
        showBuyForm.value = false;
        
        // 重新加载数据
        await loadMarketData();
      } else {
        errorMsg.value = result.message;
      }
    }
  } catch (error) {
    console.error("购买商品出错:", error);
    errorMsg.value = error.message || '购买失败';
  } finally {
    loading.value = false;
  }
};

// 方法：撤回商品
const handleWithdraw = async () => {
  try {
    if (!withdrawForm.value.itemId || !withdrawForm.value.quantity) {
      errorMsg.value = '请选择商品并填写撤回数量';
      return;
    }
    
    loading.value = true;
    errorMsg.value = '';
    
    const result = await withdrawItem(
      withdrawForm.value.itemId,
      withdrawForm.value.quantity
    );
    
    if (result.success) {
      successMsg.value = result.message;
      // 重置表单
      withdrawForm.value = {
        itemId: '',
        quantity: 1
      };
      showWithdrawForm.value = false;
      
      // 重新加载数据
      await loadMarketData();
    } else {
      errorMsg.value = result.message;
    }
  } catch (error) {
    console.error("撤回商品出错:", error);
    errorMsg.value = error.message || '操作失败';
  } finally {
    loading.value = false;
  }
};

// 方法：查看交易详情
const viewTransactionDetails = async (transactionId) => {
  try {
    loading.value = true;
    
    const details = await getTransactionDetails(transactionId);
    if (details) {
      selectedTransaction.value = details;
      showTransactionDetails.value = true;
    } else {
      errorMsg.value = '无法获取交易详情';
    }
  } catch (error) {
    console.error("获取交易详情出错:", error);
    errorMsg.value = error.message || '获取详情失败';
  } finally {
    loading.value = false;
  }
};

// 方法：批准交易
const handleApproveTransaction = async (transactionId) => {
  try {
    loading.value = true;
    errorMsg.value = '';
    
    const result = await approveTransaction(transactionId);
    
    if (result.success) {
      successMsg.value = result.message;
      
      // 重新加载数据
      await loadMarketData();
    } else {
      errorMsg.value = result.message;
    }
  } catch (error) {
    console.error("批准交易出错:", error);
    errorMsg.value = error.message || '操作失败';
  } finally {
    loading.value = false;
  }
};

// 方法：确认交易完成
const handleConfirmTransaction = async () => {
  try {
    if (!transactionForm.value.transactionId) {
      errorMsg.value = '请选择交易';
      return;
    }
    
    loading.value = true;
    errorMsg.value = '';
    
    const result = await confirmTransaction(
      transactionForm.value.transactionId,
      transactionForm.value.status
    );
    
    if (result.success) {
      successMsg.value = result.message;
      // 重置表单
      transactionForm.value = {
        transactionId: '',
        status: 2
      };
      showTransactionForm.value = false;
      
      // 重新加载数据
      await loadMarketData();
    } else {
      errorMsg.value = result.message;
    }
  } catch (error) {
    console.error("确认交易完成出错:", error);
    errorMsg.value = error.message || '操作失败';
  } finally {
    loading.value = false;
  }
};

// 方法：处理超时交易
const handleTimeout = async (transactionId) => {
  try {
    loading.value = true;
    errorMsg.value = '';
    
    const result = await handleTimeoutTransaction(transactionId);
    
    if (result.success) {
      successMsg.value = result.message;
      
      // 重新加载数据
      await loadMarketData();
    } else {
      errorMsg.value = result.message;
    }
  } catch (error) {
    console.error("处理超时交易出错:", error);
    errorMsg.value = error.message || '操作失败';
  } finally {
    loading.value = false;
  }
};

// 处理图片文件上传
const handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    publishForm.value.imageFile = file;
  }
};

// 计算创建者需要支付的保证金
const calculateCreatorDeposit = () => {
  if (!publishForm.value.price || !publishForm.value.creatorDepositMultiplier || !publishForm.value.quantity) {
    return '0';
  }
  const price = parseFloat(publishForm.value.price);
  const multiplier = parseInt(publishForm.value.creatorDepositMultiplier);
  const quantity = parseInt(publishForm.value.quantity);
  
  return (price * multiplier * quantity).toFixed(6);
};

// 计算买家需要支付的保证金
const calculateBuyerDeposit = () => {
  if (!publishForm.value.price || !publishForm.value.buyerDepositMultiplier) {
    return '0';
  }
  const price = parseFloat(publishForm.value.price);
  const multiplier = parseInt(publishForm.value.buyerDepositMultiplier);
  
  return (price * multiplier).toFixed(6);
};

// 查看物品详情
const viewItemDetails = async (itemId) => {
  try {
    loading.value = true;
    console.log('查看商品详情，商品ID:', itemId);
    
    // 获取商品详细信息
    const itemDetails = await getItemDetails(itemId);
    console.log('获取到的商品详情:', itemDetails);
    
    if (!itemDetails) {
      errorMsg.value = '获取商品详情失败';
      loading.value = false;
      return;
    }
    
    // 确保duration是数字类型，并且有效
    const duration = itemDetails.duration ? parseInt(itemDetails.duration.toString()) : 0;
    
    // 获取保证金信息
    const creatorDeposit = parseFloat(itemDetails.price) * parseInt(itemDetails.creatorDepositMultiplier);
    const buyerDeposit = parseFloat(itemDetails.price) * parseInt(itemDetails.buyerDepositMultiplier);
    
    // 构建选中的商品对象
    selectedTransaction.value = {
      id: itemId,
      name: itemDetails.name,
      description: itemDetails.description,
      price: itemDetails.price,
      creatorDeposit: creatorDeposit.toFixed(6),
      buyerDeposit: buyerDeposit.toFixed(6),
      quantity: itemDetails.quantity,
      creator: itemDetails.creator,
      image: itemDetails.image,
      creatorDepositMultiplier: itemDetails.creatorDepositMultiplier,
      buyerDepositMultiplier: itemDetails.buyerDepositMultiplier,
      duration: duration,
      durationText: formatDuration(duration)
    };
    
    showTransactionDetails.value = true;
  } catch (error) {
    console.error('查看商品详情时出错:', error);
    errorMsg.value = `查看商品详情失败: ${error.message || '未知错误'}`;
  } finally {
    loading.value = false;
  }
};

// 将秒数格式化为可读的时间格式
const formatDuration = (seconds) => {
  const totalSeconds = parseInt(seconds);
  if (isNaN(totalSeconds) || totalSeconds <= 0) {
    return '未设置';
  }
  
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  
  let result = '';
  if (days > 0) result += `${days}天 `;
  if (hours > 0) result += `${hours}小时 `;
  if (minutes > 0) result += `${minutes}分钟 `;
  if (remainingSeconds > 0) result += `${remainingSeconds}秒`;
  
  return result.trim() || '少于1秒';
};

// 查看用户信誉
const viewUserReputation = async (userAddress) => {
  try {
    loading.value = true;
    reputationAddress.value = userAddress;
    const reputation = await getUserReputation(userAddress);
    
    if (reputation) {
      userReputation.value = reputation;
      showReputationInfo.value = true;
    } else {
      errorMsg.value = '无法获取用户信誉信息';
    }
  } catch (error) {
    console.error('获取用户信誉失败:', error);
    errorMsg.value = '获取用户信誉失败: ' + (error.message || '未知错误');
  } finally {
    loading.value = false;
  }
};

// 计算信誉评分
const calculateReputationScore = () => {
  if (!userReputation.value) return '无数据';
  
  const successful = parseInt(userReputation.value.successfulTrades);
  const negotiated = parseInt(userReputation.value.negotiatedTrades);
  const timedOut = parseInt(userReputation.value.timedOutTrades);
  
  const total = successful + negotiated + timedOut;
  if (total === 0) return '新用户';
  
  // 计算评分：成功交易得2分，协商交易得1分，超时交易得0分
  const score = ((successful * 2) + (negotiated * 1)) / (total * 2) * 100;
  
  // 评分等级
  if (score >= 90) return '优秀 (' + score.toFixed(0) + '%)';
  if (score >= 70) return '良好 (' + score.toFixed(0) + '%)';
  if (score >= 50) return '一般 (' + score.toFixed(0) + '%)';
  return '较差 (' + score.toFixed(0) + '%)';
};

// 方法：添加空的商品表单项
const addItemToForm = () => {
  batchPublishForm.value.items.push({
    name: '',
    description: '',
    price: '',
    creatorDepositMultiplier: 1,
    buyerDepositMultiplier: 1,
    duration: 86400,
    quantity: 1,
    imageFile: null
  });
};

// 方法：移除商品表单项
const removeItemFromForm = (index) => {
  if (batchPublishForm.value.items.length > 1) {
    batchPublishForm.value.items.splice(index, 1);
  }
};

// 方法：处理批量商品图片上传
const handleBatchImageUpload = (event, index) => {
  const file = event.target.files[0];
  if (file) {
    batchPublishForm.value.items[index].imageFile = file;
  }
};

// 计算批量发布商品所需总保证金
const calculateTotalCreatorDeposit = () => {
  let total = 0;
  for (const item of batchPublishForm.value.items) {
    if (item.price && item.creatorDepositMultiplier && item.quantity) {
      const price = parseFloat(item.price);
      const multiplier = parseInt(item.creatorDepositMultiplier);
      const quantity = parseInt(item.quantity);
      total += price * multiplier * quantity;
    }
  }
  return total.toFixed(6);
};

// 批量发布商品
const handleBatchPublish = async () => {
  try {
    // 表单验证
    for (const [index, item] of batchPublishForm.value.items.entries()) {
      if (!item.name || !item.description || !item.price || 
          !item.quantity || item.creatorDepositMultiplier < 1 || 
          item.buyerDepositMultiplier < 1 || item.duration < 60) {
        errorMsg.value = `第${index + 1}个商品信息不完整，请检查`;
        return;
      }
      
      // 验证价格
      const price = parseFloat(item.price);
      if (isNaN(price) || price <= 0) {
        errorMsg.value = `第${index + 1}个商品价格无效，请输入有效的价格（大于0）`;
        return;
      }
      
      // 验证价格最小单位
      if (price < 0.000001) {
        errorMsg.value = `第${index + 1}个商品价格不能小于0.000001 eCNY（最小单位）`;
        return;
      }
    }
    
    loading.value = true;
    errorMsg.value = '';
    successMsg.value = '';
    
    // 开始批量发布流程
    console.log("开始批量商品发布流程...");
    console.log("商品信息:", batchPublishForm.value.items);
    
    // 步骤1: 批量上传元数据到IPFS
    console.log("步骤1: 准备批量上传元数据到IPFS");
    
    const names = batchPublishForm.value.items.map(item => item.name);
    const descriptions = batchPublishForm.value.items.map(item => item.description);
    const imageFiles = batchPublishForm.value.items.map(item => item.imageFile);
    
    let ipfsHashes;
    try {
      ipfsHashes = await batchPrepareItemMetadata(names, descriptions, imageFiles);
      console.log("IPFS元数据批量上传成功，哈希数组:", ipfsHashes);
      successMsg.value = "所有文件上传成功! 正在继续处理交易...";
      // 强制刷新UI以展示中间状态
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (ipfsError) {
      console.error("IPFS批量上传失败:", ipfsError);
      errorMsg.value = `文件上传失败: ${ipfsError.message}`;
      loading.value = false;
      return;
    }
    
    // 步骤2: 调用智能合约批量发布商品
    console.log("步骤2: 调用智能合约批量发布商品");
    try {
      const prices = batchPublishForm.value.items.map(item => item.price);
      const creatorDepositMultipliers = batchPublishForm.value.items.map(item => item.creatorDepositMultiplier);
      const buyerDepositMultipliers = batchPublishForm.value.items.map(item => item.buyerDepositMultiplier);
      const durations = batchPublishForm.value.items.map(item => item.duration);
      const quantities = batchPublishForm.value.items.map(item => item.quantity);
      
      const result = await batchPublishItems(
        prices,
        creatorDepositMultipliers,
        buyerDepositMultipliers,
        durations,
        ipfsHashes,
        quantities
      );
      
      console.log("批量发布合约调用结果:", result);
      
      if (result.success) {
        successMsg.value = result.message;
        // 重置表单
        batchPublishForm.value = {
          items: [
            {
              name: '',
              description: '',
              price: '',
              creatorDepositMultiplier: 1,
              buyerDepositMultiplier: 1,
              duration: 86400,
              quantity: 1,
              imageFile: null
            }
          ]
        };
        showBatchPublishForm.value = false;
        
        // 重新加载数据
        await loadMarketData();
      } else {
        errorMsg.value = result.message;
      }
    } catch (contractError) {
      console.error("调用合约失败:", contractError);
      errorMsg.value = `批量发布商品失败: ${contractError.message}`;
    }
  } catch (error) {
    console.error("批量发布商品整体流程出错:", error);
    errorMsg.value = error.message || '发布过程中发生未知错误';
  } finally {
    loading.value = false;
  }
};

// 添加/移除商品到批量购买列表
const toggleItemInBatchBuy = (itemId) => {
  const index = batchBuyForm.value.items.findIndex(item => item.itemId === itemId);
  if (index === -1) {
    batchBuyForm.value.items.push({
      itemId: itemId,
      quantity: 1 // 默认数量为1
    });
  } else {
    batchBuyForm.value.items.splice(index, 1);
  }
};

// 更新批量购买商品数量
const updateBatchBuyQuantity = (itemId, quantity) => {
  const item = batchBuyForm.value.items.find(item => item.itemId === itemId);
  if (item) {
    item.quantity = quantity > 0 ? quantity : 1;
  }
};

// 方法：批量购买商品
const handleBatchBuy = async () => {
  try {
    if (batchBuyForm.value.items.length === 0) {
      errorMsg.value = '请选择要购买的商品';
      return;
    }
    
    loading.value = true;
    errorMsg.value = '';
    
    // 准备一个数组，根据数量重复商品ID
    const requestItemIds = [];
    for (const item of batchBuyForm.value.items) {
      for (let i = 0; i < item.quantity; i++) {
        requestItemIds.push(item.itemId);
      }
    }
    
    const result = await batchRequestTransactions(requestItemIds);
    
    if (result.success) {
      successMsg.value = result.message;
      // 重置表单
      batchBuyForm.value = {
        items: []
      };
      showBatchBuyForm.value = false;
      
      // 重新加载数据
      await loadMarketData();
    } else {
      errorMsg.value = result.message;
    }
  } catch (error) {
    console.error("批量购买商品出错:", error);
    errorMsg.value = error.message || '购买失败';
  } finally {
    loading.value = false;
  }
};

// 方法：批量批准交易
const handleBatchApproveTransactions = async () => {
  try {
    if (batchTransactionForm.value.transactionIds.length === 0) {
      errorMsg.value = '请选择要批准的交易';
      return;
    }
    
    loading.value = true;
    errorMsg.value = '';
    
    const result = await batchApproveTransactions(batchTransactionForm.value.transactionIds);
    
    if (result.success) {
      successMsg.value = result.message;
      // 重置表单
      batchTransactionForm.value = {
        transactionIds: []
      };
      showBatchTransactionForm.value = false;
      
      // 重新加载数据
      await loadMarketData();
    } else {
      errorMsg.value = result.message;
    }
  } catch (error) {
    console.error("批量批准交易出错:", error);
    errorMsg.value = error.message || '操作失败';
  } finally {
    loading.value = false;
  }
};

// 方法：批量处理超时交易
const handleBatchTimeoutTransactions = async () => {
  try {
    // 筛选出已超时的交易
    const currentTime = Math.floor(Date.now() / 1000);
    const timedOutTxIds = marketData.value.userTransactions
      .filter(tx => 
        (tx.status === '0' || tx.status === '1') && 
        currentTime > tx.endTimeRaw
      )
      .map(tx => tx.id);
    
    if (timedOutTxIds.length === 0) {
      errorMsg.value = '当前没有超时的交易可以处理';
      return;
    }
    
    loading.value = true;
    errorMsg.value = '';
    
    const result = await batchHandleTimeoutTransactions(timedOutTxIds);
    
    if (result.success) {
      successMsg.value = result.message;
      
      // 重新加载数据
      await loadMarketData();
    } else {
      errorMsg.value = result.message;
    }
  } catch (error) {
    console.error("批量处理超时交易出错:", error);
    errorMsg.value = error.message || '操作失败';
  } finally {
    loading.value = false;
  }
};

// 添加/移除交易到批量批准列表
const toggleTransactionInBatchApprove = (txId) => {
  const index = batchTransactionForm.value.transactionIds.indexOf(txId);
  if (index === -1) {
    batchTransactionForm.value.transactionIds.push(txId);
  } else {
    batchTransactionForm.value.transactionIds.splice(index, 1);
  }
};

// 初始化加载数据
onMounted(loadMarketData);
</script>

<template>
  <div class="market-container">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载市场数据...</p>
    </div>
    
    <div v-else-if="errorMsg" class="error-container">
      <p class="error-msg">{{ errorMsg }}</p>
      <button class="retry-button" @click="loadMarketData">重试</button>
    </div>
    
    <div v-else class="market-data">
      <div v-if="successMsg" class="success-container">
        <p>{{ successMsg }}</p>
        <button class="close-button" @click="successMsg = ''">×</button>
      </div>
      
      <h2>劳务市场</h2>
      
      <!-- 添加eCNY交易说明 -->
      <div class="notice-container">
        <p><strong>平台说明:</strong> 本平台所有交易均使用eCNY代币进行。请确保您的账户中有足够的eCNY余额才能进行交易操作。</p>
      </div>
      
      <div v-if="marketData.userAddress">
        <div class="user-info">
          <p class="address">当前账户: <span class="address-value">{{ shortenAddress(marketData.userAddress) }}</span></p>
          
          <!-- 用户余额信息，更新显示单位 -->
          <div class="balances-info">
            <h4>用户余额信息</h4>
            <div class="balance-item">
              <span class="balance-label">以太坊余额:</span>
              <span class="balance-value">{{ userBalances.walletBalance }} ETH</span>
            </div>
            <div class="balance-item">
              <span class="balance-label">eCNY余额:</span>
              <span class="balance-value">{{ userBalances.tokenBalance }} eCNY</span>
              <button class="mini-button" @click="showTokenInfo = true">获取eCNY</button>
            </div>
            <!-- <div class="balance-item">
              <span class="balance-label">市场代币余额:</span>
              <span class="balance-value">{{ userBalances.marketTokenBalance }} eCNY</span>
            </div> -->
          </div>
          
          <p>市场商品总数: <span class="highlight">{{ marketData.itemCount }}</span></p>
          <p>交易总数: <span class="highlight">{{ marketData.transactionCount }}</span></p>
          <p>市场状态: <span :class="marketData.marketActive ? 'status-active' : 'status-inactive'">
            {{ marketData.marketActive ? '激活' : '未激活' }}
          </span></p>
          
          <div v-if="userReputation" class="reputation">
            <p>信誉评价:</p>
            <ul>
              <li>成功交易: {{ userReputation.successfulTrades }}</li>
              <li>协商交易: {{ userReputation.negotiatedTrades }}</li>
              <li>超时交易: {{ userReputation.timedOutTrades }}</li>
            </ul>
          </div>
        </div>
        
        <!-- 导航标签 -->
        <div class="nav-tabs">
          <button 
            :class="['tab-button', activeTab === 'market' ? 'active' : '']" 
            @click="activeTab = 'market'">
            市场商品
          </button>
          <button 
            :class="['tab-button', activeTab === 'myItems' ? 'active' : '']" 
            @click="activeTab = 'myItems'">
            我的商品
          </button>
          <button 
            :class="['tab-button', activeTab === 'myTransactions' ? 'active' : '']" 
            @click="activeTab = 'myTransactions'">
            我的交易
          </button>
        </div>
        
        <!-- 功能按钮 -->
        <div class="action-buttons">
          <button class="action-button" @click="showPublishForm = true">发布商品</button>
          <button class="action-button" @click="showBatchPublishForm = true">批量发布</button>
          <button class="action-button" @click="showQuantityForm = true">增加商品数量</button>
          <button class="action-button" @click="showWithdrawForm = true">撤回商品</button>
          <button class="action-button" @click="showBuyForm = true">购买商品</button>
          <button class="action-button" @click="showBatchBuyForm = true">批量购买</button>
          <button class="action-button refresh" @click="loadMarketData">刷新数据</button>
        </div>
        
        <!-- 发布商品表单 -->
        <div v-if="showPublishForm" class="form-modal">
          <div class="form-content">
            <h3>发布商品</h3>
            <div class="form-group">
              <label>商品名称:</label>
              <input type="text" v-model="publishForm.name" placeholder="输入商品名称">
            </div>
            <div class="form-group">
              <label>商品描述:</label>
              <textarea v-model="publishForm.description" placeholder="输入商品描述"></textarea>
            </div>
            <div class="form-group">
              <label>价格 (eCNY):</label>
              <input type="number" v-model="publishForm.price" placeholder="输入价格" step="0.001">
              <div class="field-info">设置商品的价格，以eCNY为单位</div>
            </div>
            <div class="form-group">
              <label>创建者保证金倍数:</label>
              <input type="number" v-model="publishForm.creatorDepositMultiplier" placeholder="输入创建者保证金倍数" min="1">
              <div class="field-info">
                创建者需要缴纳的保证金 = 价格 × 保证金倍数 × 数量。
                <br>保证金将在交易完成后返还，为了防止恶意行为，倍数至少为1。
              </div>
            </div>
            <div class="form-group">
              <label>买家保证金倍数:</label>
              <input type="number" v-model="publishForm.buyerDepositMultiplier" placeholder="输入买家保证金倍数" min="1">
              <div class="field-info">
                买家需要缴纳的保证金 = 价格 × 保证金倍数。
                <br>保证金将在交易完成后部分返还，为了防止恶意行为，倍数至少为1。
              </div>
            </div>
            <div class="form-group">
              <label>交易持续时间(秒):</label>
              <input type="number" v-model="publishForm.duration" placeholder="输入交易持续时间" min="60">
              <div class="field-info">
                交易的最长持续时间，单位为秒。超过此时间未确认的交易可被标记为超时。
                <br>推荐设置：1小时(3600)、1天(86400)、1周(604800)
              </div>
            </div>
            <div class="form-group">
              <label>数量:</label>
              <input type="number" v-model="publishForm.quantity" placeholder="输入数量" min="1">
              <div class="field-info">要发布的商品数量，每个都会产生一笔独立的交易</div>
            </div>
            <div class="form-group">
              <label>图片文件:</label>
              <input type="file" @change="handleImageUpload" accept="image/*">
              <div class="field-info">上传商品图片，将存储到IPFS</div>
            </div>
            <div class="deposit-summary">
              <h4>保证金计算:</h4>
              <p>发布此商品需支付的保证金: {{ calculateCreatorDeposit() }} eCNY</p>
              <p>买家购买此商品需支付的保证金: {{ calculateBuyerDeposit() }} eCNY</p>
            </div>
            <div class="form-actions">
              <button class="cancel-button" @click="showPublishForm = false">取消</button>
              <button class="confirm-button" @click="handlePublish" :disabled="loading">
                {{ loading ? '处理中...' : '发布' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- 增加数量表单 -->
        <div v-if="showQuantityForm" class="form-modal">
          <div class="form-content">
            <h3>增加商品数量</h3>
            <div class="form-group">
              <label>选择商品:</label>
              <select v-model="quantityForm.itemId">
                <option value="">-- 请选择商品 --</option>
                <option v-for="item in marketData.itemDetails" :key="item.id" :value="item.id">
                  {{ item.name }} - 当前数量: {{ item.availableQuantity }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>增加数量:</label>
              <input type="number" v-model="quantityForm.quantity" placeholder="输入数量" min="1">
            </div>
            <div class="form-actions">
              <button class="cancel-button" @click="showQuantityForm = false">取消</button>
              <button class="confirm-button" @click="handleIncreaseQuantity" :disabled="loading">
                {{ loading ? '处理中...' : '确认' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- 撤回商品表单 -->
        <div v-if="showWithdrawForm" class="form-modal">
          <div class="form-content">
            <h3>撤回商品</h3>
            <div class="form-group">
              <label>选择商品:</label>
              <select v-model="withdrawForm.itemId">
                <option value="">-- 请选择商品 --</option>
                <option v-for="item in marketData.itemDetails" :key="item.id" :value="item.id">
                  {{ item.name }} - 可用数量: {{ item.availableQuantity }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>撤回数量:</label>
              <input type="number" v-model="withdrawForm.quantity" placeholder="输入数量" min="1">
            </div>
            <div class="form-actions">
              <button class="cancel-button" @click="showWithdrawForm = false">取消</button>
              <button class="confirm-button" @click="handleWithdraw" :disabled="loading">
                {{ loading ? '处理中...' : '确认撤回' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- 购买表单 -->
        <div v-if="showBuyForm" class="form-modal">
          <div class="form-content">
            <h3>购买商品</h3>
            <div class="form-group">
              <label>选择商品:</label>
              <select v-model="buyForm.itemId">
                <option value="">-- 请选择商品 --</option>
                <option v-for="item in marketData.allItems" :key="item.id" :value="item.id">
                  {{ item.name }} - 价格: {{ item.price }} eCNY - 可用数量: {{ item.availableQuantity }}
                </option>
              </select>
            </div>
            <div class="form-group" v-if="buyForm.itemId">
              <label>购买数量:</label>
              <input 
                type="number" 
                v-model="buyForm.quantity" 
                min="1" 
                :max="marketData.allItems.find(item => item.id === buyForm.itemId)?.availableQuantity || 1">
              <div class="field-info">
                您想购买的商品数量，可用数量: {{ marketData.allItems.find(item => item.id === buyForm.itemId)?.availableQuantity || 0 }}
              </div>
            </div>
            <div class="deposit-summary" v-if="buyForm.itemId">
              <h4>交易摘要:</h4>
              <p>商品名称: {{ marketData.allItems.find(item => item.id === buyForm.itemId)?.name }}</p>
              <p>单价: {{ marketData.allItems.find(item => item.id === buyForm.itemId)?.price }} eCNY</p>
              <p>数量: {{ buyForm.quantity }}</p>
              <p>总金额: {{ (Number(marketData.allItems.find(item => item.id === buyForm.itemId)?.price) * buyForm.quantity).toFixed(6) }} eCNY</p>
              <p>需支付保证金: {{ (Number(marketData.allItems.find(item => item.id === buyForm.itemId)?.price) * Number(marketData.allItems.find(item => item.id === buyForm.itemId)?.buyerDepositMultiplier) * buyForm.quantity).toFixed(6) }} eCNY</p>
            </div>
            <div class="form-actions">
              <button class="cancel-button" @click="showBuyForm = false">取消</button>
              <button class="confirm-button" @click="handleBuy" :disabled="loading || !buyForm.itemId">
                {{ loading ? '处理中...' : '购买' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- 确认交易表单 -->
        <div v-if="showTransactionForm" class="form-modal">
          <div class="form-content">
            <h3>确认交易完成</h3>
            <div class="form-group">
              <label>交易状态:</label>
              <select v-model="transactionForm.status">
                <option :value="2">成功完成</option>
                <option :value="3">协商完成</option>
              </select>
            </div>
            <div class="form-actions">
              <button class="cancel-button" @click="showTransactionForm = false">取消</button>
              <button class="confirm-button" @click="handleConfirmTransaction" :disabled="loading">
                {{ loading ? '处理中...' : '确认完成' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- 物品详情弹窗 -->
        <el-dialog v-model="showTransactionDetails" title="物品详情" width="50%">
          <div v-if="selectedTransaction">
            <div class="item-details">
              <div class="item-image">
                <img :src="selectedTransaction.image ? `https://ipfs.io/ipfs/${selectedTransaction.image}` : '/placeholder.png'" alt="物品图片">
              </div>
              <div class="item-info">
                <h3>{{ selectedTransaction.name }}</h3>
                <p><strong>描述:</strong> {{ selectedTransaction.description }}</p>
                <p><strong>价格:</strong> {{ selectedTransaction.price }} eCNY</p>
                <p><strong>数量:</strong> {{ selectedTransaction.quantity }}</p>
                <p><strong>创建者保证金倍数:</strong> {{ selectedTransaction.creatorDepositMultiplier }}</p>
                <p><strong>买家保证金倍数:</strong> {{ selectedTransaction.buyerDepositMultiplier }}</p>
                <!-- 添加质押金额信息 -->
                <div class="deposit-info transaction-deposit">
                  <p class="deposit-item"><strong>卖家押金金额:</strong> {{ (Number(selectedTransaction.price) * Number(selectedTransaction.creatorDepositMultiplier)) }} eCNY/个</p>
                  <p class="deposit-item"><strong>买家押金金额:</strong> {{ (Number(selectedTransaction.price) * Number(selectedTransaction.buyerDepositMultiplier)) }} eCNY/个</p>
                </div>
                <p><strong>交易持续时间:</strong> {{ selectedTransaction.durationText }}</p>
                <p><strong>状态:</strong> {{ getStatusText(selectedTransaction.status) }}</p>
              </div>
            </div>
          </div>
        </el-dialog>
        
        <!-- 市场商品列表 Tab -->
        <div v-if="activeTab === 'market'" class="tab-content">
          <h3>市场商品列表</h3>
          <div v-if="marketData.allItems.length > 0" class="items-grid">
            <div v-for="item in marketData.allItems" :key="item.id" class="item-card">
              <div v-if="item.image" class="item-image">
                <img :src="item.image" alt="商品图片">
              </div>
              <div class="item-info">
                <h4>{{ item.name }}</h4>
                <p class="item-description">{{ item.description }}</p>
                <p class="item-price">价格: {{ item.price }} eCNY</p>
                <p class="item-quantity">可用数量: {{ item.availableQuantity }}</p>
                <p class="item-seller">卖家: {{ item.creator ? shortenAddress(item.creator) : '' }}</p>
                <!-- 添加质押信息显示 -->
                <div class="deposit-info">
                  <p class="deposit-item">卖家押金: <span class="highlight">{{ item.creatorDepositMultiplier }}倍</span> ({{ (Number(item.price) * Number(item.creatorDepositMultiplier)).toFixed(6) }} eCNY/个)</p>
                  <p class="deposit-item">买家押金: <span class="highlight">{{ item.buyerDepositMultiplier }}倍</span> ({{ (Number(item.price) * Number(item.buyerDepositMultiplier)).toFixed(6) }} eCNY/个)</p>
                </div>
                <button class="buy-now-button" @click="buyForm.itemId = item.id; showBuyForm = true">
                  立即购买
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-items">
            <p>当前市场没有可用商品</p>
          </div>
        </div>
        
        <!-- 我的商品列表 Tab -->
        <div v-if="activeTab === 'myItems'" class="tab-content">
          <h3>我发布的商品</h3>
          <div v-if="marketData.itemDetails.length > 0" class="items-grid">
            <div v-for="item in marketData.itemDetails" :key="item.id" class="item-card">
              <div class="item-info">
                <h4>{{ item.name }}</h4>
                <p class="item-description">{{ item.description }}</p>
                <p class="item-price">价格: {{ item.price }} eCNY</p>
                <p class="item-quantity">总数量: {{ item.totalQuantity }}</p>
                <p class="item-quantity">可用数量: {{ item.availableQuantity }}</p>
                <!-- 添加押金信息显示 -->
                <div class="deposit-info">
                  <p class="deposit-item">卖家押金: <span class="highlight">{{ item.creatorDepositMultiplier }}倍</span> ({{ (Number(item.price) * Number(item.creatorDepositMultiplier)).toFixed(6) }} eCNY/个)</p>
                  <p class="deposit-item">买家押金: <span class="highlight">{{ item.buyerDepositMultiplier }}倍</span> ({{ (Number(item.price) * Number(item.buyerDepositMultiplier)).toFixed(6) }} eCNY/个)</p>
                </div>
                <div class="item-actions">
                  <button class="action-button add-quantity" @click="quantityForm.itemId = item.id; showQuantityForm = true">
                    增加数量
                  </button>
                  <button class="action-button withdraw" @click="withdrawForm.itemId = item.id; showWithdrawForm = true">
                    撤回商品
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-items">
            <p>您还没有发布任何商品</p>
          </div>
        </div>
        
        <!-- 我的交易列表 Tab -->
        <div v-if="activeTab === 'myTransactions'" class="tab-content">
          <h3>我的交易</h3>
          
          <!-- 批量操作按钮 -->
          <div class="batch-actions-container">
            <button 
              class="batch-action-button" 
              @click="showBatchTransactionForm = true"
              v-if="marketData.userTransactions.some(tx => tx.status === '0')">
              批量批准交易
            </button>
            <button 
              class="batch-action-button timeout" 
              @click="handleBatchTimeoutTransactions"
              v-if="marketData.userTransactions.some(tx => 
                (tx.status === '0' || tx.status === '1') && 
                (Math.floor(Date.now() / 1000) > tx.endTimeRaw)
              )">
              批量处理超时交易
            </button>
          </div>
          
          <div v-if="marketData.userTransactions.length > 0" class="transactions-list">
            <div v-for="tx in marketData.userTransactions" :key="tx.id" class="transaction-card">
              <div class="transaction-header">
                <span class="transaction-id">交易 #{{ tx.id }}</span>
                <span :class="['transaction-status', 
                  tx.status === '0' ? 'status-pending' : 
                  tx.status === '1' ? 'status-approved' : 
                  tx.status === '2' ? 'status-completed' : 
                  tx.status === '3' ? 'status-negotiated' : 'status-timeout']">
                  {{ tx.statusText }}
                </span>
              </div>
              <div class="transaction-info">
                <p>商品ID: {{ tx.itemId }}</p>
                <p>保证金: {{ tx.deposit }} eCNY</p>
                <p>结束时间: {{ tx.endTime }}</p>
                <div class="transaction-actions">
                  <button class="action-button view" @click="viewTransactionDetails(tx.id)">
                    查看详情
                  </button>
                  
                  <!-- 买家确认收货按钮 -->
                  <button 
                    v-if="tx.status === '1' && tx.participant.toLowerCase() === marketData.userAddress.toLowerCase()" 
                    class="action-button confirm" 
                    @click="transactionForm.transactionId = tx.id; showTransactionForm = true">
                    确认收货
                  </button>
                  
                  <!-- 卖家确认交易按钮 -->
                  <button 
                    v-if="tx.status === '0'" 
                    class="action-button approve" 
                    @click="handleApproveTransaction(tx.id)">
                    批准交易
                  </button>
                  
                  <!-- 处理超时按钮 -->
                  <button 
                    v-if="(tx.status === '0' || tx.status === '1') && new Date() > new Date(tx.endTimeRaw * 1000)" 
                    class="action-button timeout" 
                    @click="handleTimeout(tx.id)">
                    处理超时
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-items">
            <p>您还没有任何交易记录</p>
          </div>
        </div>
      </div>
      <div v-else class="connect-wallet">
        <p>请先连接钱包</p>
        <button class="connect-button" @click="loadMarketData">连接钱包</button>
      </div>
      
      <!-- 添加eCNY获取信息弹窗 -->
      <div v-if="showTokenInfo" class="form-modal">
        <div class="form-content">
          <h3>如何获取eCNY</h3>
          <div class="token-info">
            <p>在本平台上，所有交易都需要使用eCNY代币进行。您可以通过以下方式获取eCNY:</p>
            <ol>
              <li>通过平台的代币兑换功能将ETH兑换为eCNY</li>
              <li>参与平台活动获取eCNY奖励</li>
              <li>提供商品或服务获取eCNY付款</li>
            </ol>
            <p>请确保在发起交易前，您的账户中有足够的eCNY余额。</p>
          </div>
          <div class="form-actions">
            <button class="confirm-button" @click="showTokenInfo = false">关闭</button>
          </div>
        </div>
      </div>
      
      <!-- 用户信誉信息弹窗 -->
      <div v-if="showReputationInfo" class="modal">
        <div class="modal-content reputation-modal">
          <span class="close" @click="showReputationInfo = false">&times;</span>
          <h2>用户信誉信息</h2>
          
          <div v-if="userReputation" class="reputation-details">
            <p><strong>地址:</strong> {{ shortenAddress(reputationAddress) }}</p>
            <div class="reputation-stats">
              <div class="reputation-stat">
                <div class="stat-value success">{{ userReputation.successfulTrades }}</div>
                <div class="stat-label">成功交易</div>
              </div>
              <div class="reputation-stat">
                <div class="stat-value negotiated">{{ userReputation.negotiatedTrades }}</div>
                <div class="stat-label">协商完成</div>
              </div>
              <div class="reputation-stat">
                <div class="stat-value timeout">{{ userReputation.timedOutTrades }}</div>
                <div class="stat-label">超时交易</div>
              </div>
            </div>
            
            <div class="reputation-score">
              <p><strong>信誉评分:</strong> {{ calculateReputationScore() }}</p>
            </div>
            
            <div class="reputation-explanation">
              <h3>信誉说明</h3>
              <p>信誉评分基于用户历史交易记录计算：</p>
              <ul>
                <li>成功交易：完全按照交易条款完成，双方满意</li>
                <li>协商完成：通过协商解决交易问题后完成</li>
                <li>超时交易：交易期限内未完成，系统自动处理</li>
              </ul>
              <p>高信誉用户在平台上将享有更多信任和特权。</p>
            </div>
          </div>
          
          <div v-else class="loading-reputation">
            <p v-if="loading">正在加载信誉数据...</p>
            <p v-else>无法获取用户信誉信息</p>
          </div>
        </div>
      </div>
      
      <!-- 批量发布商品表单 -->
      <div v-if="showBatchPublishForm" class="form-modal">
        <div class="form-content batch-form">
          <h3>批量发布商品</h3>
          
          <div v-for="(item, index) in batchPublishForm.items" :key="index" class="batch-item">
            <div class="batch-item-header">
              <h4>商品 #{{ index + 1 }}</h4>
              <button v-if="batchPublishForm.items.length > 1" 
                      class="remove-item-btn" 
                      @click="removeItemFromForm(index)">
                删除此商品
              </button>
            </div>
            
            <div class="form-group">
              <label>商品名称:</label>
              <input type="text" v-model="item.name" placeholder="输入商品名称">
            </div>
            <div class="form-group">
              <label>商品描述:</label>
              <textarea v-model="item.description" placeholder="输入商品描述"></textarea>
            </div>
            <div class="form-group">
              <label>价格 (eCNY):</label>
              <input type="number" v-model="item.price" placeholder="输入价格" step="0.001">
            </div>
            <div class="form-group">
              <label>创建者保证金倍数:</label>
              <input type="number" v-model="item.creatorDepositMultiplier" placeholder="创建者保证金倍数" min="1">
            </div>
            <div class="form-group">
              <label>买家保证金倍数:</label>
              <input type="number" v-model="item.buyerDepositMultiplier" placeholder="买家保证金倍数" min="1">
            </div>
            <div class="form-group">
              <label>交易持续时间(秒):</label>
              <input type="number" v-model="item.duration" placeholder="交易持续时间" min="60">
            </div>
            <div class="form-group">
              <label>数量:</label>
              <input type="number" v-model="item.quantity" placeholder="输入数量" min="1">
            </div>
            <div class="form-group">
              <label>图片文件:</label>
              <input type="file" @change="(e) => handleBatchImageUpload(e, index)" accept="image/*">
            </div>
          </div>
          
          <div class="batch-actions">
            <button class="add-item-btn" @click="addItemToForm">+ 添加更多商品</button>
          </div>
          
          <div class="deposit-summary">
            <h4>保证金计算:</h4>
            <p>发布这些商品需支付的总保证金: {{ calculateTotalCreatorDeposit() }} eCNY</p>
          </div>
          
          <div class="form-actions">
            <button class="cancel-button" @click="showBatchPublishForm = false">取消</button>
            <button class="confirm-button" @click="handleBatchPublish" :disabled="loading">
              {{ loading ? '处理中...' : '批量发布' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- 批量购买表单 -->
      <div v-if="showBatchBuyForm" class="form-modal">
        <div class="form-content">
          <h3>批量购买商品</h3>
          
          <div class="batch-selection">
            <h4>选择要购买的商品:</h4>
            <div v-if="marketData.allItems.length > 0" class="selection-list">
              <div v-for="item in marketData.allItems" :key="item.id" class="selection-item">
                <label class="checkbox-container">
                  <input 
                    type="checkbox"
                    :value="item.id"
                    :checked="batchBuyForm.items.some(i => i.itemId === item.id)"
                    @change="toggleItemInBatchBuy(item.id)">
                  <span class="checkmark"></span>
                  {{ item.name }} - 价格: {{ item.price }} eCNY - 可用数量: {{ item.availableQuantity }}
                </label>
                <div v-if="batchBuyForm.items.some(i => i.itemId === item.id)" class="quantity-selector">
                  <span>数量:</span>
                  <input 
                    type="number" 
                    :value="batchBuyForm.items.find(i => i.itemId === item.id)?.quantity || 1" 
                    @input="(e) => updateBatchBuyQuantity(item.id, parseInt(e.target.value))"
                    min="1"
                    :max="item.availableQuantity"
                    class="quantity-input">
                </div>
              </div>
            </div>
            <div v-else class="empty-selection">
              <p>没有可购买的商品</p>
            </div>
          </div>
          
          <div class="selection-summary" v-if="batchBuyForm.items.length > 0">
            <p>已选择 {{ batchBuyForm.items.length }} 种商品，总数量: {{ batchBuyForm.items.reduce((sum, item) => sum + item.quantity, 0) }} 个</p>
            <div class="selected-items-list">
              <div v-for="(buyItem, index) in batchBuyForm.items" :key="index" class="selected-item">
                <span>{{ marketData.allItems.find(i => i.id === buyItem.itemId)?.name }} × {{ buyItem.quantity }}</span>
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button class="cancel-button" @click="showBatchBuyForm = false">取消</button>
            <button 
              class="confirm-button" 
              @click="handleBatchBuy" 
              :disabled="loading || batchBuyForm.items.length === 0">
              {{ loading ? '处理中...' : '批量购买' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- 批量批准交易表单 -->
      <div v-if="showBatchTransactionForm" class="form-modal">
        <div class="form-content">
          <h3>批量批准交易</h3>
          
          <div class="batch-selection">
            <h4>选择要批准的交易:</h4>
            <div v-if="marketData.userTransactions.length > 0" class="selection-list">
              <div 
                v-for="tx in marketData.userTransactions.filter(t => t.status === '0')" 
                :key="tx.id" 
                class="selection-item"
              >
                <label class="checkbox-container">
                  <input 
                    type="checkbox"
                    :value="tx.id"
                    :checked="batchTransactionForm.transactionIds.includes(tx.id)"
                    @change="toggleTransactionInBatchApprove(tx.id)"
                  >
                  <span class="checkmark"></span>
                  交易 #{{ tx.id }} - 商品ID: {{ tx.itemId }} - 保证金: {{ tx.deposit }} eCNY
                </label>
              </div>
            </div>
            <div v-else class="empty-selection">
              <p>没有待批准的交易</p>
            </div>
          </div>
          
          <div class="selection-summary" v-if="batchTransactionForm.transactionIds.length > 0">
            <p>已选择 {{ batchTransactionForm.transactionIds.length }} 笔交易</p>
          </div>
          
          <div class="form-actions">
            <button class="cancel-button" @click="showBatchTransactionForm = false">取消</button>
            <button 
              class="confirm-button" 
              @click="handleBatchApproveTransactions" 
              :disabled="loading || batchTransactionForm.transactionIds.length === 0">
              {{ loading ? '处理中...' : '批量批准' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.market-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

/* 加载和错误状态 */
.loading-container, .error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 4px solid #007bff;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-msg {
  color: #dc3545;
  font-weight: bold;
  margin-bottom: 15px;
}

.retry-button, .connect-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}

.retry-button:hover, .connect-button:hover {
  background-color: #0056b3;
}

/* 成功消息 */
.success-container {
  background-color: #d4edda;
  color: #155724;
  padding: 15px;
  border-radius: 5px;
  margin-bottom: 20px;
  position: relative;
}

.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #155724;
}

/* 未连接钱包 */
.connect-wallet {
  text-align: center;
  padding: 50px 0;
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

/* 用户信息 */
.user-info {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.address {
  margin-bottom: 10px;
}

.address-value {
  font-family: monospace;
  font-weight: bold;
  background-color: #e9ecef;
  padding: 2px 5px;
  border-radius: 3px;
}

.balances-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 10px;
}

.balances-info h4 {
  margin: 0 0 5px 0;
}

.balance-item {
  display: flex;
  justify-content: space-between;
  background-color: #e9ecef;
  padding: 8px;
  border-radius: 5px;
}

.balance-value {
  font-weight: bold;
}

.status-active {
  color: #28a745;
  font-weight: bold;
}

.status-inactive {
  color: #dc3545;
  font-weight: bold;
}

.reputation {
  margin-top: 10px;
}

.reputation ul {
  margin: 5px 0;
  padding-left: 20px;
}

.highlight {
  font-weight: bold;
  color: #007bff;
}

/* 导航标签页 */
.nav-tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #dee2e6;
}

.tab-button {
  background: none;
  border: none;
  padding: 10px 15px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
  border-bottom: 2px solid transparent;
}

.tab-button:hover {
  color: #007bff;
}

.tab-button.active {
  color: #007bff;
  border-bottom: 2px solid #007bff;
  font-weight: bold;
}

/* 操作按钮区域 */
.action-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.action-button {
  padding: 8px 15px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
}

.action-button.refresh {
  background-color: #6c757d;
  color: white;
}

.action-button.refresh:hover {
  background-color: #5a6268;
}

.action-button.add-quantity {
  background-color: #28a745;
  color: white;
}

.action-button.add-quantity:hover {
  background-color: #218838;
}

.action-button.withdraw {
  background-color: #ffc107;
  color: #212529;
}

.action-button.withdraw:hover {
  background-color: #e0a800;
}

.action-button.view {
  background-color: #17a2b8;
  color: white;
}

.action-button.view:hover {
  background-color: #138496;
}

.action-button.approve {
  background-color: #28a745;
  color: white;
}

.action-button.approve:hover {
  background-color: #218838;
}

.action-button.confirm {
  background-color: #007bff;
  color: white;
}

.action-button.confirm:hover {
  background-color: #0056b3;
}

.action-button.timeout {
  background-color: #dc3545;
  color: white;
}

.action-button.timeout:hover {
  background-color: #c82333;
}

/* 空状态 */
.empty-items {
  text-align: center;
  padding: 50px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

/* 物品网格 */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.item-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
}

.item-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.item-image {
  height: 200px;
  overflow: hidden;
}

.item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  padding: 15px;
}

.item-info h4 {
  margin-top: 0;
  font-size: 18px;
}

.item-description {
  color: #6c757d;
  margin-bottom: 10px;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.item-price, .item-quantity, .item-seller {
  margin: 5px 0;
}

.buy-now-button {
  width: 100%;
  padding: 8px 0;
  margin-top: 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}

.buy-now-button:hover {
  background-color: #0056b3;
}

.item-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

/* 交易列表 */
.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.transaction-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
}

.transaction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.transaction-id {
  font-weight: bold;
}

.transaction-status {
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
}

.status-pending {
  background-color: #ffc107;
  color: #212529;
}

.status-approved {
  background-color: #17a2b8;
  color: white;
}

.status-completed {
  background-color: #28a745;
  color: white;
}

.status-negotiated {
  background-color: #6f42c1;
  color: white;
}

.status-timeout {
  background-color: #dc3545;
  color: white;
}

.transaction-info {
  padding: 15px;
}

.transaction-info p {
  margin: 5px 0;
}

.transaction-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  flex-wrap: wrap;
}

/* 表单模态框 */
.form-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.form-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.form-content h3 {
  margin-top: 0;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 10px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input, .form-group textarea, .form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.form-group textarea {
  height: 100px;
  resize: vertical;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.cancel-button {
  padding: 8px 15px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.confirm-button {
  padding: 8px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.cancel-button:hover {
  background-color: #5a6268;
}

.confirm-button:hover {
  background-color: #0056b3;
}

.confirm-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

/* 交易详情 */
.transaction-details {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 5px;
  margin-bottom: 15px;
}

.transaction-details p {
  margin: 5px 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .items-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .action-button {
    width: 100%;
  }
  
  .transaction-actions {
    flex-direction: column;
  }
  
  .transaction-actions button {
    width: 100%;
  }
}

@media (max-width: 576px) {
  .items-grid {
    grid-template-columns: 1fr;
  }
  
  .nav-tabs {
    flex-direction: column;
  }
  
  .tab-button {
    width: 100%;
    text-align: center;
    padding: 10px 0;
  }
  
  .form-content {
    width: 90%;
  }
}

/* 添加eCNY交易说明 */
.notice-container {
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 5px;
  margin-bottom: 20px;
}

/* 添加eCNY获取信息弹窗 */
.token-info {
  padding: 15px;
}

.mini-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}

.mini-button:hover {
  background-color: #0056b3;
}

/* 表单字段说明样式 */
.field-info {
  font-size: 12px;
  color: #6c757d;
  margin-top: 5px;
  line-height: 1.4;
}

/* 保证金计算总结 */
.deposit-summary {
  background-color: #f8f9fa;
  padding: 10px 15px;
  border-radius: 5px;
  margin: 15px 0;
  border-left: 3px solid #007bff;
}

.deposit-summary h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #495057;
}

.deposit-summary p {
  margin: 5px 0;
  font-weight: bold;
}

/* 信誉信息弹窗样式 */
.reputation-modal {
  max-width: 600px;
}

.reputation-details {
  margin-top: 20px;
}

.reputation-stats {
  display: flex;
  justify-content: space-between;
  margin: 20px 0;
}

.reputation-stat {
  text-align: center;
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  background-color: #f8f9fa;
  margin: 0 5px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 5px;
}

.stat-value.success {
  color: #28a745;
}

.stat-value.negotiated {
  color: #ffc107;
}

.stat-value.timeout {
  color: #dc3545;
}

.stat-label {
  font-size: 14px;
  color: #6c757d;
}

.reputation-score {
  background-color: #e9ecef;
  padding: 10px 15px;
  border-radius: 8px;
  margin: 15px 0;
  text-align: center;
  font-size: 18px;
}

.reputation-explanation {
  margin-top: 20px;
  border-top: 1px solid #dee2e6;
  padding-top: 15px;
}

.reputation-explanation h3 {
  margin-bottom: 10px;
  font-size: 16px;
}

.reputation-explanation ul {
  padding-left: 20px;
  margin-bottom: 10px;
}

.reputation-explanation li {
  margin-bottom: 5px;
}

/* 信誉链接样式 */
.reputation-link {
  display: block;
  font-size: 12px;
  color: #0066cc;
  text-decoration: underline;
  margin-top: 3px;
}

.reputation-link:hover {
  color: #004080;
}

/* 商品卡片质押信息样式 */
.deposit-info {
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 5px;
  margin: 10px 0;
  border-left: 3px solid #28a745;
}

.deposit-item {
  margin: 5px 0;
  font-size: 14px;
  color: #495057;
}

/* 交易详情中的质押信息 */
.transaction-deposit {
  margin: 15px 0;
  border-left-color: #007bff;
}

/* 批量操作按钮 */
.batch-actions-container {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.batch-action-button {
  padding: 8px 15px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}

.batch-action-button:hover {
  background-color: #e0e0e0;
}

.batch-action-button.timeout {
  background-color: #dc3545;
  color: white;
}

.batch-action-button.timeout:hover {
  background-color: #c82333;
}

/* 批量操作样式 */
.batch-form {
  max-width: 800px;
  width: 90%;
}

.batch-item {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  background-color: #f8f9fa;
}

.batch-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 10px;
}

.batch-item-header h4 {
  margin: 0;
}

.remove-item-btn {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
}

.remove-item-btn:hover {
  background-color: #c82333;
}

.batch-actions {
  margin: 20px 0;
  text-align: center;
}

.add-item-btn {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 5px;
  cursor: pointer;
}

.add-item-btn:hover {
  background-color: #218838;
}

/* 复选框容器样式 */
.batch-selection {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.selection-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.selection-item {
  padding: 10px;
  border-radius: 5px;
  background-color: #f8f9fa;
}

.checkbox-container {
  display: flex;
  align-items: center;
  position: relative;
  padding-left: 35px;
  cursor: pointer;
  user-select: none;
}

.checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  position: absolute;
  left: 0;
  height: 20px;
  width: 20px;
  background-color: #eee;
  border-radius: 3px;
}

.checkbox-container:hover input ~ .checkmark {
  background-color: #ccc;
}

.checkbox-container input:checked ~ .checkmark {
  background-color: #007bff;
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-container .checkmark:after {
  left: 7px;
  top: 3px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.empty-selection {
  padding: 20px;
  text-align: center;
  background-color: #f8f9fa;
  border-radius: 5px;
}

.selection-summary {
  background-color: #e9ecef;
  padding: 10px;
  border-radius: 5px;
  margin-bottom: 15px;
  font-weight: bold;
}

/* 批量操作按钮容器 */
.batch-actions-container {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.batch-action-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
}

.batch-action-button:hover {
  background-color: #0056b3;
}

.batch-action-button.timeout {
  background-color: #dc3545;
}

.batch-action-button.timeout:hover {
  background-color: #c82333;
}

.quantity-selector {
  display: flex;
  align-items: center;
  margin-top: 10px;
}

.quantity-input {
  width: 50px;
  margin-left: 10px;
  padding: 5px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.selected-items-list {
  margin-top: 10px;
}

.selected-item {
  margin-bottom: 5px;
}
</style>