import Web3 from 'web3'
import { ref } from 'vue';
import web3 from './web3';
import marketContracts from "./abi/market.json";
// 导入eCNY相关功能
import { eCNY, eCNYContractsAddr, getBalanceOf as getTokenBalance } from './eCNY';

export const market = ref(null);
export const marketContractsAddr = ref("0x2B6194190F672d986eF989F0f22aad99fB90C05a")
// 创建智能合约实例
market.value = new web3.eth.Contract(
    marketContracts.abi,
    marketContractsAddr.value
);

// 将合约中的单位转换成用户看到的单位
// 如合约中的1ecny 转换成 0.000001ecny
const formatTokenAmount = (amountBN, decimals = 6) => {
    return Number(amountBN.toString()) / (10 ** decimals);
};


//账户修改
ethereum.on('accountsChanged', function (accounts) {
    console.log('accountsChanged', accounts[0]);
})

export const initWeb = async () => {
    try {
        const accounts = await web3.eth.requestAccounts();
        return accounts
    } catch (error) {
        console.error("连接钱包失败:", error);
        return [];
    }
}

export const getBalanceOf = async (account) => {
    const balance = await market.value.methods.balanceOf(account).call();
    return balance;
};

// 获取商品总数
export const getTotalItemCount = async () => {
    try {
        // itemCounter是下一个可用的商品ID，所以商品总数为itemCounter-1
        const counter = await market.value.methods.itemCounter().call();
        return Math.max(0, parseInt(counter) - 1); // 确保不会返回负数
    } catch (error) {
        console.error("获取商品总数失败:", error);
        return 0;
    }
};

// 获取特定商品的信息
export const getItemInfo = async (itemId) => {
    try {
        const item = await market.value.methods.getItemDetails(itemId).call();
        // 将结构化的返回值转换为更友好的对象
        // 注意：价格使用6位小数的eCNY代币
        const priceInToken = item.price / 1000000;
        
        return {
            id: itemId,
            creator: item.creator,
            price: priceInToken.toString(),
            creatorDepositMultiplier: item.creatorDepositMultiplier,
            buyerDepositMultiplier: item.buyerDepositMultiplier,
            duration: item.duration,
            ipfsHash: item.ipfsHash,
            totalQuantity: item.totalQuantity,
            availableQuantity: item.availableQuantity,
            active: item.active,
            // 添加一些UI友好的字段
            name: `商品 #${itemId}`,
            description: `描述信息在IPFS上: ${item.ipfsHash}`,
            seller: item.creator
        };
    } catch (error) {
        console.error(`获取商品${itemId}信息失败:`, error);
        return null;
    }
};

// 为了兼容home.vue中的引用，添加getItemDetails作为getItemInfo的别名
export const getItemDetails = getItemInfo;

// 获取用户已发布的商品ID列表
export const getUserItems = async (userAddress) => {
    try {
        // 获取商品总数，加1是因为商品ID从1开始
        const itemCount = await getTotalItemCount();
        const userItems = [];
        
        // 遍历所有商品ID (从1开始)
        for (let i = 1; i <= itemCount + 1; i++) {
            try {
                const item = await market.value.methods.items(i).call();
                if (item.creator.toLowerCase() === userAddress.toLowerCase()) {
                    userItems.push(i.toString());
                }
            } catch (error) {
                console.error(`检查商品${i}时出错:`, error);
            }
        }
        
        return userItems;
    } catch (error) {
        console.error(`获取用户${userAddress}的商品失败:`, error);
        return [];
    }
};

// 获取市场状态
export const getMarketStatus = async () => {
    try {
        const isPaused = await market.value.methods.paused().call();
        // 如果市场暂停则为非活跃状态
        return !isPaused;
    } catch (error) {
        console.error("获取市场状态失败:", error);
        return false;
    }
};

/**
 * 上传文件到IPFS
 * @param {File} file - 要上传的文件
 * @returns {Promise<string>} - 返回IPFS哈希
 */
