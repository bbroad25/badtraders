// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestBadTradersToken
 * @notice Mock ERC20 token for testing BadTraders NFT contracts on testnet
 * @dev This is a simple ERC20 token that can be minted for testing purposes
 */
contract TestBadTradersToken is ERC20 {
    address public owner;

    constructor() ERC20("Test BadTraders Token", "TBT") {
        owner = msg.sender;
        // Mint initial supply to deployer for testing (1 billion tokens)
        _mint(msg.sender, 1_000_000_000 * 10**18);
    }

    /**
     * @dev Mint tokens to a specific address (owner only, for testing)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (in wei)
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "Only owner can mint");
        _mint(to, amount);
    }

    /**
     * @dev Mint tokens to caller (public, for easy testing)
     * @param amount Amount of tokens to mint (in wei)
     */
    function mintForSelf(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}

