import Web3 from 'web3'
import { ref } from 'vue';
import web3 from './web3';
import marketContracts from "./abi/market.json";

export const market = ref(null);
export const marketContractsAddr = ref("0x2B6194190F672d986eF989F0f22aad99fB90C05a")
// 创建智能合约实例
market.value = new web3.eth.Contract(
    marketContracts.abi,
    marketContractsAddr.value
);


//账户修改
ethereum.on('accountsChanged', function (accounts) {
    console.log('accountsChanged', accounts[0]);
})

export const initWeb = async () => {
    try {
        const accounts = await web3.eth.requestAccounts();
        return accounts
    } catch (error) {
    }
}

export const getBalanceOf = async (account) => {
    const balance = await market.value.methods.balanceOf(account).call();
    return balance;
};
