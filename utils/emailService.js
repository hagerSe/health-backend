import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Send verification email
export const sendVerificationEmail = async (email, name, verificationToken) => {
    try {
        const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;
        
        console.log(`📧 Sending verification email to: ${email}`);
        console.log(`🔗 Verification URL: ${verificationUrl}`);
        
        const { data, error } = await resend.emails.send({
            from: 'NHMS <onboarding@resend.dev>',
            to: [email],
            subject: 'Verify Your Email - NHMS',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #3b82f6, #1e3a8a); padding: 30px 20px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏥 NHMS</h1>
                            <p style="color: #bfdbfe; margin: 10px 0 0 0;">National Health Management System</p>
                        </div>
                        
                        <!-- Content -->
                        <div style="padding: 30px 20px;">
                            <h2 style="color: #1e3a8a; margin-top: 0;">Hello ${name}!</h2>
                            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">Thank you for registering with NHMS. Please verify your email address to complete your registration.</p>
                            
                            <!-- Big Verify Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${verificationUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">✅ Verify Email Address</a>
                            </div>
                            
                            <!-- Clickable Link as fallback -->
                            <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px; word-break: break-all;">
                                <p style="color: #4b5563; margin: 0 0 10px 0; font-size: 14px;">Or click this link:</p>
                                <a href="${verificationUrl}" style="color: #3b82f6; text-decoration: none; font-size: 14px;">${verificationUrl}</a>
                            </div>
                            
                            <div style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 5px;">
                                <p style="color: #92400e; margin: 0; font-size: 14px;">⏰ This verification link will expire in <strong>1 hour</strong>.</p>
                            </div>
                            
                            <hr style="margin: 30px 0 20px; border: none; border-top: 1px solid #e5e7eb;">
                            
                            <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you didn't create an account with NHMS, please ignore this email.</p>
                        </div>
                        
                        <!-- Footer -->
                        <div style="background-color: #f3f4f6; padding: 20px; text-align: center;">
                            <p style="color: #6b7280; font-size: 12px; margin: 0;">&copy; 2024 National Health Management System. All rights reserved.</p>
                            <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0;">Need help? Contact support@nhms.com</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('❌ Resend error:', error);
            return false;
        }
        
        console.log('✅ Verification email sent, ID:', data?.id);
        return true;
    } catch (error) {
        console.error('❌ Failed to send verification email:', error);
        return false;
    }
};

// Send password reset email
export const sendResetPasswordEmail = async (email, name, resetToken) => {
    try {
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
        
        console.log(`📧 Sending reset email to: ${email}`);
        console.log(`🔗 Reset URL: ${resetUrl}`);
        
        const { data, error } = await resend.emails.send({
            from: 'NHMS <onboarding@resend.dev>',
            to: [email],
            subject: 'Reset Your Password - NHMS',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #3b82f6, #1e3a8a); padding: 30px 20px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏥 NHMS</h1>
                            <p style="color: #bfdbfe; margin: 10px 0 0 0;">National Health Management System</p>
                        </div>
                        
                        <!-- Content -->
                        <div style="padding: 30px 20px;">
                            <h2 style="color: #1e3a8a; margin-top: 0;">Hello ${name}!</h2>
                            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">We received a request to reset your password. Click the button below to create a new password.</p>
                            
                            <!-- Big Reset Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">🔐 Reset Password</a>
                            </div>
                            
                            <!-- Clickable Link as fallback -->
                            <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px; word-break: break-all;">
                                <p style="color: #4b5563; margin: 0 0 10px 0; font-size: 14px;">Or click this link:</p>
                                <a href="${resetUrl}" style="color: #3b82f6; text-decoration: none; font-size: 14px;">${resetUrl}</a>
                            </div>
                            
                            <div style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 5px;">
                                <p style="color: #92400e; margin: 0; font-size: 14px;">⏰ This reset link will expire in <strong>1 hour</strong>.</p>
                            </div>
                            
                            <hr style="margin: 30px 0 20px; border: none; border-top: 1px solid #e5e7eb;">
                            
                            <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you didn't request this password reset, please ignore this email.</p>
                        </div>
                        
                        <!-- Footer -->
                        <div style="background-color: #f3f4f6; padding: 20px; text-align: center;">
                            <p style="color: #6b7280; font-size: 12px; margin: 0;">&copy; 2024 National Health Management System. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('❌ Resend error:', error);
            return false;
        }
        
        console.log('✅ Reset email sent, ID:', data?.id);
        return true;
    } catch (error) {
        console.error('❌ Failed to send reset email:', error);
        return false;
    }
};