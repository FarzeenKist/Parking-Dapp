import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";
import BigNumber from "bignumber.js";
import parkingSpaceAbi from "../contracts/parkingSpace.abi.json";
import erc20Abi from "../contracts/erc20.abi.json";

const ERC20_DECIMALS = 18;
const PSContractAddress = "0x93DBd9921bEc726E9C122DE6B67e5bcc956025D2";
const cUSDContractAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";

let kit;
let contract;
let cUSDtoken;
let products = [];

// approves any transactions before any contract interaction
async function approve(_price) {
  const cUSDContract = new kit.web3.eth.Contract(erc20Abi, cUSDContractAddress);

  const result = await cUSDContract.methods
    .approve(PSContractAddress, _price)
    .send({ from: kit.defaultAccount });
  return result;
}

// retrieves the balance of the current wallet
const getBalance = async function () {
  const totalBalance = await kit.getTotalBalance(kit.defaultAccount);
  const cUSDBalance = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2);
  document.querySelector("#balance").textContent = cUSDBalance;
};

// retrieves the total number of people that have been blacklisted from the platform
const getBlackiListCount = async function () {
  const blackListCount = await contract.methods.getBlacklistCount().call();
  document.querySelector("#banned").textContent = blackListCount;
};

// checks if the celo wallet extension is installed, if it is, user is prompted to log in
const connectCeloWallet = async function () {
  if (window.celo) {
    notification("⚠️ Please approve this DApp to use it.");
    try {
      await window.celo.enable();
      notificationOff();

      const web3 = new Web3(window.celo);
      kit = newKitFromWeb3(web3);

      const accounts = await kit.web3.eth.getAccounts();
      kit.defaultAccount = accounts[0];

      contract = new kit.web3.eth.Contract(parkingSpaceAbi, PSContractAddress);
      cUSDtoken = await kit.contracts.getStableToken();
    } catch (error) {
      notification(`⚠️ ${error}.`);
    }
  } else {
    notification("⚠️ Please install the CeloExtensionWallet.");
  }
};

// retrieves all the products created from the smart contract
const getProducts = async function () {
  const _productsLength = await contract.methods.getParkingLotsLength().call();
  const _products = [];
  for (let i = 0; i < _productsLength; i++) {
    let _product = new Promise(async (resolve, reject) => {
      let p = await contract.methods.getLot(i).call();
      resolve({
        index: i,
        lender: p[0],
        renter: p[1],
        image: p[2],
        price: new BigNumber(p[3]),
        deposit: p[4],
        returnDay: p[5],
        rentTime: p[6],
        location: p[7],
        availability: p[8],
        description: p[9],
      });
    });
    _products.push(_product);
  }
  products = await Promise.all(_products);
  renderProducts();
};

// renders all the products that have been fetched
function renderProducts() {
  document.getElementById("marketplace").innerHTML = "";
  products.forEach((_product) => {
    const newDiv = document.createElement("div");
    newDiv.className = "col-md-4";
    newDiv.innerHTML = productTemplate(_product);
    document.getElementById("marketplace").appendChild(newDiv);
  });
}

// the structure of how each product should be displayed
function productTemplate(_product) {
  let d = new Date(0); // The 0 there is the key, which sets the date to the epoch
  d.setUTCSeconds(_product.returnDay);
  return `
     <div class="card mb-4">
       <img class="card-img-top" src="${_product.image}" alt="...">
       <div class="position-absolute top-0 end-0 bg-warning mt-4 px-2 py-1 rounded-start">
         ${_product.availability ? "Available to rent!" : `Rented till ${d}`} 
       </div>
       <div class="card-body text-left p-4 position-relative">
         <div class="translate-middle-y position-absolute top-0">
         ${identiconTemplate(_product.lender)}
         </div>
         <h2 class="card-title fs-4 fw-bold mt-2">${_product.location}</h2>
         <p class="card-text mb-2" style="min-height: 40px">
           ${_product.description}
         </p>
         <p class="card-text  text-muted">
           The deposit fee is ${_product.deposit}%
         </p>
         <div class="d-grid gap-2">
        
         <label for="days" class="form-label">Days to Rent(1 to 10 days)</label>
         <input type="range" class="form-range" min="1" max="10" name="days" id="days">
         <button type="button"  class="btn btn-outline-dark rentBtn fs-6 p-3" id=${
           _product.index
         } ${_product.availability ? "" : "disabled"}>
             Rent for ${_product.price
               .shiftedBy(-ERC20_DECIMALS)
               .toFixed(2)} cUSD / day
           </button>
          
           <form class="endRent-form">
           <button type="button" class="btn btn-lg endRentBtn btn-outline-danger fs-6 p-3" id=${
             _product.index
           } ${_product.availability ? "disabled" : ""}>
               End Rent
             </button>
             </form>
         </div>
       </div>
     </div>
   `;
}

// uses the wallet's address to generate an icon
function identiconTemplate(_address) {
  const icon = blockies
    .create({
      seed: _address,
      size: 8,
      scale: 16,
    })
    .toDataURL();

  return `
   <div class="rounded-circle overflow-hidden d-inline-block border border-white border-2 shadow-sm m-0">
     <a href="https://alfajores-blockscout.celo-testnet.org/address/${_address}/transactions"
         target="_blank">
         <img src="${icon}" width="48" alt="${_address}">
     </a>
   </div>
   `;
}

// displays a notification
function notification(_text) {
  document.querySelector(".alert").style.display = "block";
  document.querySelector("#notification").textContent = _text;
}

// removes the notification
function notificationOff() {
  document.querySelector(".alert").style.display = "none";
}

