# Eligibility Requirement Checker - Analysis Report

## Current Implementation Overview

### Threshold Values in Code
The codebase uses the following eligibility thresholds:

1. **Farcaster Users**: `1,000,000` tokens (1M)
   - Defined in multiple files as `FARCASTER_ELIGIBILITY_THRESHOLD = 1_000_000`

2. **Website Users**: `2,000,000` tokens (2M)
   - Defined as `WEBSITE_ELIGIBILITY_THRESHOLD = 2_000_000`

### Files with Threshold Definitions

1. **`app/api/token-balance/route.ts`** (Lines 6-7)
   - API endpoint that returns balance and eligibility status
   - Uses thresholds to determine `isEligible`

2. **`app/api/register/route.ts`** (Lines 5-6)
   - Registration endpoint that validates eligibility before allowing signup

3. **`app/page.tsx`** (Lines 11-12)
   - Main landing page component
   - Client-side eligibility calculation

4. **`app/leaderboard/page.tsx`** (Lines 12-13)
   - Leaderboard page with eligibility check

5. **`lib/services/eligibilityCleanupService.ts`** (Lines 8-9)
   - Service that cleans up users who drop below threshold

6. **`lib/services/tokenService.ts`** (Line 71)
   - Default threshold parameter in `checkEligibility()` function

## Issue Identified

### Discrepancy: UI Shows 1,080,000 but Code Uses 1,000,000

**From Screenshot Analysis:**
- UI displays: "ELIGIBILITY (HOLD >1,080,000)"
- Code uses: `1,000,000` for Farcaster users

**Potential Causes:**
1. Hardcoded value in UI component
2. Calculation error (1,000,000 * 1.08 = 1,080,000)
3. Stale cached value
4. Different threshold for a different feature

### Current Eligibility Logic Flow

```
1. User connects wallet or provides FID
2. System fetches token balance via Alchemy API
3. Determines threshold based on:
   - Has FID? → 1M threshold (Farcaster user)
   - No FID? → 2M threshold (Website user)
4. Calculates: isEligible = balance >= threshold
5. Displays status in UI
```

## Key Components

### 1. Balance Fetching (`lib/services/tokenService.ts`)
- Uses Alchemy API to query ERC-20 token balance
- Handles decimals conversion (defaults to 18)
- Returns balance as number (not wei)

### 2. Eligibility Check (`app/api/token-balance/route.ts`)
- FID-based lookup: Uses Neynar to get wallet addresses, then Alchemy for balance
- Address-based lookup: Direct Alchemy query
- Returns: `{ balance, isEligible, threshold, address, fid }`

### 3. UI Display (`components/leaderboard/MyStatus.tsx`)
- Receives `threshold` as prop
- Displays: "Eligibility (Hold >{threshold.toLocaleString()})"
- Shows "ELIGIBLE!" or "Not Eligible" based on `isEligible` prop

### 4. Registration Validation (`app/api/register/route.ts`)
- Checks eligibility before allowing registration
- Returns 403 error if not eligible
- Stores `eligibility_status` in database

## Potential Issues

### Issue 1: Threshold Mismatch
- **Location**: UI shows 1,080,000 but code uses 1,000,000
- **Impact**: Users might see incorrect requirement
- **Severity**: Medium (display issue, but logic is correct)

### Issue 2: Wallet Auto-Detection
- **From notification**: "should auto detect fc wallet"
- **Current behavior**: System tries to get wallet from Neynar API
- **Potential issue**: If Neynar fails or doesn't return wallet, balance check fails
- **Location**: `app/api/token-balance/route.ts` lines 29-52

### Issue 3: Cached Eligibility Status
- **From chat**: "I still show connected/eligible/registered" and "Without a fresh FC account, hard to test that"
- **Potential issue**: Once registered, eligibility status might be cached in database
- **Location**: `lib/services/userService.ts` - `registerUser()` stores `eligibility_status`
- **Impact**: If user drops below threshold, status might not update immediately

### Issue 4: Multiple Threshold Definitions
- **Issue**: Threshold constants are duplicated across multiple files
- **Risk**: If threshold changes, must update in 6+ places
- **Recommendation**: Centralize in a single config file

## Code Locations to Review

### Critical Files
1. `app/api/token-balance/route.ts` - Main eligibility check API
2. `components/leaderboard/MyStatus.tsx` - UI display component
3. `app/page.tsx` - Client-side eligibility calculation
4. `lib/services/tokenService.ts` - Balance fetching logic

### Related Files
1. `app/api/register/route.ts` - Registration validation
2. `lib/services/eligibilityCleanupService.ts` - Cleanup service
3. `lib/services/userService.ts` - User registration/update

## Recommendations

### Immediate Actions
1. **Search for 1,080,000**: Check if this value is hardcoded anywhere
2. **Verify threshold source**: Ensure UI uses the same threshold as API
3. **Check wallet detection**: Review Neynar integration for wallet auto-detection issues
4. **Test eligibility flow**: Verify with fresh Farcaster account

### Long-term Improvements
1. **Centralize thresholds**: Create single source of truth for eligibility thresholds
2. **Add logging**: Log threshold values used in eligibility checks
3. **Real-time updates**: Consider webhook or polling to update eligibility status when balance changes
4. **Error handling**: Improve error messages when wallet detection fails

## Testing Checklist

- [ ] Verify threshold displayed matches code (1M for Farcaster, 2M for website)
- [ ] Test with balance exactly at threshold (edge case)
- [ ] Test with balance just below threshold
- [ ] Test with balance just above threshold
- [ ] Test wallet auto-detection with fresh Farcaster account
- [ ] Test eligibility status updates when balance changes
- [ ] Verify registration blocks ineligible users
- [ ] Check cleanup service updates eligibility correctly

## Next Steps

1. Search codebase for any hardcoded "1,080,000" or "1080000" values
2. Review wallet detection logic in token-balance route
3. Check if there's any threshold calculation or buffer being applied
4. Verify database schema for eligibility_status field
5. Test with fresh Farcaster account as suggested in chat
