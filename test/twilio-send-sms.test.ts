import 'dotenv/config';
import { createDataSource, initializeDatabase } from '../src/config/database';
import { CommunicationLogService } from '../src/services/CommunicationLogService';
import { SystemSettingsService } from '../src/services/SystemSettingsService';
import { ContactService } from '../src/services/ContactService';
import Twilio from 'twilio';
import { env } from '../src/config/env';

/**
 * Standalone Twilio SMS Test
 *
 * WARNING: This test sends real SMS messages via Twilio, which costs money.
 * Only run this test manually when testing SMS functionality.
 *
 * Usage:
 *   npx ts-node test/twilio-send-sms.test.ts
 *
 * Before running:
 * 1. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env
 * 2. Update the TEST_PHONE_NUMBER to your test phone number (below)
 */

const TEST_PHONE_NUMBER = '+15551234567'; // Replace with your test phone number

async function runTwilioTest() {
  console.log('Starting Twilio SMS test...\n');

  try {
    // Initialize database
    console.log('Initializing database...');
    const dataSource = await createDataSource();
    await initializeDatabase(dataSource);
    console.log('✓ Database initialized\n');

    // Get services
    const settingsService = new SystemSettingsService(dataSource);
    const communicationLogService = new CommunicationLogService(dataSource, settingsService);
    const contactService = new ContactService(dataSource);

    // Get or create test user (user_id = 1)
    const userId = 1;

    // 1. Configure Twilio settings for user
    console.log('Configuring Twilio settings...');
    const twilioConfig = {
      accountSid: env.twilioAccountSid,
      authToken: env.twilioAuthToken,
      fromNumber: env.twilioFromNumber,
    };

    if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.fromNumber) {
      throw new Error('Twilio credentials not configured in .env');
    }

    await settingsService.setSetting('user', userId.toString(), 'twilio_config', twilioConfig);
    console.log('✓ Twilio config set\n');

    // 2. Create or find a test contact
    console.log('Creating test contact...');
    let testContact = await contactService.findByEmail('twilio-test@example.com', userId);

    if (!testContact) {
      testContact = await contactService.create({
        userId,
        firstName: 'SMS',
        lastName: 'Tester',
        primaryEmail: 'twilio-test@example.com',
        primaryPhone: TEST_PHONE_NUMBER,
      });
    }
    console.log(`✓ Test contact: ${testContact.first_name} ${testContact.last_name} (${testContact.id})\n`);

    // 3. Send test SMS via Twilio
    console.log('Sending test SMS...');
    const client = Twilio(twilioConfig.accountSid, twilioConfig.authToken);

    const message = await client.messages.create({
      body: 'Test message from Pi-CRM. If you received this, SMS logging is working!',
      from: twilioConfig.fromNumber,
      to: TEST_PHONE_NUMBER,
    });

    console.log(`✓ SMS sent successfully (SID: ${message.sid})\n`);

    // 4. Wait for message to be delivered
    console.log('Waiting 10 seconds for SMS delivery...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 5. Poll for messages
    console.log('Polling for SMS messages...');
    const pollResult = await communicationLogService.pollSMS(userId);
    console.log(`✓ Poll result: ${pollResult.success} messages logged, ${pollResult.errors.length} errors`);

    if (pollResult.errors.length > 0) {
      console.log('Errors:');
      pollResult.errors.forEach(err => console.log(`  - ${err}`));
    }
    console.log();

    // 6. Verify logs in database
    console.log('Verifying communication logs in database...');
    const logs = await communicationLogService.findByContact(testContact.id, userId);
    console.log(`✓ Found ${logs.length} communication logs for test contact\n`);

    logs.forEach((log, i) => {
      console.log(`Log ${i + 1}:`);
      console.log(`  Type: ${log.type}`);
      console.log(`  Timestamp: ${log.timestamp}`);
      const content = JSON.parse(log.content);
      console.log(`  Content: ${JSON.stringify(content, null, 2)}`);
    });

    console.log('\n✓ Twilio SMS test completed successfully!');
    console.log('\nNote: You may receive the test SMS on your phone shortly.');

    await dataSource.destroy();
  } catch (err) {
    console.error('✗ Test failed:', err);
    process.exit(1);
  }
}

runTwilioTest();