// all the fetching that happens when the page is loaded
window.addEventListener("load", async () => {
  notification("⌛ Loading...");
  await connectCeloWallet();
  await getBalance();
  await getProducts();
  await getBlackiListCount();
  notificationOff();
});

// verifies if user has already reached the limit of lot per wallet
document.querySelector("#add-modal", async (e) => {
  const maxLotPerWallet = await contract.methods.getMaxLotPerWallet().call();
  if (maxLotPerWallet > 10) {
    notification(
      "You have already reached the maximum Lot allowed per Parking sorry"
    );
  }
});

const addParkingForm = document.querySelector("#addParking");

// function to create the parking Lot onto the smart contract
addParkingForm.addEventListener("submit", async (e) => {
  e.stopPropagation();
  e.preventDefault();
  notification(`⌛ Adding new products!`);

  // promps user to approve the fees required to create a lot
  try {
    let fees = await contract.methods.getFees().call();
    fees = new BigNumber(fees);
    notification("Awaiting payment approval");
    console.log(fees);
    await approve(fees);
  } catch (e) {
    notification(`Error ${e}`);
  }

  // promps user to accept the creation of the Lot and fees is then paid here
  try {
    console.log("in try", e.target.location.value);

    const result = await contract.methods
      .createLot(
        e.target.image.value,
        e.target.location.value,
        e.target.description.value,
        new BigNumber(e.target.price.value)
          .shiftedBy(ERC20_DECIMALS)
          .toString(),
        e.target.deposit.value
      )
      .send({ from: kit.defaultAccount });
    notification(`🎉 You successfully added a new Parking Lot`);
    getProducts();
    getBalance();
    console.log("end of try");
  } catch (error) {
    notification(`⚠️ ${error}.`);
  }
});

// This is the event handler for renting and ending rent both by the renter and the lender
document.querySelector("#marketplace").addEventListener("click", async (e) => {
  // deals with renting the Lot to the current wallet
  if (e.target.className.includes("rentBtn")) {
    const index = e.target.id;

    // time is converted from days into seconds to pass it into the smart contract
    const time = document.querySelector("#days").value * 24 * 3600;
    console.log(products[index].deposit, index, time);

    // if deposit is required(greater than zero) then we need to promp user to accept to pay the necessary deposit fees
    if (products[index].deposit) {
      notification("⌛ Waiting for payment approval...");
      console.log("approval");

      // calculates the fees and then promps user to approve the transaction
      try {
        let rentingTime = time / 3600 / 24;
        // deposit is calculated bv the percentage set by lender multiplied by the total fee

        let price = products[index].price * rentingTime;
        console.log(price);
        let amount = new BigNumber((products[index].deposit / 100) * price);

        await approve(amount);
      } catch (error) {
        notification(`⚠️ ${error}.`);
      }
    }

    notification(`⌛ Awaiting payment for "${products[index].location}"...`);

    // promps user to confirm the transaction and rents the lot to the user
    try {
      const result = await contract.methods
        .rentLot(index, 180) //reset soon
        .send({ from: kit.defaultAccount });
      notification(`🎉 You successfully rented "${products[index].location}".`);
      getProducts();
      getBalance();
    } catch (error) {
      notification(`⚠️ ${error}.`);
    }
  }

  // block to deal with the renter ending his rent
  else if (e.target.className.includes("endRentBtn")) {
    const index = e.target.id;
    // checks if deposit is less than 100% since 100% would mean that all fees had already been paid
    // checks if the one ending the rent is the renter
    // checks if product is actually being rented
    if (
      products[index].deposit < 100 &&
      products[index].renter === kit.defaultAccount &&
      !products[index].availability
    ) {
      notification("⌛ Waiting for payment approval...");
      console.log("approval");

      // promps user to approve any necessary remaining fees
      try {
        console.log("ending rent");
        let rentingTime = products[index].rentTime / 3600 / 24;
        // deposit is calculated bv the percentage set by lender multiplied by the total fee

        let price = products[index].price * 1; // change after testing
        console.log(price);
        let amount = new BigNumber(
          ((100 - products[index].deposit) / 100) * price
        );
        await approve(amount);
      } catch (error) {
        notification(`⚠️ ${error}.`);
      }
      notification(`⌛ Awaiting payment for "${products[index].location}"...`);

      // ends rent and pays fees where applicable
      try {
        const result = await contract.methods
          .endRent(index)
          .send({ from: kit.defaultAccount });
        notification(
          `🎉 You successfully paid rent for "${products[index].location}".`
        );
        getProducts();
        getBalance();
      } catch (error) {
        notification(`⚠️ ${error}.`);
      }
    }

    // the only thing different here is that
    // it checks if it is the lender that is ending the due rent on one of his lot
    // since this block deals with the endRentOnlyOwner() from the smart contract
    else if (
      products[index].deposit < 100 && //change this to epoch time when u need to
      products[index].lender === kit.defaultAccount &&
      !products[index].availability
    ) {
      notification(
        `⌛ Ending Rent for "${products[index].location}" and banning Renter...`
      );

      // calls the endRentOnlyOwner and ends the rent on selected Lot
      try {
        await contract.methods
          .endRentOnlyOwner(index)
          .send({ from: kit.defaultAccount });
        notification("Successfully end the rent.");
        getProducts();
      } catch (e) {
        notification(`${e}`);
      }
    }
  }
});

// deals with verification that every field for creating a lot has been filled
(function () {
  "use strict";

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll(".needs-validation");

  // Loop over them and prevent submission
  Array.prototype.slice.call(forms).forEach(function (form) {
    form.addEventListener(
      "submit",
      function (event) {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }

        form.classList.add("was-validated");
      },
      false
    );
  });
})();
