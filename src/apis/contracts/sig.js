import { ethers } from 'ethers';
import { contractsAddr } from './heyue2';
import { eCNY, eCNYContractsAddr } from './eCNY';
import { ToastFun } from "@/utils/toast.js";

export const signMessage = async (number) => {
    try {


        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner();

        const owner = await signer.getAddress();
        const spender = contractsAddr.value;
        const value = ethers.parseUnits(number.toString(), 18); // 18 表示单位是 wei
        const nonce = await eCNY.value.methods.nonces(owner).call();
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 一个小时后过期

        // Example data for EIP-712
        const domain = {
            name: 'MyToken',
            version: '1',
            chainId: 11155111, // Sepolia network id
            verifyingContract: eCNYContractsAddr.value,
        };

        const types = {
            Permit: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
            ],
        };

        const message = {
            owner,
            spender,
            value,
            nonce,
            deadline,
        };
        const sig = await signer.signTypedData(domain, types, message);
        const { v, r, s } = ethers.Signature.from(sig);
        const sigData = {
            owner,
            spender,
            value,
            deadline,
            v,
            r,
            s
        }
        return sigData
    } catch (error) {
        ToastFun("fail", { msg: "" });
    }
};