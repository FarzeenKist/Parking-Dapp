// SPDX-License-Identifier: GPL-3.0


pragma solidity ^0.8.4;

interface IERC20Token {
  function transfer(address, uint256) external returns (bool);
  function approve(address, uint256) external returns (bool);
  function transferFrom(address, address, uint256) external returns (bool);
  function totalSupply() external view returns (uint256);
  function balanceOf(address) external view returns (uint256);
  function allowance(address, address) external view returns (uint256);

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}



contract ParkingSpace {

    address internal cUsdTokenAddress = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;
    uint totalParkings;
    uint blacklistCount;

    // additional time given to renters to close their account with a rented lot
    uint additionalTime;


    address payable owner;

    // keeps track of the addresses that has been blacklisted
    address[] private blacklist;

    uint fee; 
    uint maxLotPerWallet;


    // this keeps tracks parking lots each wallet is renting
    mapping(address => uint) parkingLotsPerWallet;


    // integrate image, name, description to ipfs
    struct Lot {
        address payable lender;
        address payable renter;
        string image;
        // price is per day
        uint price;
        // deposit is a percentage
        uint deposit;
        uint returnDay;
        uint rentTime;
        string location;
        bool availability;
        string description;
    }

    mapping(uint => Lot) parkingLots;

    constructor() {
        totalParkings = 0;
        blacklistCount = 0;

        // this is initialized in seconds, it is 2 days time
        additionalTime = 172800;
        owner = payable(msg.sender);
        maxLotPerWallet = 10;
        fee = 1000000000000000000;
        

    }

    // checks if desired lot is available
    modifier isAvailable (uint _id) {
        require(parkingLots[_id].availability, "Parking lot is current unavailable!");
        _;
    }
    

    // this checks if the renting period of a lot is over
    // this modifier also gives a deadline of 2 days to the renter to close his account with the current lot
    modifier rentOver(uint _id) {
        require(block.timestamp > parkingLots[_id].returnDay + additionalTime && parkingLots[_id].availability, "Someone has already rented this lot!");
        _;
    }

    // checks if current wallet has already reached the limit of lots they can rent
    modifier lotLimit() {
        require(parkingLotsPerWallet[msg.sender] <= maxLotPerWallet, "You have reached the number of Lots you can rent");
        _;
    }


    // creates a parking lot
    function createLot(string memory _image, string memory _location, string memory _description, uint _price, uint _deposit) payable public lotLimit {
  
        //_deposit should be in percentage. Makes sure that _deposit is less or equal to 100%
        require(_deposit <= 100, "Deposit rate has to be equal or lower than 100%");

        // fee is paid
        require(
          IERC20Token(cUsdTokenAddress).transferFrom(
            msg.sender,
            owner,
            fee
          ),
          "Transfer failed."
        );

        uint returnDay = 0;
        uint rentTime = 0;
        //@notice Lot.renter is initialized in the same way as the lender
        parkingLots[totalParkings] = Lot(
            payable(msg.sender), 
            payable(msg.sender),
            _image,
            _price,
            _deposit,
            returnDay,
            rentTime,
            _location,
            true,
            _description
            );
        totalParkings++;
        parkingLotsPerWallet[msg.sender]++;

    }

    // Rents a selected Lot to the caller
    function rentLot(uint _id, uint _time) public payable isAvailable(_id) rentOver(_id) {
        // checks if current caller  is blacklisted.
        for(uint i = 0; i < blacklistCount;i++){
            require(blacklist[i] != msg.sender, "you are blacklisted from using the platform");
        }
        Lot storage currentLot = parkingLots[_id];
        require(msg.sender != currentLot.renter, "You are currently renting this apartment");
        // _time is in seconds so it is converted into days
        uint rentingTime = _time / 3600 / 24;
        // deposit is calculated bv the percentage set by lender multiplied by the total fee
        uint amount = parkingLots[_id].deposit / 100 * ( parkingLots[_id].price * rentingTime);
        
        // paying deposit
        require(
          IERC20Token(cUsdTokenAddress).transferFrom(
            msg.sender,
            parkingLots[_id].lender,
            amount
          ),
          "Transfer failed."
        );
   
        currentLot.renter = payable(msg.sender);
        currentLot.rentTime = _time;
        currentLot.returnDay = block.timestamp + _time;
        currentLot.availability = false;
    }


    // this function is used by the renter to end the rent and pay the remaining fees(if any) to the lender
    function endRent(uint _id) public payable {
        Lot storage currentLot = parkingLots[_id];
        require(currentLot.renter == msg.sender, "Only the renter can end the rent");
        require(block.timestamp <= currentLot.returnDay + additionalTime, "You have been blacklisted due to late return of lot");

        // if deposit is 100% then there is no need to pay the lender again
        if(currentLot.deposit < 100){
            uint rentingTime = ( block.timestamp - currentLot.returnDay)  / 3600 / 24;
            uint amount = (100 - parkingLots[_id].deposit) / 100 * ( parkingLots[_id].price * rentingTime);
            require(
          IERC20Token(cUsdTokenAddress).transferFrom(
            msg.sender,
            parkingLots[_id].lender,
            amount
          ),
          "Transfer failed."
        );
        }
        // Changes is made to the lot to make it available for renting again
        currentLot.returnDay = 0;
        currentLot.rentTime = 0;
        currentLot.renter = payable(currentLot.lender);
        currentLot.availability = true;

    }

    // thiis function is used by the lender in the situation that the renter hasn't return the lot after the deadline and additional time
    function endRentOnlyOwner(uint _id) public payable {
        Lot storage currentLot = parkingLots[_id];
        require(currentLot.lender == msg.sender, "Only lender can end the rent");
        require(block.timestamp > currentLot.returnDay + additionalTime, "There is still timeleft for renter to return the lot!");
        blacklistCount++;
        // renter is now blacklisted
        blacklist.push(currentLot.renter);
        currentLot.returnDay = 0;
        currentLot.rentTime = 0;
        currentLot.renter = payable(msg.sender);
        currentLot.availability = true;
    }

    function getLot(uint _id) public view returns(Lot memory){
        return parkingLots[_id];
    }

    function getParkingLotsLength() public view returns (uint){
        return totalParkings;
    }

    function getBlacklistCount() public view returns (uint) {
        return blacklistCount;
    }

    function getMaxLotPerWallet() public view returns (uint) {
        return maxLotPerWallet;
    }

    function getFees() public view returns (uint) {
        return fee;
    }

}