export const uploadToIpfs = async (file) => {
    try {
        console.log(`开始上传文件 ${file.name} (${file.size} 字节) 到IPFS...`);
        
        const formData = new FormData();
        formData.append('file', file);
        
        console.log("发送请求到IPFS API...");
        const response = await fetch('http://127.0.0.1:8083/api/ipfs/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`上传失败，服务器返回: ${response.status} ${response.statusText}`);
        }
        
        console.log("收到IPFS服务器响应...");
        const result = await response.json();
        console.log("IPFS服务器响应数据:", result);
        
        // 修正：适配服务器实际返回的格式，成功状态码为200
        if ((result.code === 200 || result.code === 0) && result.message === "文件上传成功" && result.data && result.data.ipfsHash) {
            console.log(`文件上传成功，获取到IPFS哈希: ${result.data.ipfsHash}`);
            return result.data.ipfsHash;
        } else {
            // 服务器可能返回了其他错误情况
            const errorMsg = result.message || '上传IPFS失败，服务器未返回有效哈希';
            console.error(errorMsg, result);
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error("上传IPFS过程中发生错误:", error);
        throw new Error(`IPFS上传失败: ${error.message}`);
    }
};

/**
 * 发布商品
 * @param {uint256} price - 商品价格(eCNY)
 * @param {uint256} creatorDepositMultiplier - 创建者保证金倍数
 * @param {uint256} buyerDepositMultiplier - 买家保证金倍数
 * @param {uint256} duration - 交易持续时间（秒）
 * @param {string} ipfsHash - IPFS哈希，包含商品元数据
 * @param {uint256} quantity - 商品数量
 * @returns {Promise<{success: boolean, itemId: string|null, message: string}>} - 返回结果
 */
export const publishItem = async (price, creatorDepositMultiplier, buyerDepositMultiplier, duration, ipfsHash, quantity) => {
    try {
        console.log("发布商品函数开始执行");
        console.log("参数:", { price, creatorDepositMultiplier, buyerDepositMultiplier, duration, ipfsHash, quantity });
        
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            console.error("未检测到钱包账户");
            return { success: false, itemId: null, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        console.log("发送者账户:", sender);
        
        // 价格参数处理 - 将用户输入的价格（如0.0001 eCNY）转换为合约需要的单位（如100）
        // 使用BigNumber确保精度不丢失
        const priceDecimal = parseFloat(price);
        // 检查输入是否小于eCNY的最小单位
        if (priceDecimal < 0.000001) {
            return { 
                success: false, 
                itemId: null, 
                message: `价格不能小于0.000001 eCNY（最小单位）` 
            };
        }
        
        // 转换为最小单位，并确保没有小数部分
        const priceInSmallestUnit = web3.utils.toBN(Math.round(priceDecimal * 1000000));
        const priceStr = priceInSmallestUnit.toString();
        console.log("商品价格(最小单位):", priceStr);
        
        // 计算需要的保证金：价格 * 创建者保证金倍数 * 数量
        const creatorMultiplier = parseInt(creatorDepositMultiplier);
        const depositAmount = priceDecimal * creatorMultiplier * parseInt(quantity);
        console.log("计算的保证金金额(eCNY):", depositAmount);
        
        // 转换保证金为最小单位
        const depositBN = web3.utils.toBN(Math.round(depositAmount * 1000000));
        const depositAmountStr = depositBN.toString();
        console.log("保证金金额(最小单位):", depositAmountStr);
            
        // 检查用户eCNY余额
        console.log("检查用户eCNY余额...");
        const tokenBalance = await getTokenBalance(sender);
        console.log("用户eCNY余额:", tokenBalance);
        
        if (web3.utils.toBN(tokenBalance).lt(depositBN)) {
            console.error("eCNY余额不足", {
                需要: depositAmount,
                现有: formatTokenAmount(tokenBalance, 6)
            });
            return { 
                success: false, 
                itemId: null, 
                message: `eCNY余额不足，需要${depositAmount.toFixed(6)} eCNY作为保证金` 
            };
        }
        
        // 检查代币授权额度
        console.log("检查代币授权额度...");
        const allowance = await eCNY.value.methods.allowance(sender, marketContractsAddr.value).call();
        console.log("当前授权额度:", allowance, "需要:", depositAmountStr);
        
        if (web3.utils.toBN(allowance).lt(depositBN)) {
            console.log("授权额度不足，发起授权交易...");
            // 授权市场合约使用eCNY
            try {
                const approveResult = await eCNY.value.methods.approve(marketContractsAddr.value, depositAmountStr)
                    .send({ from: sender });
                console.log("授权交易完成:", approveResult);
            } catch (approveError) {
                console.error("授权失败:", approveError);
                return {
                    success: false,
                    itemId: null,
                    message: `代币授权失败: ${approveError.message || '未知错误'}`
                };
            }
        } else {
            console.log("授权额度充足，无需额外授权");
        }
        
        // 发送交易
        console.log("发起发布商品交易...");
        console.log("调用合约参数:", {
            price: priceStr,
            creatorDepositMultiplier,
            buyerDepositMultiplier,
            duration,
            ipfsHash,
            quantity
        });
        
        // 尝试估算gas用量
        let estimatedGas;
        try {
            estimatedGas = await market.value.methods.publishItem(
                priceStr,
                creatorDepositMultiplier,
                buyerDepositMultiplier,
                duration,
                ipfsHash,
                quantity
            ).estimateGas({ from: sender });
            console.log("估算的Gas用量:", estimatedGas);
            // 增加一些额外的gas以确保交易成功
            estimatedGas = Math.floor(estimatedGas * 1.2);
        } catch (gasError) {
            console.error("Gas估算失败:", gasError);
            // 如果无法估算，使用默认值
            estimatedGas = 500000;
        }
        
        const result = await market.value.methods.publishItem(
            priceStr,
            creatorDepositMultiplier,
            buyerDepositMultiplier,
            duration,
            ipfsHash,
            quantity
        ).send({ 
            from: sender,
            gas: estimatedGas
        });
        
        console.log("发布商品交易完成:", result);
        
        // 从交易结果中获取商品ID
        let itemId = null;
        if (result && result.events && result.events.ItemPublished) {
            itemId = result.events.ItemPublished.returnValues.itemId;
            console.log("从事件中获取到商品ID:", itemId);
        } else {
            // 如果没有从事件中获取到，尝试通过查询当前商品计数器获取
            console.log("从事件中未获取到商品ID，尝试从计数器获取");
            const counter = await market.value.methods.itemCounter().call();
            itemId = (parseInt(counter) - 1).toString(); // 最新创建的商品ID应该是计数器减1
            console.log("从计数器获取的商品ID:", itemId);
        }
        
        console.log("发布商品流程完成，商品ID:", itemId);
        return { 
            success: true, 
            itemId, 
            message: `成功创建商品 ID: ${itemId}` 
        };
    } catch (error) {
        console.error("发布商品失败:", error);
        return { 
            success: false, 
            itemId: null, 
            message: `发布失败: ${error.message || '未知错误'}` 
        };
    }
};

/**
 * 批量准备商品元数据并上传到IPFS
 * @param {Array<string>} names - 商品名称数组
 * @param {Array<string>} descriptions - 商品描述数组
 * @param {Array<File>} imageFiles - 商品图片文件数组（可选）
 * @returns {Promise<Array<string>>} - 返回元数据的IPFS哈希数组
 */
export const batchPrepareItemMetadata = async (names, descriptions, imageFiles = []) => {
    try {
        console.log("开始批量准备商品元数据...");
        console.log("商品数量:", names.length);
        
        // 验证数组长度
        if (names.length !== descriptions.length) {
            throw new Error("名称和描述数组长度不一致");
        }
        
        if (imageFiles.length > 0 && imageFiles.length !== names.length) {
            throw new Error("图片文件数组长度与商品数量不一致");
        }
        
        const ipfsHashes = [];
        
        // 并行处理所有元数据上传，提高效率
        const uploadPromises = names.map(async (name, index) => {
            const description = descriptions[index];
            const imageFile = imageFiles.length > 0 ? imageFiles[index] : null;
            
            console.log(`准备第${index + 1}个商品元数据: ${name}`);
            
            try {
                // 上传图片到IPFS（如果有）
                let imageIpfsHash = '';
                if (imageFile) {
                    console.log(`上传第${index + 1}个商品图片到IPFS...`);
                    imageIpfsHash = await uploadToIpfs(imageFile);
                    console.log(`第${index + 1}个商品图片上传成功，IPFS哈希:`, imageIpfsHash);
                }
                
                // 构建商品元数据
                const metadata = {
                    name,
                    description,
                    image: imageIpfsHash
                };
                
                // 将元数据JSON转换为Blob并上传到IPFS
                const metadataJson = JSON.stringify(metadata);
                const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
                const metadataFile = new File([metadataBlob], `metadata_${index}.json`, { type: 'application/json' });
                
                // 上传元数据文件到IPFS
                const metadataIpfsHash = await uploadToIpfs(metadataFile);
                console.log(`第${index + 1}个商品元数据上传成功，IPFS哈希:`, metadataIpfsHash);
                
                return metadataIpfsHash;
            } catch (itemError) {
                console.error(`处理第${index + 1}个商品元数据失败:`, itemError);
                throw itemError; // 抛出错误以便Promise.all能够捕获
            }
        });
        
        // 等待所有元数据上传完成
        const results = await Promise.all(uploadPromises);
        console.log("所有商品元数据上传完成，IPFS哈希数组:", results);
        
        return results;
    } catch (error) {
        console.error("批量准备商品元数据失败:", error);
        throw error;
    }
};

/**
 * 准备商品元数据并上传到IPFS
 * @param {string} name - 商品名称
 * @param {string} description - 商品描述
 * @param {File} imageFile - 商品图片文件（可选）
 * @returns {Promise<string>} - 返回元数据的IPFS哈希
 */
export const prepareItemMetadata = async (name, description, imageFile) => {
    try {
        // 上传图片到IPFS（如果有）
        let imageIpfsHash = '';
        if (imageFile) {
            console.log("开始上传图片到IPFS...", imageFile);
            imageIpfsHash = await uploadToIpfs(imageFile);
            console.log("图片上传成功，IPFS哈希:", imageIpfsHash);
        }
        
        // 构建商品元数据
        const metadata = {
            name,
            description,
            image: imageIpfsHash
        };
        
        console.log("准备的元数据:", metadata);
        
        // 将元数据JSON转换为Blob并上传到IPFS
        console.log("准备上传元数据到IPFS...");
        const metadataJson = JSON.stringify(metadata);
        console.log("元数据JSON:", metadataJson);
        
        const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
        console.log("创建元数据Blob, 大小:", metadataBlob.size, "字节");
        
        const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });
        console.log("创建元数据文件:", metadataFile.name, metadataFile.size, "字节");
        
        // 上传元数据文件到IPFS
        const metadataIpfsHash = await uploadToIpfs(metadataFile);
        console.log("元数据上传成功，IPFS哈希:", metadataIpfsHash);
        
        // 返回元数据的IPFS哈希
        return metadataIpfsHash;
    } catch (error) {
        console.error("准备商品元数据失败:", error);
        throw error;
    }
};

