/**
 * Migration script to backfill historical snapshot data for existing
 * inspection_rejection_history records that were created before the fix.
 * 
 * The fix in reviewWorkflow.js now includes `previousState` in the `responses` JSON column.
 * This script updates existing records by capturing the current state of their inspections
 * and adding it as previousState.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../src/config/db');
const logger = require('../src/utils/logger');

async function fixHistorySnapshots() {
  console.log('=== Starting History Snapshot Migration ===');
  
  await db.initialize();
  
  // Find all history records that don't have previousState in their responses JSON
  const records = await db.execute(
    `SELECT id, inspection_id, responses, actor_role, action_type, scope_type, rejection_date
     FROM inspection_rejection_history
     WHERE (responses IS NULL 
            OR responses = '' 
            OR JSON_EXTRACT(responses, '$.previousState') IS NULL)
       AND inspection_id IS NOT NULL
     ORDER BY inspection_id, rejection_date ASC`
  );
  
  console.log(`Found ${records.length} history records without previousState`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  
  for (const record of records) {
    try {
      const inspectionId = record.inspection_id;
      
      console.log(`Processing record ${record.id} for inspection ${inspectionId} (${record.actor_role} ${record.action_type})`);
      
      // Get inspection details
      const inspectionResult = await db.execute(
        `SELECT id, project_id, phase, status, approval_status, manager_approval_status, 
                reviewer_id, reviewer_notes, manager_id, manager_notes, 
                reviewed_at, manager_reviewed_at, created_at, updated_at
         FROM inspections WHERE id = ?`,
        [inspectionId]
      );
      
      if (inspectionResult.length === 0) {
        console.log(`  → Inspection ${inspectionId} not found, skipping`);
        skippedCount++;
        continue;
      }
      
      // Get checklist responses
      const responsesResult = await db.execute(
        `SELECT id, inspection_id, question_id, response_value, nc_type, 
                inspector_comment, additional_remarks, site_photos, domain_id, 
                sub_domain_id, editable_by_inspector, rejection_notes, rejected_at, rejected_by,
                submitted_by, submitted_at
         FROM checklist_responses WHERE inspection_id = ?`,
        [inspectionId]
      );
      
      // Get sub-domain submissions
      const submissionsResult = await db.execute(
        `SELECT id, inspection_id, sub_domain_id, domain_id, submitted_by, 
                submitted_at, is_rejected, rejected_at, rejected_by
         FROM inspection_subdomain_submissions WHERE inspection_id = ?`,
        [inspectionId]
      );
      
      // Parse existing responses JSON
      let existingResponses = record.responses;
      if (existingResponses && typeof existingResponses === 'string') {
        try {
          existingResponses = JSON.parse(existingResponses);
        } catch (e) {
          existingResponses = {};
        }
      } else if (!existingResponses) {
        existingResponses = {};
      }
      
      // Add previousState
      existingResponses.previousState = {
        inspection: inspectionResult[0] || null,
        responses: responsesResult || [],
        submissions: submissionsResult || [],
        captured_at: new Date().toISOString()
      };
      
      const updatedJson = JSON.stringify(existingResponses);
      
      await db.execute(
        `UPDATE inspection_rejection_history SET responses = ? WHERE id = ?`,
        [updatedJson, record.id]
      );
      
      console.log(`  → Updated with ${responsesResult.length} responses, ${submissionsResult.length} submissions`);
      updatedCount++;
    } catch (error) {
      console.error(`Error processing record ${record.id}:`, error.message);
      skippedCount++;
    }
  }
  
  console.log(`\n=== Migration Complete ===`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  
  await db.close();
  process.exit(0);
}

fixHistorySnapshots().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});