import { sendEmail } from "./src/lib/email";

async function main() {
  try {
    const fromAddress =
      process.env.AWS_SES_FROM_EMAIL || "kaleabdenbel1921@gmail.com";
    console.log("Sending email from:", fromAddress);
    const result = await sendEmail({
      to: "kaleabdenbel1921@gmail.com",
      subject: "Test SES Email",
      text: "This is a test email sent to verify AWS SES functionality.",
      html: "<p>This is a test email sent to verify AWS SES functionality.</p>",
    });
    console.log("Email sending result:", result);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

main();