/**
 * 增加商品数量
 * @param {string} itemId - 商品ID
 * @param {number} additionalQuantity - 增加的数量
 * @returns {Promise<{success: boolean, message: string}>} - 返回结果
 */
export const increaseItemQuantity = async (itemId, additionalQuantity) => {
    try {
        console.log("开始执行增加商品数量函数");
        console.log("参数:", { itemId, additionalQuantity });
        
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            return { success: false, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        console.log("发送者账户:", sender);
        
        const item = await getItemInfo(itemId);
        
        if (!item) {
            return { success: false, message: '商品不存在' };
        }
        
        if (item.creator.toLowerCase() !== sender.toLowerCase()) {
            return { success: false, message: '只有商品发布者可以增加数量' };
        }
        
        // 计算需要额外支付的保证金：价格 * 创建者保证金倍数 * 增加数量
        const priceDecimal = parseFloat(item.price);
        const creatorMultiplier = parseInt(item.creatorDepositMultiplier);
        const quantityToAdd = parseInt(additionalQuantity);
        const additionalDepositAmount = priceDecimal * creatorMultiplier * quantityToAdd;
        console.log("需要额外支付的保证金(eCNY):", additionalDepositAmount);
        
        // 将保证金转换为最小单位
        const depositBN = web3.utils.toBN(Math.round(additionalDepositAmount * 1000000));
        const depositAmountStr = depositBN.toString();
        console.log("保证金金额(最小单位):", depositAmountStr);
        
        // 获取ERC20代币合约地址
        const erc20TokenAddr = await market.value.methods.erc20Token().call();
        console.log("eCNY代币合约地址:", erc20TokenAddr);
        
        // 创建代币合约实例
        const tokenABI = [
            // 检查余额方法
            {
                "constant": true,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function"
            },
            // 授权方法
            {
                "constant": false,
                "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}],
                "name": "approve",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            },
            // 查询授权额度方法
            {
                "constant": true,
                "inputs": [{"name": "_owner", "type": "address"}, {"name": "_spender", "type": "address"}],
                "name": "allowance",
                "outputs": [{"name": "", "type": "uint256"}],
                "type": "function"
            }
        ];
        const eCNY = new web3.eth.Contract(tokenABI, erc20TokenAddr);
        
        // 检查用户eCNY余额
        console.log("检查用户eCNY余额...");
        const tokenBalance = await eCNY.methods.balanceOf(sender).call();
        console.log("用户eCNY余额:", formatTokenAmount(tokenBalance, 6), "eCNY");
        
        if (web3.utils.toBN(tokenBalance).lt(depositBN)) {
            console.error("eCNY余额不足", {
                需要: additionalDepositAmount,
                现有: formatTokenAmount(tokenBalance, 6)
            });
            return { 
                success: false, 
                message: `eCNY余额不足，需要${additionalDepositAmount.toFixed(6)} eCNY作为保证金` 
            };
        }
        
        // 检查代币授权额度
        console.log("检查代币授权额度...");
        const allowance = await eCNY.methods.allowance(sender, marketContractsAddr.value).call();
        console.log("当前授权额度:", formatTokenAmount(allowance, 6), "eCNY，需要:", additionalDepositAmount, "eCNY");
        
        if (web3.utils.toBN(allowance).lt(depositBN)) {
            console.log("授权额度不足，发起授权交易...");
            // 授权市场合约使用eCNY
            try {
                const approveResult = await eCNY.methods.approve(marketContractsAddr.value, depositAmountStr)
                    .send({ from: sender });
                console.log("授权交易完成:", approveResult);
            } catch (approveError) {
                console.error("授权失败:", approveError);
                return {
                    success: false,
                    message: `代币授权失败: ${approveError.message || '未知错误'}`
                };
            }
        } else {
            console.log("授权额度充足，无需额外授权");
        }
        
        // 尝试估算gas用量
        let estimatedGas;
        try {
            estimatedGas = await market.value.methods.addItemQuantity(
                itemId,
                additionalQuantity
            ).estimateGas({ from: sender });
            console.log("估算的Gas用量:", estimatedGas);
            // 增加一些额外的gas以确保交易成功
            estimatedGas = Math.floor(estimatedGas * 1.2);
        } catch (gasError) {
            console.error("Gas估算失败:", gasError);
            // 如果无法估算，使用默认值
            estimatedGas = 300000;
        }
        
        // 发送交易
        console.log("提交增加商品数量交易...");
        const result = await market.value.methods.addItemQuantity(
            itemId,
            additionalQuantity
        ).send({ 
            from: sender,
            gas: estimatedGas
        });
        
        console.log("增加商品数量交易完成:", result);
        
        return { 
            success: true, 
            message: `成功增加商品${itemId}的数量: ${additionalQuantity}` 
        };
    } catch (error) {
        console.error("增加商品数量失败:", error);
        return { 
            success: false, 
            message: `增加商品数量失败: ${error.message || '未知错误'}` 
        };
    }
};

/**
 * 请求交易（购买商品）
 * @param {string} itemId - 商品ID
 * @returns {Promise<{success: boolean, transactionId: string|null, message: string}>} - 返回结果
 */
export const requestTransaction = async (itemId) => {
    try {
        console.log("开始执行请求交易函数");
        console.log("购买商品ID:", itemId);
        
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            return { success: false, transactionId: null, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        console.log("发送者账户:", sender);
        
        const item = await getItemInfo(itemId);
        
        if (!item) {
            return { success: false, transactionId: null, message: '商品不存在' };
        }
        
        if (item.availableQuantity <= 0) {
            return { success: false, transactionId: null, message: '商品数量不足' };
        }
        
        // 检查是否是购买自己发布的商品
        if (item.creator.toLowerCase() === sender.toLowerCase()) {
            return { success: false, transactionId: null, message: '不能购买自己发布的商品' };
        }
        
        // 计算需要支付的保证金（价格 * 买家保证金倍数）
        const priceDecimal = parseFloat(item.price);
        const buyerMultiplier = parseInt(item.buyerDepositMultiplier);
        const depositAmount = priceDecimal * buyerMultiplier;
        console.log("需要支付的保证金(eCNY):", depositAmount);
        
        // 将保证金转换为最小单位
        const depositBN = web3.utils.toBN(Math.round(depositAmount * 1000000));
        const depositAmountStr = depositBN.toString();
        console.log("保证金金额(最小单位):", depositAmountStr);
        
        // 检查用户eCNY余额（使用导入的方法）
        console.log("检查用户eCNY余额...");
        const tokenBalance = await getTokenBalance(sender);
        console.log("用户eCNY余额:", tokenBalance);
        
        if (web3.utils.toBN(tokenBalance).lt(depositBN)) {
            return { 
                success: false, 
                transactionId: null, 
                message: `eCNY余额不足，需要${depositAmount.toFixed(6)} eCNY作为保证金` 
            };
        }
        
        // 检查代币授权额度
        console.log("检查代币授权额度...");
        const allowance = await eCNY.value.methods.allowance(sender, marketContractsAddr.value).call();
        console.log("当前授权额度:", allowance, "需要:", depositAmountStr);
        
        if (web3.utils.toBN(allowance).lt(depositBN)) {
            console.log("授权额度不足，发起授权交易...");
            // 授权市场合约使用eCNY
            try {
                const approveResult = await eCNY.value.methods.approve(marketContractsAddr.value, depositAmountStr)
                    .send({ from: sender });
                console.log("授权交易完成:", approveResult);
            } catch (approveError) {
                console.error("授权失败:", approveError);
                return {
                    success: false,
                    transactionId: null,
                    message: `代币授权失败: ${approveError.message || '未知错误'}`
                };
            }
        } else {
            console.log("授权额度充足，无需额外授权");
        }
        
        // 尝试估算gas用量
        console.log("开始发起请求交易...");
        let estimatedGas;
        try {
            estimatedGas = await market.value.methods.requestTransaction(itemId)
                .estimateGas({ from: sender });
            console.log("估算的Gas用量:", estimatedGas);
            // 增加20%的gas余量
            estimatedGas = Math.floor(estimatedGas * 1.2);
        } catch (gasError) {
            console.error("Gas估算失败:", gasError);
            // 如果无法估算，使用默认值
            estimatedGas = 300000;
        }
        
        // 调用合约请求交易
        const result = await market.value.methods.requestTransaction(itemId)
            .send({ 
                from: sender,
                gas: estimatedGas
            });
        
        console.log("请求交易完成:", result);
        
        // 从结果或事件中获取交易ID
        const events = result.events;
        const transactionId = events.TransactionRequested ? 
            events.TransactionRequested.returnValues.transactionId : 
            null;
        
        console.log("获取到的交易ID:", transactionId);
        
        return { 
            success: true, 
            transactionId,
            message: `成功请求交易，商品ID: ${itemId}, 交易ID: ${transactionId}` 
        };
    } catch (error) {
        console.error("请求交易失败:", error);
        // 解析错误信息，提取合约抛出的具体错误
        let errorMessage = '请求交易失败';
        if (error.message) {
            // 检查是否包含特定的错误信息
            if (error.message.includes('Cannot be picked up by oneself')) {
                errorMessage = '不能购买自己发布的商品';
            } else {
                errorMessage = `请求交易失败: ${error.message}`;
            }
        }
        return { 
            success: false, 
            transactionId: null,
            message: errorMessage
        };
    }
};

/**
 * 获取用户信誉
 * @param {string} userAddress - 用户地址
 * @returns {Promise<{successfulTrades: number, negotiatedTrades: number, timedOutTrades: number}|null>} - 用户信誉
 */
export const getUserReputation = async (userAddress) => {
    try {
        const reputation = await market.value.methods.getReputation(userAddress).call();
        return {
            successfulTrades: reputation.successfulTrades,
            negotiatedTrades: reputation.negotiatedTrades,
            timedOutTrades: reputation.timedOutTrades
        };
    } catch (error) {
        console.error(`获取用户${userAddress}信誉失败:`, error);
        return null;
    }
};

/**
 * 获取交易总数
 * @returns {Promise<number>} - 交易总数
 */
export const getTransactionCount = async () => {
    try {
        // transactionCounter是下一个可用的交易ID，所以交易总数为transactionCounter-1
        const counter = await market.value.methods.transactionCounter().call();
        return Math.max(0, parseInt(counter) - 1); // 确保不会返回负数
    } catch (error) {
        console.error("获取交易总数失败:", error);
        return 0;
    }
};

/**
 * 获取交易详情
 * @param {string} transactionId - 交易ID
 * @returns {Promise<object|null>} - 交易详情
 */
export const getTransactionDetails = async (transactionId) => {
    try {
        const details = await market.value.methods.getTransactionDetails(transactionId).call();
        
        // 定义交易状态映射
        const statusMap = {
            0: '待处理',
            1: '已批准',
            2: '已完成',
            3: '已超时',
            4: '已取消'
        };
        
        // 将保证金从合约单位转换为显示单位（6位小数）
        const depositInToken = details.deposit / 1000000; // 使用6位小数
        
        return {
            id: transactionId,
            itemId: details.itemId,
            participant: details.participant,
            nftId: details.nftId,
            deposit: depositInToken.toString(),
            endTime: new Date(details.endTime * 1000).toLocaleString(),
            endTimeRaw: details.endTime,
            status: details.status,
            statusText: statusMap[details.status] || '未知状态'
        };
    } catch (error) {
        console.error(`获取交易${transactionId}详情失败:`, error);
        return null;
    }
};

/**
 * 获取用户的所有交易
 * @param {string} userAddress - 用户地址
 * @returns {Promise<Array>} - 用户的所有交易
 */
export const getUserTransactions = async (userAddress) => {
    try {
        // 获取交易总数，加1是因为交易ID从1开始
        const transactionCount = await getTransactionCount();
        const userTransactions = [];
        
        // 遍历所有交易ID (从1开始)
        for (let i = 1; i <= transactionCount + 1; i++) {
            try {
                const txDetails = await market.value.methods.transactions(i).call();
                
                // 检查用户是否是交易的参与者或商品创建者
                if (txDetails.participant.toLowerCase() === userAddress.toLowerCase()) {
                    const fullDetails = await getTransactionDetails(i.toString());
                    if (fullDetails) {
                        userTransactions.push(fullDetails);
                    }
                } else {
                    // 获取商品信息，检查用户是否是商品创建者
                    const itemId = txDetails.itemId;
                    const item = await market.value.methods.items(itemId).call();
                    if (item.creator.toLowerCase() === userAddress.toLowerCase()) {
                        const fullDetails = await getTransactionDetails(i.toString());
                        if (fullDetails) {
                            userTransactions.push(fullDetails);
                        }
                    }
                }
            } catch (error) {
                console.error(`检查交易${i}时出错:`, error);
            }
        }
        
        return userTransactions;
    } catch (error) {
        console.error(`获取用户${userAddress}的交易失败:`, error);
        return [];
    }
};

/**
 * 批准交易
 * @param {string} transactionId - 交易ID
 * @returns {Promise<{success: boolean, message: string}>} - 返回结果
 */
export const approveTransaction = async (transactionId) => {
    try {
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            return { success: false, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        
        // 获取交易详情
        const txDetails = await getTransactionDetails(transactionId);
        if (!txDetails) {
            return { success: false, message: '交易不存在' };
        }
        
        // 获取商品信息，检查用户是否是商品创建者
        const itemId = txDetails.itemId;
        const item = await market.value.methods.items(itemId).call();
        if (item.creator.toLowerCase() !== sender.toLowerCase()) {
            return { success: false, message: '只有商品创建者可以批准交易' };
        }
        
        const gas = await market.value.methods.approveTransaction(transactionId)
            .estimateGas({ from: sender });
        
        await market.value.methods.approveTransaction(transactionId)
            .send({ from: sender, gas });
        
        return { 
            success: true, 
            message: `成功批准交易，交易ID: ${transactionId}` 
        };
    } catch (error) {
        console.error("批准交易失败:", error);
        return { 
            success: false, 
            message: `批准交易失败: ${error.message || '未知错误'}` 
        };
    }
};

/**
 * 确认交易完成
 * @param {string} transactionId - 交易ID 
 * @param {number} status - 交易状态（2成功完成，3协商完成）
 * @returns {Promise<{success: boolean, message: string}>} - 返回结果
 */
export const confirmTransaction = async (transactionId, status = 2) => {
    try {
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            return { success: false, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        
        // 获取交易详情
        const txDetails = await getTransactionDetails(transactionId);
        if (!txDetails) {
            return { success: false, message: '交易不存在' };
        }
        
        // 检查用户是否是交易参与者
        if (txDetails.participant.toLowerCase() !== sender.toLowerCase()) {
            return { success: false, message: '只有交易参与者可以确认交易完成' };
        }
        
        // 检查交易状态是否为已批准
        if (txDetails.status !== "1") {
            return { success: false, message: '只能确认已批准的交易' };
        }
        
        const gas = await market.value.methods.confirmReceipt(transactionId, status)
            .estimateGas({ from: sender });
        
        await market.value.methods.confirmReceipt(transactionId, status)
            .send({ from: sender, gas });
        
        const statusText = status === 2 ? '成功' : '协商';
        
        return { 
            success: true, 
            message: `已${statusText}完成交易，交易ID: ${transactionId}` 
        };
    } catch (error) {
        console.error("确认交易完成失败:", error);
        return { 
            success: false, 
            message: `确认交易完成失败: ${error.message || '未知错误'}` 
        };
    }
};

/**
 * 处理超时交易
 * @param {string} transactionId - 交易ID
 * @returns {Promise<{success: boolean, message: string}>} - 返回结果
 */
export const handleTimeoutTransaction = async (transactionId) => {
    try {
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            return { success: false, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        
        // 获取交易详情
        const txDetails = await getTransactionDetails(transactionId);
        if (!txDetails) {
            return { success: false, message: '交易不存在' };
        }
        
        // 检查交易是否已超时
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime <= txDetails.endTimeRaw) {
            return { success: false, message: '交易尚未超时' };
        }
        
        const gas = await market.value.methods.handleTimeout(transactionId)
            .estimateGas({ from: sender });
        
        await market.value.methods.handleTimeout(transactionId)
            .send({ from: sender, gas });
        
        return { 
            success: true, 
            message: `成功处理超时交易，交易ID: ${transactionId}` 
        };
    } catch (error) {
        console.error("处理超时交易失败:", error);
        return { 
            success: false, 
            message: `处理超时交易失败: ${error.message || '未知错误'}` 
        };
    }
};

/**
 * 撤回商品（减少商品库存）
 * @param {string} itemId - 商品ID
 * @param {number} quantity - 撤回数量
 * @returns {Promise<{success: boolean, message: string}>} - 返回结果
 */
export const withdrawItem = async (itemId, quantity) => {
    try {
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            return { success: false, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        const item = await getItemInfo(itemId);
        
        if (!item) {
            return { success: false, message: '商品不存在' };
        }
        
        if (item.creator.toLowerCase() !== sender.toLowerCase()) {
            return { success: false, message: '只有商品发布者可以撤回商品' };
        }
        
        if (item.availableQuantity < quantity) {
            return { success: false, message: `可用商品数量不足，当前仅有 ${item.availableQuantity} 个` };
        }
        
        const gas = await market.value.methods.withdrawItem(itemId, quantity)
            .estimateGas({ from: sender });
        
        await market.value.methods.withdrawItem(itemId, quantity)
            .send({ from: sender, gas });
        
        return { 
            success: true, 
            message: `成功撤回商品，商品ID: ${itemId}, 撤回数量: ${quantity}` 
        };
    } catch (error) {
        console.error("撤回商品失败:", error);
        return { 
            success: false, 
            message: `撤回商品失败: ${error.message || '未知错误'}` 
        };
    }
};

// 获取创建者保证金乘数
export const getItemCreatorDeposit = async (itemId) => {
    try {
        const depositMultiplier = await market.value.methods.getItemCreatorDepositMultiplier(itemId).call();
        return depositMultiplier / 100; // 转换为百分比形式显示（例如：1.5而不是150）
    } catch (error) {
        console.error(`获取物品${itemId}创建者保证金乘数失败:`, error);
        return 0;
    }
};

// 获取买家保证金乘数
export const getItemBuyerDeposit = async (itemId) => {
    try {
        const depositMultiplier = await market.value.methods.getItemBuyerDepositMultiplier(itemId).call();
        return depositMultiplier / 100; // 转换为百分比形式显示（例如：1.5而不是150）
    } catch (error) {
        console.error(`获取物品${itemId}买家保证金乘数失败:`, error);
        return 0;
    }
};

/**
 * 批量发布商品
 * @param {Array<number>} prices - 商品价格数组(eCNY)
 * @param {Array<number>} creatorDepositMultipliers - 创建者保证金倍数数组
 * @param {Array<number>} buyerDepositMultipliers - 买家保证金倍数数组
 * @param {Array<number>} durations - 交易持续时间数组（秒）
 * @param {Array<string>} ipfsHashes - IPFS哈希数组，包含商品元数据
 * @param {Array<number>} quantities - 商品数量数组
 * @returns {Promise<{success: boolean, itemIds: Array<string>|null, message: string}>} - 返回结果
 */
export const batchPublishItems = async (prices, creatorDepositMultipliers, buyerDepositMultipliers, durations, ipfsHashes, quantities) => {
    try {
        console.log("批量发布商品函数开始执行");
        console.log("参数:", { 
            prices, 
            creatorDepositMultipliers, 
            buyerDepositMultipliers, 
            durations, 
            ipfsHashes, 
            quantities 
        });
        
        // 验证数组长度是否一致
        const arrayLength = prices.length;
        if (creatorDepositMultipliers.length !== arrayLength || 
            buyerDepositMultipliers.length !== arrayLength || 
            durations.length !== arrayLength || 
            ipfsHashes.length !== arrayLength || 
            quantities.length !== arrayLength) {
            return { 
                success: false, 
                itemIds: null, 
                message: '所有参数数组长度必须一致' 
            };
        }
        
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            console.error("未检测到钱包账户");
            return { success: false, itemIds: null, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        console.log("发送者账户:", sender);
        
        // 处理价格参数，转换为合约需要的格式
        const pricesInSmallestUnit = [];
        let totalDeposit = 0;
        
        for (let i = 0; i < arrayLength; i++) {
            const priceDecimal = parseFloat(prices[i]);
            // 检查输入是否小于eCNY的最小单位
            if (priceDecimal < 0.000001) {
                return { 
                    success: false, 
                    itemIds: null, 
                    message: `价格不能小于0.000001 eCNY（最小单位），第${i+1}个商品价格无效` 
                };
            }
            
            // 转换为最小单位，并确保没有小数部分
            const priceInSmallestUnit = web3.utils.toBN(Math.round(priceDecimal * 1000000));
            pricesInSmallestUnit.push(priceInSmallestUnit.toString());
            
            // 计算需要的保证金：价格 * 创建者保证金倍数 * 数量
            const creatorMultiplier = parseInt(creatorDepositMultipliers[i]);
            const quantity = parseInt(quantities[i]);
            const itemDeposit = priceDecimal * creatorMultiplier * quantity;
            totalDeposit += itemDeposit;
        }
        
        console.log("商品价格(最小单位):", pricesInSmallestUnit);
        console.log("总保证金(eCNY):", totalDeposit);
        
        // 转换总保证金为最小单位
        const totalDepositBN = web3.utils.toBN(Math.round(totalDeposit * 1000000));
        const totalDepositStr = totalDepositBN.toString();
        console.log("总保证金(最小单位):", totalDepositStr);
            
        // 检查用户eCNY余额
        console.log("检查用户eCNY余额...");
        const tokenBalance = await getTokenBalance(sender);
        console.log("用户eCNY余额:", tokenBalance);
        
        if (web3.utils.toBN(tokenBalance).lt(totalDepositBN)) {
            console.error("eCNY余额不足", {
                需要: totalDeposit,
                现有: formatTokenAmount(tokenBalance, 6)
            });
            return { 
                success: false, 
                itemIds: null, 
                message: `eCNY余额不足，需要${totalDeposit.toFixed(6)} eCNY作为保证金` 
            };
        }
        
        // 检查代币授权额度
        console.log("检查代币授权额度...");
        const allowance = await eCNY.value.methods.allowance(sender, marketContractsAddr.value).call();
        console.log("当前授权额度:", allowance, "需要:", totalDepositStr);
        
        if (web3.utils.toBN(allowance).lt(totalDepositBN)) {
            console.log("授权额度不足，发起授权交易...");
            // 授权市场合约使用eCNY
            try {
                const approveResult = await eCNY.value.methods.approve(marketContractsAddr.value, totalDepositStr)
                    .send({ from: sender });
                console.log("授权交易完成:", approveResult);
            } catch (approveError) {
                console.error("授权失败:", approveError);
                return {
                    success: false,
                    itemIds: null,
                    message: `代币授权失败: ${approveError.message || '未知错误'}`
                };
            }
        } else {
            console.log("授权额度充足，无需额外授权");
        }
        
        // 发送批量发布交易
        console.log("发起批量发布商品交易...");
        console.log("调用合约参数:", {
            prices: pricesInSmallestUnit,
            creatorDepositMultipliers,
            buyerDepositMultipliers,
            durations,
            ipfsHashes,
            quantities
        });
        
        // 尝试估算gas用量
        let estimatedGas;
        try {
            estimatedGas = await market.value.methods.batchPublishItems(
                pricesInSmallestUnit,
                creatorDepositMultipliers,
                buyerDepositMultipliers,
                durations,
                ipfsHashes,
                quantities
            ).estimateGas({ from: sender });
            console.log("估算的Gas用量:", estimatedGas);
            // 增加一些额外的gas以确保交易成功
            estimatedGas = Math.floor(estimatedGas * 1.2);
        } catch (gasError) {
            console.error("Gas估算失败:", gasError);
            // 如果无法估算，使用默认值
            estimatedGas = 1000000; // 批量操作需要更多gas
        }
        
        const result = await market.value.methods.batchPublishItems(
            pricesInSmallestUnit,
            creatorDepositMultipliers,
            buyerDepositMultipliers,
            durations,
            ipfsHashes,
            quantities
        ).send({ 
            from: sender,
            gas: estimatedGas
        });
        
        console.log("批量发布商品交易完成:", result);
        
        // 从交易结果中获取商品ID数组
        let itemIds = null;
        if (result && result.events && result.events.ItemsBatchPublished) {
            itemIds = result.events.ItemsBatchPublished.returnValues.itemIds;
            console.log("从事件中获取到商品ID数组:", itemIds);
        } else {
            // 如果没有从事件中获取到，尝试通过查询当前商品计数器获取
            console.log("从事件中未获取到商品ID数组，尝试估算");
            const counter = await market.value.methods.itemCounter().call();
            const lastItemId = parseInt(counter) - 1;
            itemIds = [];
            // 假设所有商品ID是连续的
            for (let i = 0; i < arrayLength; i++) {
                itemIds.push((lastItemId - arrayLength + i + 1).toString());
            }
            console.log("估算的商品ID数组:", itemIds);
        }
        
        console.log("批量发布商品流程完成，商品ID数组:", itemIds);
        return { 
            success: true, 
            itemIds, 
            message: `成功批量创建${itemIds.length}个商品` 
        };
    } catch (error) {
        console.error("批量发布商品失败:", error);
        return { 
            success: false, 
            itemIds: null, 
            message: `批量发布失败: ${error.message || '未知错误'}` 
        };
    }
};

/**
 * 批量请求交易（批量购买商品）
 * @param {Array<string>} itemIds - 商品ID数组
 * @returns {Promise<{success: boolean, transactionIds: Array<string>|null, message: string}>} - 返回结果
 */
export const batchRequestTransactions = async (itemIds) => {
    try {
        console.log("开始执行批量请求交易函数");
        console.log("商品ID数组:", itemIds);
        
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            return { success: false, transactionIds: null, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        console.log("发送者账户:", sender);
        
        // 检查每个商品是否存在且有可用数量
        let totalDeposit = 0;
        const validItemIds = [];
        const selfOwnedItems = [];
        
        for (const itemId of itemIds) {
            try {
                const item = await getItemInfo(itemId);
                
                if (!item) {
                    console.warn(`商品${itemId}不存在，已跳过`);
                    continue;
                }
                
                if (item.availableQuantity <= 0) {
                    console.warn(`商品${itemId}数量不足，已跳过`);
                    continue;
                }
                
                if (item.creator.toLowerCase() === sender.toLowerCase()) {
                    console.warn(`商品${itemId}是由您创建的，无法购买自己的商品，已跳过`);
                    selfOwnedItems.push(itemId);
                    continue;
                }
                
                // 计算需要支付的保证金（价格 * 买家保证金倍数）
                const priceDecimal = parseFloat(item.price);
                const buyerMultiplier = parseInt(item.buyerDepositMultiplier);
                const depositAmount = priceDecimal * buyerMultiplier;
                totalDeposit += depositAmount;
                
                // 添加到有效商品列表
                validItemIds.push(itemId);
            } catch (error) {
                console.error(`检查商品${itemId}失败:`, error);
            }
        }
        
        // 如果包含自己的商品，给出明确警告
        if (selfOwnedItems.length > 0) {
            if (selfOwnedItems.length === itemIds.length) {
                return { 
                    success: false, 
                    transactionIds: null, 
                    message: '不能购买自己发布的商品' 
                };
            } else {
                console.warn(`已自动过滤掉您创建的商品：${selfOwnedItems.join(', ')}`);
            }
        }
        
        // 如果没有有效商品，返回错误
        if (validItemIds.length === 0) {
            return { 
                success: false, 
                transactionIds: null, 
                message: '没有有效的商品可以请求交易' 
            };
        }
        
        console.log("有效商品ID:", validItemIds);
        console.log("需要支付的总保证金(eCNY):", totalDeposit);
        
        // 将保证金转换为最小单位
        const depositBN = web3.utils.toBN(Math.round(totalDeposit * 1000000));
        const depositAmountStr = depositBN.toString();
        console.log("保证金金额(最小单位):", depositAmountStr);
        
        // 检查用户eCNY余额
        console.log("检查用户eCNY余额...");
        const tokenBalance = await getTokenBalance(sender);
        console.log("用户eCNY余额:", tokenBalance);
        
        if (web3.utils.toBN(tokenBalance).lt(depositBN)) {
            return { 
                success: false, 
                transactionIds: null, 
                message: `eCNY余额不足，需要${totalDeposit.toFixed(6)} eCNY作为保证金` 
            };
        }
        
        // 检查代币授权额度
        console.log("检查代币授权额度...");
        const allowance = await eCNY.value.methods.allowance(sender, marketContractsAddr.value).call();
        console.log("当前授权额度:", allowance, "需要:", depositAmountStr);
        
        if (web3.utils.toBN(allowance).lt(depositBN)) {
            console.log("授权额度不足，发起授权交易...");
            // 授权市场合约使用eCNY
            try {
                const approveResult = await eCNY.value.methods.approve(marketContractsAddr.value, depositAmountStr)
                    .send({ from: sender });
                console.log("授权交易完成:", approveResult);
            } catch (approveError) {
                console.error("授权失败:", approveError);
                return {
                    success: false,
                    transactionIds: null,
                    message: `代币授权失败: ${approveError.message || '未知错误'}`
                };
            }
        } else {
            console.log("授权额度充足，无需额外授权");
        }
        
        // 尝试估算gas用量
        console.log("开始发起批量请求交易...");
        let estimatedGas;
        try {
            estimatedGas = await market.value.methods.batchRequestTransactions(validItemIds)
                .estimateGas({ from: sender });
            console.log("估算的Gas用量:", estimatedGas);
            // 增加20%的gas余量
            estimatedGas = Math.floor(estimatedGas * 1.2);
        } catch (gasError) {
            console.error("Gas估算失败:", gasError);
            // 如果无法估算，使用默认值
            estimatedGas = 500000; // 批量操作需要更多gas
        }
        
        // 调用合约批量请求交易
        const result = await market.value.methods.batchRequestTransactions(validItemIds)
            .send({ 
                from: sender,
                gas: estimatedGas
            });
        
        console.log("批量请求交易完成:", result);
        
        // 从结果或事件中获取交易ID数组
        const events = result.events;
        let transactionIds = null;
        
        if (events.TransactionsBatchRequested) {
            transactionIds = events.TransactionsBatchRequested.returnValues.transactionIds;
            console.log("获取到的交易ID数组:", transactionIds);
        } else {
            console.warn("未从事件中获取到交易ID数组，尝试从交易计数器估算");
            // 尝试通过计数器估算交易ID
            const counter = await market.value.methods.transactionCounter().call();
            const lastTxId = parseInt(counter) - 1;
            transactionIds = [];
            for (let i = 0; i < validItemIds.length; i++) {
                transactionIds.push((lastTxId - validItemIds.length + i + 1).toString());
            }
            console.log("估算的交易ID数组:", transactionIds);
        }
        
        let successMessage = `成功请求${transactionIds.length}笔交易`;
        if (selfOwnedItems.length > 0) {
            successMessage += `（已自动跳过${selfOwnedItems.length}个您创建的商品）`;
        }
        
        return { 
            success: true, 
            transactionIds,
            message: successMessage 
        };
    } catch (error) {
        console.error("批量请求交易失败:", error);
        // 解析错误信息，提取合约抛出的具体错误
        let errorMessage = '批量请求交易失败';
        if (error.message) {
            // 检查是否包含特定的错误信息
            if (error.message.includes('Cannot be picked up by oneself')) {
                errorMessage = '不能购买自己发布的商品';
            } else {
                errorMessage = `批量请求交易失败: ${error.message}`;
            }
        }
        return { 
            success: false, 
            transactionIds: null,
            message: errorMessage
        };
    }
};

/**
 * 批量批准交易
 * @param {Array<string>} transactionIds - 交易ID数组
 * @returns {Promise<{success: boolean, message: string}>} - 返回结果
 */
export const batchApproveTransactions = async (transactionIds) => {
    try {
        console.log("开始执行批量批准交易函数");
        console.log("交易ID数组:", transactionIds);
        
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            return { success: false, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        console.log("发送者账户:", sender);
        
        // 验证交易ID，确保用户有权限批准
        const validTransactionIds = [];
        
        for (const txId of transactionIds) {
            try {
                // 获取交易详情
                const txDetails = await getTransactionDetails(txId);
                if (!txDetails) {
                    console.warn(`交易${txId}不存在，已跳过`);
                    continue;
                }
                
                // 获取商品信息，检查用户是否是商品创建者
                const itemId = txDetails.itemId;
                const item = await market.value.methods.items(itemId).call();
                
                if (item.creator.toLowerCase() !== sender.toLowerCase()) {
                    console.warn(`交易${txId}的商品创建者不是您，无权批准，已跳过`);
                    continue;
                }
                
                if (txDetails.status !== "0") {
                    console.warn(`交易${txId}的状态不是待处理，当前状态: ${txDetails.statusText}，已跳过`);
                    continue;
                }
                
                validTransactionIds.push(txId);
            } catch (error) {
                console.error(`检查交易${txId}失败:`, error);
            }
        }
        
        // 如果没有有效交易，返回错误
        if (validTransactionIds.length === 0) {
            return { 
                success: false, 
                message: '没有有效的交易可以批准' 
            };
        }
        
        console.log("有效交易ID:", validTransactionIds);
        
        // 尝试估算gas用量
        let estimatedGas;
        try {
            estimatedGas = await market.value.methods.batchApproveTransactions(validTransactionIds)
                .estimateGas({ from: sender });
            console.log("估算的Gas用量:", estimatedGas);
            // 增加20%的gas余量
            estimatedGas = Math.floor(estimatedGas * 1.2);
        } catch (gasError) {
            console.error("Gas估算失败:", gasError);
            // 如果无法估算，使用默认值
            estimatedGas = 500000; // 批量操作需要更多gas
        }
        
        // 批量批准交易
        const result = await market.value.methods.batchApproveTransactions(validTransactionIds)
            .send({ 
                from: sender, 
                gas: estimatedGas 
            });
        
        console.log("批量批准交易完成:", result);
        
        return { 
            success: true, 
            message: `成功批准${validTransactionIds.length}笔交易` 
        };
    } catch (error) {
        console.error("批量批准交易失败:", error);
        return { 
            success: false, 
            message: `批量批准交易失败: ${error.message || '未知错误'}` 
        };
    }
};

/**
 * 批量处理超时交易
 * @param {Array<string>} transactionIds - 交易ID数组
 * @returns {Promise<{success: boolean, message: string}>} - 返回结果
 */
export const batchHandleTimeoutTransactions = async (transactionIds) => {
    try {
        console.log("开始执行批量处理超时交易函数");
        console.log("交易ID数组:", transactionIds);
        
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            return { success: false, message: '未连接钱包，请先连接钱包' };
        }
        
        const sender = accounts[0];
        console.log("发送者账户:", sender);
        
        // 验证交易ID，确保已超时
        const validTransactionIds = [];
        const currentTime = Math.floor(Date.now() / 1000);
        
        for (const txId of transactionIds) {
            try {
                // 获取交易详情
                const txDetails = await getTransactionDetails(txId);
                if (!txDetails) {
                    console.warn(`交易${txId}不存在，已跳过`);
                    continue;
                }
                
                // 检查交易是否已超时
                if (currentTime <= txDetails.endTimeRaw) {
                    console.warn(`交易${txId}尚未超时，已跳过`);
                    continue;
                }
                
                if (txDetails.status !== "0" && txDetails.status !== "1") {
                    console.warn(`交易${txId}的状态不是待处理或已批准，当前状态: ${txDetails.statusText}，已跳过`);
                    continue;
                }
                
                validTransactionIds.push(txId);
            } catch (error) {
                console.error(`检查交易${txId}失败:`, error);
            }
        }
        
        // 如果没有有效交易，返回错误
        if (validTransactionIds.length === 0) {
            return { 
                success: false, 
                message: '没有有效的超时交易可以处理' 
            };
        }
        
        console.log("有效超时交易ID:", validTransactionIds);
        
        // 尝试估算gas用量
        let estimatedGas;
        try {
            estimatedGas = await market.value.methods.batchHandleTimeout(validTransactionIds)
                .estimateGas({ from: sender });
            console.log("估算的Gas用量:", estimatedGas);
            // 增加20%的gas余量
            estimatedGas = Math.floor(estimatedGas * 1.2);
        } catch (gasError) {
            console.error("Gas估算失败:", gasError);
            // 如果无法估算，使用默认值
            estimatedGas = 500000; // 批量操作需要更多gas
        }
        
        // 批量处理超时交易
        const result = await market.value.methods.batchHandleTimeout(validTransactionIds)
            .send({ 
                from: sender, 
                gas: estimatedGas 
            });
        
        console.log("批量处理超时交易完成:", result);
        
        return { 
            success: true, 
            message: `成功处理${validTransactionIds.length}笔超时交易` 
        };
    } catch (error) {
        console.error("批量处理超时交易失败:", error);
        return { 
            success: false, 
            message: `批量处理超时交易失败: ${error.message || '未知错误'}` 
        };
    }
};
