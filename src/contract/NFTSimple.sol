// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract NFTSimple {

    error ERC721InvalidOwner(address owner);
    error ERC721InvalidReceiver(address receiver);
    error ERC721InvalidSender(address sender);
    error ERC721NonexistentToken(uint256 tokenId);
    
    event mint(address indexed to, uint256 indexed tokenId);

    using Strings for uint256;

    address public owner;

    mapping(uint256 => string) public tokenURIs; // IPFS元数据

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    // Token name
    string private _name;

    // Token symbol
    string private _symbol;

    mapping(uint256 tokenId => address) private _owners;

    mapping(address owner => uint256) private _balances;

    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
     */
    constructor(address _owner) {
        owner = _owner;
        _name = "MarketplaceNFT";
        _symbol = "MNFT";
    }

    /**
     * @dev See {IERC721-balanceOf}.
     */
    function balanceOf(address _owner) public view virtual returns (uint256) {
        if (_owner == address(0)) {
            revert ERC721InvalidOwner(address(0));
        }
        return _balances[_owner];
    }

    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view virtual returns (address) {
        return _requireOwned(tokenId);
    }

    /**
     * @dev See {IERC721Metadata-name}.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @dev See {IERC721Metadata-symbol}.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    function tokenURI(uint256 tokenId) public view virtual returns (string memory) {
        return tokenURIs[tokenId];
    }

    /**
     * @dev Returns the owner of the `tokenId`. Does NOT revert if token doesn't exist
     *
     * IMPORTANT: Any overrides to this function that add ownership of tokens not tracked by the
     * core ERC-721 logic MUST be matched with the use of {_increaseBalance} to keep balances
     * consistent with ownership. The invariant to preserve is that for any address `a` the value returned by
     * `balanceOf(a)` must be equal to the number of tokens such that `_ownerOf(tokenId)` is `a`.
     */
    function _ownerOf(uint256 tokenId) internal view virtual returns (address) {
        return _owners[tokenId];
    }

    /**
     * @dev Transfers `tokenId` from its current owner to `to`, or alternatively mints (or burns) if the current owner
     * (or `to`) is the zero address. Returns the owner of the `tokenId` before the update.
     *
     * The `auth` argument is optional. If the value passed is non 0, then this function will check that
     * `auth` is either the owner of the token, or approved to operate on the token (by the owner).
     *
     * Emits a {Transfer} event.
     *
     * NOTE: If overriding this function in a way that tracks balances, see also {_increaseBalance}.
     */
    function _update(address to, uint256 tokenId) internal virtual returns (address) {

        address from = _ownerOf(tokenId);

        if (from != address(0)) {
            unchecked {
                _balances[from] -= 1;
            }
        }

        if (to != address(0)) {
            unchecked {
                _balances[to] += 1;
            }
        }
        _owners[tokenId] = to;

        return from;
    }

    function createNFT(address to, uint256 tokenId, string memory ipfsHash) internal {
        tokenURIs[tokenId] = ipfsHash;
        _mint(to, tokenId);
    }
    /**
     * @dev Mints `tokenId` and transfers it to `to`.
     *
     * WARNING: Usage of this method is discouraged, use {_safeMint} whenever possible
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - `to` cannot be the zero address.
     *
     * Emits a {Transfer} event.
     */
    function _mint(address to, uint256 tokenId) internal {
        if (to == address(0)) {
            revert ERC721InvalidReceiver(address(0));
        }
        address previousOwner = _update(to, tokenId);
        if (previousOwner != address(0)) {
            revert ERC721InvalidSender(address(0));
        }
        emit mint(to, tokenId);
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     * This is an internal function that does not check if the sender is authorized to operate on the token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function _burn(uint256 tokenId) internal {
        address previousOwner = _update(address(0), tokenId);
        if (previousOwner == address(0)) {
            revert ERC721NonexistentToken(tokenId);
        }
    }


    /**
     * @dev Reverts if the `tokenId` doesn't have a current owner (it hasn't been minted, or it has been burned).
     * Returns the owner.
     *
     * Overrides to ownership logic should be done to {_ownerOf}.
     */
    function _requireOwned(uint256 tokenId) internal view returns (address) {
        address _owner = _ownerOf(tokenId);
        if (_owner == address(0)) {
            revert ERC721NonexistentToken(tokenId);
        }
        return _owner;
    }
}