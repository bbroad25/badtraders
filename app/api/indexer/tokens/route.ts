import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';
import { ethers } from 'ethers';
import { getProvider } from '@/lib/services/apiProviderManager';

export async function GET(request: NextRequest) {
  try {
    const result = await query(
      `SELECT
        token_address,
        symbol,
        decimals,
        created_at,
        updated_at,
        (SELECT COUNT(*) FROM trades WHERE token_address = tt.token_address) as trade_count
      FROM tracked_tokens tt
      ORDER BY created_at DESC`
    );

    return NextResponse.json({
      success: true,
      tokens: result.rows
    });
  } catch (error: any) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tokens',
        message: error?.message
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if admin mode is enabled
    if (process.env.ENABLE_ADMIN_MODE !== 'true') {
      return NextResponse.json(
        { error: 'Admin mode is not enabled' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { token_address, symbol, decimals } = body;

    // Validate required fields - only token_address is required
    if (!token_address) {
      return NextResponse.json(
        {
          error: 'Missing required field',
          message: 'token_address is required'
        },
        { status: 400 }
      );
    }

    // Validate token address format
    if (!ethers.isAddress(token_address)) {
      return NextResponse.json(
        {
          error: 'Invalid token address',
          message: 'Token address must be a valid Ethereum address'
        },
        { status: 400 }
      );
    }

    const tokenAddr = token_address.toLowerCase();

    // Auto-fetch symbol and decimals from contract if not provided
    let tokenSymbol = symbol;
    let tokenDecimals = decimals;

    try {
      const provider = await getProvider();
      if (provider) {
        // Standard ERC20 ABI for symbol and decimals
        const erc20Abi = [
          'function symbol() external view returns (string)',
          'function decimals() external view returns (uint8)'
        ];
        const tokenContract = new ethers.Contract(tokenAddr, erc20Abi, provider);

        // Fetch symbol if not provided
        if (!tokenSymbol) {
          try {
            tokenSymbol = await tokenContract.symbol();
          } catch (error: any) {
            console.warn(`Could not fetch symbol for ${tokenAddr}: ${error.message}`);
            tokenSymbol = 'UNKNOWN'; // Fallback
          }
        }

        // Fetch decimals if not provided
        if (!tokenDecimals) {
          try {
            tokenDecimals = Number(await tokenContract.decimals());
          } catch (error: any) {
            console.warn(`Could not fetch decimals for ${tokenAddr}: ${error.message}`);
            tokenDecimals = 18; // Default fallback
          }
        }
      } else {
        // No provider available, use defaults
        if (!tokenSymbol) tokenSymbol = 'UNKNOWN';
        if (!tokenDecimals) tokenDecimals = 18;
      }
    } catch (error: any) {
      console.error(`Error fetching token metadata for ${tokenAddr}:`, error.message);
      // Use provided values or defaults
      if (!tokenSymbol) tokenSymbol = symbol || 'UNKNOWN';
      if (!tokenDecimals) tokenDecimals = decimals || 18;
    }

    // Insert or update token
    await query(
      `INSERT INTO tracked_tokens (token_address, symbol, decimals, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (token_address)
       DO UPDATE SET
         symbol = EXCLUDED.symbol,
         decimals = EXCLUDED.decimals,
         updated_at = NOW()`,
      [tokenAddr, tokenSymbol, tokenDecimals]
    );

    return NextResponse.json({
      success: true,
      message: 'Token added successfully',
      token: {
        token_address: tokenAddr,
        symbol: tokenSymbol,
        decimals: tokenDecimals
      }
    });
  } catch (error: any) {
    console.error('Error adding token:', error);
    return NextResponse.json(
      {
        error: 'Failed to add token',
        message: error?.message
      },
      { status: 500 }
    );
  }
}

