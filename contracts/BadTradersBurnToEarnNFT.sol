// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC4906.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract BadTradersBurnToEarnNFTV1 is Initializable, ERC721Upgradeable, OwnableUpgradeable, UUPSUpgradeable, IERC4906, ReentrancyGuardUpgradeable {
    // Storage variables - MUST NOT CHANGE ORDER for upgrade compatibility
    uint256 public nextTokenId;
    address public badTradersToken; // ERC20 token address to burn
    uint256 public burnAmount; // Amount of tokens to burn (1M = 1_000_000 * 10^18)
    uint256 public maxSupply; // Maximum number of NFTs that can be minted (100 for V1)

    // Mapping from token ID to IPFS image URL
    mapping(uint256 => string) private _tokenImageUrl;
    // Mapping from token ID to whether it exists
    mapping(uint256 => bool) private _tokenExists;
    // Mapping from token ID to full metadata JSON (with traits, attributes, etc.)
    mapping(uint256 => string) private _tokenMetadata;

    // EIP-7401 Composable NFTs: Parent/Child relationships
    mapping(uint256 => uint256[]) private _children; // parentId => childIds
    mapping(uint256 => uint256) private _parent; // childId => parentId
    mapping(uint256 => mapping(uint256 => uint256)) private _childIndex; // parentId => childId => index in parent's children array

    // Events
    event BadTradersBurnToEarnNFTV1Minted(
        address indexed to,
        uint256 indexed tokenId,
        string imageUrl,
        uint256 tokensBurned
    );

    // Composable NFT events
    event ChildAttached(uint256 indexed parentId, uint256 indexed childId);
    event ChildDetached(uint256 indexed parentId, uint256 indexed childId);

    /**
     * @dev Initialize the contract (called by proxy)
     * @param _badTradersToken Address of the BadTraders ERC20 token
     * @param _burnAmount Amount of tokens to burn (in token's smallest unit, e.g., 1_000_000 * 10^18)
     * @param _maxSupply Maximum number of NFTs that can be minted (100 for V1)
     */
    function initialize(
        address _badTradersToken,
        uint256 _burnAmount,
        uint256 _maxSupply
    ) public initializer {
        __ERC721_init("BadTraders Burn To Earn NFT V1", "BTB2E");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_badTradersToken != address(0), "Invalid token address");
        require(_burnAmount > 0, "Burn amount must be > 0");
        require(_maxSupply > 0, "Max supply must be > 0");

        badTradersToken = _badTradersToken;
        burnAmount = _burnAmount;
        maxSupply = _maxSupply;
        nextTokenId = 1;
    }

    /**
     * @dev Mint a new NFT by burning BadTraders tokens
     * @param imageUrl IPFS URL to the NFT image
     * @param metadataJSON Full JSON metadata with traits and attributes
     */
    function mint(string memory imageUrl, string memory metadataJSON) external nonReentrant {
        // Check max supply limit
        require(nextTokenId <= maxSupply, "Max supply reached");

        // Check that user has approved this contract to spend tokens
        IERC20 token = IERC20(badTradersToken);
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(allowance >= burnAmount, "Insufficient token allowance");

        // Check that user has enough tokens
        uint256 balance = token.balanceOf(msg.sender);
        require(balance >= burnAmount, "Insufficient token balance");

        // Transfer tokens from user to this contract
        require(token.transferFrom(msg.sender, address(this), burnAmount), "Token transfer failed");

        // Burn the tokens by sending them to address(0)
        require(token.transfer(address(0), burnAmount), "Token burn failed");

        // Mint the NFT
        uint256 tokenId = nextTokenId;
        nextTokenId++;

        _mint(msg.sender, tokenId);

        // Store IPFS image URL, metadata, and mark as existing
        _tokenImageUrl[tokenId] = imageUrl;
        _tokenMetadata[tokenId] = metadataJSON;
        _tokenExists[tokenId] = true;

        emit BadTradersBurnToEarnNFTV1Minted(msg.sender, tokenId, imageUrl, burnAmount);
    }

    /**
     * @dev Get token URI with metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_tokenExists[tokenId], "Token does not exist");

        // Return stored metadata if available, otherwise generate basic
        string memory metadata = _tokenMetadata[tokenId];
        if (bytes(metadata).length > 0) {
            return metadata;
        }

        // Fallback: generate basic metadata
        string memory imageUrl = _tokenImageUrl[tokenId];
        return string(abi.encodePacked(
            '{"name":"BadTraders Burn To Earn NFT V1 #',
            _toString(tokenId),
            '","description":"BadTraders Burn To Earn NFT V1 minted by burning tokens","image":"',
            imageUrl,
            '","attributes":[{"trait_type":"Type","value":"BadTraders Burn To Earn NFT V1"},{"trait_type":"Series","value":"V1"},{"trait_type":"Token ID","value":',
            _toString(tokenId),
            '}]}'
        ));
    }

    /**
     * @dev Get total supply
     */
    function totalSupply() external view returns (uint256) {
        return nextTokenId - 1;
    }

    /**
     * @dev Convert uint256 to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @dev Update burn amount (owner only)
     */
    function setBurnAmount(uint256 _newBurnAmount) external onlyOwner {
        require(_newBurnAmount > 0, "Burn amount must be > 0");
        burnAmount = _newBurnAmount;
    }

    /**
     * @dev Get remaining supply (owner only, for informational purposes)
     */
    function getRemainingSupply() external view returns (uint256) {
        if (nextTokenId > maxSupply) {
            return 0;
        }
        return maxSupply - (nextTokenId - 1);
    }

    /**
     * @dev EIP-7401: Attach a child NFT to a parent
     * @param parentId The parent NFT token ID
     * @param childId The child NFT token ID to attach
     */
    function attachChild(uint256 parentId, uint256 childId) external {
        require(_tokenExists[parentId], "Parent doesn't exist");
        require(_tokenExists[childId], "Child doesn't exist");
        require(ownerOf(parentId) == msg.sender, "Not parent owner");
        require(ownerOf(childId) == msg.sender, "Not child owner");
        require(_parent[childId] == 0, "Child already attached");
        require(parentId != childId, "Cannot attach to self");

        // Attach the child
        _children[parentId].push(childId);
        _parent[childId] = parentId;
        _childIndex[parentId][childId] = _children[parentId].length;

        // Emit composable event
        emit ChildAttached(parentId, childId);

        // Emit metadata update so the parent's appearance can update
        emit MetadataUpdate(parentId);
    }

    /**
     * @dev EIP-7401: Detach a child NFT from a parent
     * @param parentId The parent NFT token ID
     * @param childId The child NFT token ID to detach
     */
    function detachChild(uint256 parentId, uint256 childId) external {
        require(ownerOf(parentId) == msg.sender, "Not parent owner");
        require(_parent[childId] == parentId, "Child not attached to this parent");
        require(_childIndex[parentId][childId] != 0, "Child not found");

        // Find and remove from array
        uint256 index = _childIndex[parentId][childId] - 1;
        uint256 lastIndex = _children[parentId].length - 1;

        if (index != lastIndex) {
            uint256 lastChildId = _children[parentId][lastIndex];
            _children[parentId][index] = lastChildId;
            _childIndex[parentId][lastChildId] = index + 1;
        }

        _children[parentId].pop();
        delete _parent[childId];
        delete _childIndex[parentId][childId];

        // Emit composable event
        emit ChildDetached(parentId, childId);

        // Emit metadata update so the parent's appearance can update
        emit MetadataUpdate(parentId);
    }

    /**
     * @dev Get all children of a parent NFT
     * @param parentId The parent NFT token ID
     * @return Array of child token IDs
     */
    function getChildren(uint256 parentId) external view returns (uint256[] memory) {
        return _children[parentId];
    }

    /**
     * @dev Get the parent of a child NFT
     * @param childId The child NFT token ID
     * @return The parent token ID (0 if none)
     */
    function getParent(uint256 childId) external view returns (uint256) {
        return _parent[childId];
    }

    /**
     * @dev Get the number of children attached to a parent
     * @param parentId The parent NFT token ID
     * @return Number of children
     */
    function getChildrenCount(uint256 parentId) external view returns (uint256) {
        return _children[parentId].length;
    }

    /**
     * @dev Update metadata for a token (emits MetadataUpdate event)
     * @param tokenId The token ID to update
     * @param newMetadata New metadata JSON string
     */
    function updateMetadata(uint256 tokenId, string memory newMetadata) external onlyOwner {
        require(_tokenExists[tokenId], "Token doesn't exist");
        _tokenMetadata[tokenId] = newMetadata;
        emit MetadataUpdate(tokenId);
    }

    /**
     * @dev Required by UUPSUpgradeable - authorizes upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

