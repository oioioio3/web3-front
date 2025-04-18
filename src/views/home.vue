<script setup>
import { reactive, onMounted } from 'vue';
import { getBalanceApi } from '@/apis/contracts/web3';
import { initWeb, getBalanceOf } from '@/apis/contracts/eCNY';
onMounted(async () => {
  const balance = await getBalanceApi('0xD679224b4B2512A878Ef12386132e6A4d6e05dBb')
  console.log("用户的钱包余额" + balance);

  const accounts = await initWeb()
  console.log("用户的账户" + accounts[0]);

  const token = await getBalanceOf("0xD679224b4B2512A878Ef12386132e6A4d6e05dBb")
  console.log("用户的代币数量" + token);

  



})
</script>

<template>

</template>

<style scoped lang="scss"></style>