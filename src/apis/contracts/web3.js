import Web3 from 'web3'

const web3 = new Web3(Web3.givenProvider || "wss://sepolia.infura.io/ws/v3/2a8940fa407142e9a4cd357bce1240f0");

export const getBalanceApi = async (address) => {
    const res = await web3.eth.getBalance(address);
    const amount = Web3.utils.fromWei(res, "ether");
    return amount;
}


export default web3;