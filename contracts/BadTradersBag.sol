// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title BadTradersBag
 * @notice Parent NFT contract that can hold V1 and V2 Burn To Earn NFTs as children
 * @dev This is the "parent" NFT that collects and displays child NFTs from V1 and V2 contracts
 *
 * Features:
 * - ERC-7401 parent-child composability (cross-contract support)
 * - ERC-4906 metadata updates
 * - Upgradeable via UUPS proxy
 * - Can attach V1 and V2 NFTs as children
 * - Metadata reflects which children are attached
 */

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC4906.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BadTradersBag is Initializable, ERC721Upgradeable, OwnableUpgradeable, UUPSUpgradeable, IERC4906, ReentrancyGuardUpgradeable {
    // Storage variables - MUST NOT CHANGE ORDER for upgrade compatibility
    uint256 public nextTokenId;

    // BadTraders token contract and minimum balance requirement
    address public badTradersToken;
    uint256 public minimumBalance; // 5M tokens required

    // Allowed child contracts (V1 and V2 NFT contracts)
    mapping(address => bool) public allowedChildContracts;

    // Keeper access control (optional - if keepersRestricted is false, anyone can be a keeper)
    bool public keepersRestricted;
    mapping(address => bool) public keepers;

    // Mapping from token ID to whether it exists
    mapping(uint256 => bool) private _tokenExists;

    // Cross-contract child tracking: parentId => array of (childContract, childTokenId) pairs
    struct ChildInfo {
        address childContract;
        uint256 childTokenId;
    }
    mapping(uint256 => ChildInfo[]) private _children; // parentId => children array
    mapping(address => mapping(uint256 => uint256)) private _parent; // childContract => childTokenId => parentId
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) private _childIndex; // parentId => childContract => childTokenId => index

    // Mapping from token ID to metadata JSON
    mapping(uint256 => string) private _tokenMetadata;

    // Events
    event BadTradersBagMinted(
        address indexed to,
        uint256 indexed tokenId
    );

    event BadTradersBagRevoked(
        address indexed from,
        uint256 indexed tokenId,
        string reason
    );

    // Composable NFT events (ERC-7401)
    event ChildAttached(uint256 indexed parentId, address indexed childContract, uint256 indexed childTokenId);
    event ChildDetached(uint256 indexed parentId, address indexed childContract, uint256 indexed childTokenId);

    /**
     * @dev Initialize the contract (called by proxy)
     * @param _badTradersToken Address of the BadTraders ERC20 token
     * @param _minimumBalance Minimum token balance required (5M = 5_000_000 * 10^18)
     * @param _v1Contract Address of the V1 NFT contract
     * @param _v2Contract Address of the V2 NFT contract
     */
    function initialize(
        address _badTradersToken,
        uint256 _minimumBalance,
        address _v1Contract,
        address _v2Contract
    ) public initializer {
        __ERC721_init("BadTraders Bag", "BTBAG");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_badTradersToken != address(0), "Invalid token address");
        require(_minimumBalance > 0, "Minimum balance must be > 0");

        badTradersToken = _badTradersToken;
        minimumBalance = _minimumBalance;

        // By default, keepers are NOT restricted (anyone can call keeper functions)
        // Owner can enable restrictions later if desired
        keepersRestricted = false;

        // Set allowed child contracts
        if (_v1Contract != address(0)) {
            allowedChildContracts[_v1Contract] = true;
        }
        if (_v2Contract != address(0)) {
            allowedChildContracts[_v2Contract] = true;
        }

        nextTokenId = 1;
    }

    /**
     * @dev Add or remove allowed child contract (owner only)
     */
    function setAllowedChildContract(address _contract, bool _allowed) external onlyOwner {
        allowedChildContracts[_contract] = _allowed;
    }

    /**
     * @dev Enable/disable keeper restrictions (owner only)
     * @param _restricted If true, only whitelisted keepers can call keeper functions
     */
    function setKeepersRestricted(bool _restricted) external onlyOwner {
        keepersRestricted = _restricted;
    }

    /**
     * @dev Add or remove a keeper address (owner only)
     */
    function setKeeper(address _keeper, bool _allowed) external onlyOwner {
        keepers[_keeper] = _allowed;
    }

    /**
     * @dev Modifier to check if caller is allowed to perform keeper functions
     */
    modifier onlyKeeper() {
        if (keepersRestricted) {
            require(keepers[msg.sender], "Not an authorized keeper");
        }
        _;
    }

    /**
     * @dev Update minimum balance requirement (owner only)
     */
    function setMinimumBalance(uint256 _newMinimumBalance) external onlyOwner {
        require(_newMinimumBalance > 0, "Minimum balance must be > 0");
        minimumBalance = _newMinimumBalance;
    }

    /**
     * @dev Check if an address has enough tokens to hold an NFT
     */
    function canHoldNFT(address owner) external view returns (bool) {
        IERC20 token = IERC20(badTradersToken);
        return token.balanceOf(owner) >= minimumBalance;
    }

    /**
     * @dev Internal function to check and revoke a token if balance is too low
     * @param tokenId The token ID to check
     * @return revoked Whether the token was revoked
     */
    function _checkAndRevokeIfNeeded(uint256 tokenId) internal returns (bool) {
        if (!_tokenExists[tokenId]) {
            return false;
        }

        address owner = ownerOf(tokenId);
        IERC20 token = IERC20(badTradersToken);
        uint256 balance = token.balanceOf(owner);

        if (balance < minimumBalance) {
            // Detach all children first
            ChildInfo[] memory children = _children[tokenId];
            for (uint256 i = 0; i < children.length; i++) {
                delete _parent[children[i].childContract][children[i].childTokenId];
            }
            delete _children[tokenId];

            // Burn the NFT
            _burn(tokenId);
            _tokenExists[tokenId] = false;
            delete _tokenMetadata[tokenId];

            emit BadTradersBagRevoked(owner, tokenId, "Balance below minimum threshold");
            emit MetadataUpdate(tokenId);

            return true;
        }

        return false;
    }

    /**
     * @dev Mint a new parent NFT (free if you have >= 5M tokens)
     * @param to Address to mint to (must have >= minimumBalance tokens)
     */
    function mint(address to) external nonReentrant {
        // Check that recipient has enough tokens
        IERC20 token = IERC20(badTradersToken);
        uint256 balance = token.balanceOf(to);
        require(balance >= minimumBalance, "Insufficient token balance to mint");

        // Check that recipient doesn't already own one (optional - remove if you want multiple)
        // For now, allow multiple mints per address

        uint256 tokenId = nextTokenId;
        nextTokenId++;

        _mint(to, tokenId);
        _tokenExists[tokenId] = true;

        emit BadTradersBagMinted(to, tokenId);
    }

    /**
     * @dev Revoke (burn) an NFT if owner's balance drops below minimum
     * @param tokenId The token ID to check and potentially revoke
     * @return revoked Whether the NFT was revoked
     */
    function revokeIfBelowThreshold(uint256 tokenId) external nonReentrant returns (bool) {
        require(_tokenExists[tokenId], "Token doesn't exist");

        address owner = ownerOf(tokenId);

        // Check balance
        IERC20 token = IERC20(badTradersToken);
        uint256 balance = token.balanceOf(owner);

        if (balance < minimumBalance) {
            // Detach all children first
            ChildInfo[] memory children = _children[tokenId];
            for (uint256 i = 0; i < children.length; i++) {
                // Note: Children remain in their original contracts, just detached from parent
                delete _parent[children[i].childContract][children[i].childTokenId];
            }
            delete _children[tokenId];

            // Burn the NFT
            _burn(tokenId);
            _tokenExists[tokenId] = false;
            delete _tokenMetadata[tokenId];

            emit BadTradersBagRevoked(owner, tokenId, "Balance below minimum threshold");
            emit MetadataUpdate(tokenId);

            return true;
        }

        return false;
    }

    /**
     * @dev Batch check and revoke multiple tokens (keeper-friendly)
     * @param tokenIds Array of token IDs to check
     * @return revokedCount Number of tokens revoked
     */
    function batchRevokeIfBelowThreshold(uint256[] calldata tokenIds) external nonReentrant onlyKeeper returns (uint256) {
        uint256 revokedCount = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_checkAndRevokeIfNeeded(tokenIds[i])) {
                revokedCount++;
            }
        }

        return revokedCount;
    }

    /**
     * @dev Revoke all NFTs from an address that are below threshold
     * @param owner Address to check
     * @return count Number of NFTs revoked
     */
    function revokeAllBelowThreshold(address owner) external nonReentrant onlyKeeper returns (uint256) {
        IERC20 token = IERC20(badTradersToken);
        uint256 balance = token.balanceOf(owner);

        if (balance >= minimumBalance) {
            return 0; // Owner still has enough tokens
        }

        // Get all tokens owned by this address
        uint256 totalSupply = nextTokenId - 1;
        uint256[] memory tokensToRevoke = new uint256[](totalSupply);
        uint256 count = 0;

        for (uint256 i = 1; i <= totalSupply; i++) {
            if (_tokenExists[i] && ownerOf(i) == owner) {
                tokensToRevoke[count] = i;
                count++;
            }
        }

        // Revoke each token
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = tokensToRevoke[i];

            // Detach all children first
            ChildInfo[] memory children = _children[tokenId];
            for (uint256 j = 0; j < children.length; j++) {
                delete _parent[children[j].childContract][children[j].childTokenId];
            }
            delete _children[tokenId];

            // Burn the NFT
            _burn(tokenId);
            _tokenExists[tokenId] = false;
            delete _tokenMetadata[tokenId];

            emit BadTradersBagRevoked(owner, tokenId, "Balance below minimum threshold");
            emit MetadataUpdate(tokenId);
        }

        return count;
    }

    /**
     * @dev Override transfer to check balance before allowing transfer and auto-revoke if needed
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // If transferring from an existing owner, check if they still have enough tokens
        // This will auto-revoke if balance dropped below threshold
        if (from != address(0)) {
            _checkAndRevokeIfNeeded(tokenId);
        }

        // If token was revoked, the transfer won't proceed (token no longer exists)
        if (!_tokenExists[tokenId]) {
            revert("Token was revoked due to insufficient balance");
        }

        // If transferring (not minting), check recipient has enough tokens
        if (from != address(0) && to != address(0)) {
            IERC20 token = IERC20(badTradersToken);
            uint256 balance = token.balanceOf(to);
            require(balance >= minimumBalance, "Recipient must have minimum token balance");
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev EIP-7401: Attach a child NFT from another contract to a parent
     * @param parentId The parent NFT token ID
     * @param childContract Address of the child NFT contract (V1 or V2)
     * @param childTokenId The child NFT token ID to attach
     */
    function attachChild(
        uint256 parentId,
        address childContract,
        uint256 childTokenId
    ) external nonReentrant {
        // Auto-revoke if owner's balance is too low
        _checkAndRevokeIfNeeded(parentId);

        require(_tokenExists[parentId], "Parent doesn't exist");
        require(allowedChildContracts[childContract], "Child contract not allowed");
        require(ownerOf(parentId) == msg.sender, "Not parent owner");

        // Check child exists and is owned by sender
        IERC721 childNFT = IERC721(childContract);
        require(childNFT.ownerOf(childTokenId) == msg.sender, "Not child owner");
        require(_parent[childContract][childTokenId] == 0, "Child already attached");
        require(parentId != childTokenId || childContract != address(this), "Cannot attach to self");

        // Attach the child
        _children[parentId].push(ChildInfo({
            childContract: childContract,
            childTokenId: childTokenId
        }));
        _parent[childContract][childTokenId] = parentId;
        _childIndex[parentId][childContract][childTokenId] = _children[parentId].length;

        // Emit composable event
        emit ChildAttached(parentId, childContract, childTokenId);

        // Emit metadata update so the parent's appearance can update
        emit MetadataUpdate(parentId);
    }

    /**
     * @dev EIP-7401: Detach a child NFT from a parent
     * @param parentId The parent NFT token ID
     * @param childContract Address of the child NFT contract
     * @param childTokenId The child NFT token ID to detach
     */
    function detachChild(
        uint256 parentId,
        address childContract,
        uint256 childTokenId
    ) external nonReentrant {
        // Auto-revoke if owner's balance is too low
        _checkAndRevokeIfNeeded(parentId);

        require(_tokenExists[parentId], "Parent doesn't exist");
        require(ownerOf(parentId) == msg.sender, "Not parent owner");
        require(_parent[childContract][childTokenId] == parentId, "Child not attached to this parent");
        require(_childIndex[parentId][childContract][childTokenId] != 0, "Child not found");

        // Find and remove from array
        uint256 index = _childIndex[parentId][childContract][childTokenId] - 1;
        uint256 lastIndex = _children[parentId].length - 1;

        if (index != lastIndex) {
            ChildInfo memory lastChild = _children[parentId][lastIndex];
            _children[parentId][index] = lastChild;
            _childIndex[parentId][lastChild.childContract][lastChild.childTokenId] = index + 1;
        }

        _children[parentId].pop();
        delete _parent[childContract][childTokenId];
        delete _childIndex[parentId][childContract][childTokenId];

        // Emit composable event
        emit ChildDetached(parentId, childContract, childTokenId);

        // Emit metadata update so the parent's appearance can update
        emit MetadataUpdate(parentId);
    }

    /**
     * @dev Get all children of a parent NFT
     * @param parentId The parent NFT token ID
     * @return Array of child contract addresses and token IDs
     */
    function getChildren(uint256 parentId) external view returns (ChildInfo[] memory) {
        return _children[parentId];
    }

    /**
     * @dev Get the parent of a child NFT
     * @param childContract Address of the child NFT contract
     * @param childTokenId The child NFT token ID
     * @return The parent token ID (0 if none)
     */
    function getParent(address childContract, uint256 childTokenId) external view returns (uint256) {
        return _parent[childContract][childTokenId];
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
     * @dev Get token URI with metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_tokenExists[tokenId], "Token does not exist");

        // Return stored metadata if available
        string memory metadata = _tokenMetadata[tokenId];
        if (bytes(metadata).length > 0) {
            return metadata;
        }

        // Generate metadata based on attached children
        ChildInfo[] memory children = _children[tokenId];
        uint256 v1Count = 0;
        uint256 v2Count = 0;

        for (uint256 i = 0; i < children.length; i++) {
            // Count V1 and V2 children (you can check contract addresses or add version tracking)
            // For now, we'll just count total children
        }

        // Build attributes array
        string memory attributes = string(abi.encodePacked(
            '[',
            '{"trait_type":"Type","value":"BadTraders Bag Parent NFT"},',
            '{"trait_type":"Children Count","value":',
            _toString(children.length),
            '}'
        ));

        // Add child details if any
        if (children.length > 0) {
            attributes = string(abi.encodePacked(attributes, ',{"trait_type":"Has Children","value":"Yes"}'));
        } else {
            attributes = string(abi.encodePacked(attributes, ',{"trait_type":"Has Children","value":"No"}'));
        }

        attributes = string(abi.encodePacked(attributes, ']'));

        return string(abi.encodePacked(
            '{"name":"BadTraders Bag #',
            _toString(tokenId),
            '","description":"BadTraders Bag parent NFT that can hold V1 and V2 Burn To Earn NFTs","image":"',
            _getDefaultImage(),
            '","attributes":',
            attributes,
            '}'
        ));
    }

    /**
     * @dev Get default image (IPFS URL for Bag NFT image)
     */
    function _getDefaultImage() internal pure returns (string memory) {
        return "ipfs://QmXstpY8TGKLk1di5W7jNXQuuiFzEXYfTtHsMarY2NEDcz";
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
     * @dev Required by UUPSUpgradeable - authorizes upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

