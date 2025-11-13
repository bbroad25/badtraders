import { NextRequest, NextResponse } from 'next/server';
import { cleanupIneligibleUsers } from '@/lib/services/eligibilityCleanupService';

// Hardcoded admin FIDs (matches other admin routes)
const ADMIN_FIDS = [474867, 7212];

export async function POST(request: NextRequest) {
  try {
    // Get FID from query param or header
    const searchParams = request.nextUrl.searchParams;
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : null;

    if (!fid || !ADMIN_FIDS.includes(fid)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Get optional parameter for whether to remove from indexing
    const body = await request.json().catch(() => ({}));
    const removeFromIndexing = body.removeFromIndexing !== false; // Default to true

    console.log(`[Admin] Starting eligibility cleanup (FID: ${fid}, removeFromIndexing: ${removeFromIndexing})...`);

    // Run cleanup
    const result = await cleanupIneligibleUsers(removeFromIndexing);

    return NextResponse.json({
      success: true,
      result: {
        totalChecked: result.totalChecked,
        stillEligible: result.stillEligible,
        noLongerEligible: result.noLongerEligible,
        removedFromIndexing: result.removedFromIndexing,
        errors: result.errors,
        // Only return first 50 details to avoid huge response
        details: result.details.slice(0, 50)
      },
      message: `Checked ${result.totalChecked} users. ${result.noLongerEligible} no longer eligible. ${result.removedFromIndexing} removed from indexing.`
    });

  } catch (error: any) {
    console.error('Error in eligibility cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to run eligibility cleanup', message: error.message },
      { status: 500 }
    );
  }
}

