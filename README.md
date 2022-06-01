# Celo Marketplace Dapp


## Description
This is a marketplace where user can:
* lend parking Lots
* See products hosted on the Celo Blockchain
* rent parkingLots with cUSD and pay the lender a deposit
* end the rent and pay the remaining fees with cUSD to the lender
* lender is able to end the rent of a due parking Lot after 2 days of the agreed return time
* Add your own parking Lots to the dapp

## Live Demo
[Marketplace Dapp](https://farzeenkist.github.io/Parking-Dapp/)

## Usage

### Requirements
1. Install the [CeloExtensionWallet](https://chrome.google.com/webstore/detail/celoextensionwallet/kkilomkmpmkbdnfelcpgckmpcaemjcdh?hl=en) from the Google Chrome Store.
2. Create a wallet.
3. Go to [https://celo.org/developers/faucet](https://celo.org/developers/faucet) and get tokens for the alfajores testnet.
4. Switch to the Alfajores testnet in the CeloExtensionWallet.

### Test
1. Create a Parking Lot.
2. Create a second account in your extension wallet and send them cUSD tokens.
3. Rent current Lot with secondary account.
4. Check if balance of first account increased.
5. End rent on current Lot after due time but before the deadline.
6. End rent on due lot after additional time has been passed.


## Project Setup

### Install
```
npm install
```

### Start
```
npm run dev
```

### Build
```
npm run build
