import Web3 from 'web3'
import { ref } from 'vue';
import web3 from './web3';
import eCNYContracts from "./abi/eCNY.json";

export const eCNY = ref(null);
export const eCNYContractsAddr = ref("0x6C419d9fC4C2Fa9C62235b602B2cA328035883F7")
// 创建智能合约实例
eCNY.value = new web3.eth.Contract(
    eCNYContracts.abi,
    eCNYContractsAddr.value
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
    const balance = await eCNY.value.methods.balanceOf(account).call();
    return balance;
};