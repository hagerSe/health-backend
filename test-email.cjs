const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTestEmail() {
    try {
        console.log('📧 Sending test email to agerneshdereje8@gmail.com...');
        
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: ['agerneshdereje8@gmail.com'],
            subject: '✅ NHMS Email Test - Working!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #2563eb;">🏥 NHMS Email System</h2>
                    <p>Your Resend API is configured correctly!</p>
                    <p>You can now send:</p>
                    <ul>
                        <li>✓ Verification emails</li>
                        <li>✓ Password reset emails</li>
                        <li>✓ Notifications</li>
                    </ul>
                    <hr>
                    <p style="color: #666; font-size: 12px;">National Health Management System</p>
                </div>
            `,
        });

        if (error) {
            console.error('❌ Error:', error);
        } else {
            console.log('✅ Email sent successfully!');
            console.log('📧 Check your inbox');
        }
    } catch (error) {
        console.error('❌ Failed:', error);
    }
}

sendTestEmail();