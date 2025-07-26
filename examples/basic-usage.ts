import { Mailer } from '../src';

async function basicExample() {
  // Create a mailer instance
  const mailer = new Mailer({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-app-password',
    },
  });

  try {
    // Verify connection
    console.log('Verifying connection...');
    const isValid = await mailer.verify();
    console.log('Connection valid:', isValid);

    // Send a simple email
    console.log('Sending email...');
    const result = await mailer.send({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Hello from @oxog/mailer!',
      text: 'This is a test email sent using the @oxog/mailer package.',
      html: '<h1>Hello from @oxog/mailer!</h1><p>This is a test email sent using the <strong>@oxog/mailer</strong> package.</p>',
    });

    console.log('Email sent successfully:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    await mailer.close();
  }
}

async function multipleRecipientsExample() {
  const mailer = new Mailer({
    host: 'smtp.example.com',
    port: 587,
    auth: {
      user: 'user@example.com',
      pass: 'password',
    },
  });

  try {
    const result = await mailer.send({
      from: { name: 'Sender Name', address: 'sender@example.com' },
      to: [
        'recipient1@example.com',
        { name: 'Recipient Two', address: 'recipient2@example.com' },
      ],
      cc: 'cc@example.com',
      bcc: ['bcc1@example.com', 'bcc2@example.com'],
      subject: 'Multiple Recipients Test',
      text: 'This email was sent to multiple recipients.',
      priority: 'high',
      headers: {
        'X-Custom-Header': 'Custom Value',
      },
    });

    console.log('Email sent to multiple recipients:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mailer.close();
  }
}

async function factoryMethodsExample() {
  // Use built-in factory methods for common providers
  const gmailMailer = Mailer.createGmailClient('user@gmail.com', 'app-password');
  const outlookMailer = Mailer.createOutlookClient('user@outlook.com', 'password');
  const yahooMailer = Mailer.createYahooClient('user@yahoo.com', 'password');

  // OAuth2 examples
  const gmailOAuth = Mailer.createGmailOAuth2Client('user@gmail.com', 'access-token');
  const outlookOAuth = Mailer.createOutlookOAuth2Client('user@outlook.com', 'access-token');

  console.log('Created mailer instances using factory methods');

  // Remember to close connections when done
  await gmailMailer.close();
  await outlookMailer.close();
  await yahooMailer.close();
  await gmailOAuth.close();
  await outlookOAuth.close();
}

if (require.main === module) {
  console.log('=== Basic Example ===');
  basicExample()
    .then(() => {
      console.log('\n=== Multiple Recipients Example ===');
      return multipleRecipientsExample();
    })
    .then(() => {
      console.log('\n=== Factory Methods Example ===');
      return factoryMethodsExample();
    })
    .then(() => {
      console.log('\nAll examples completed!');
    })
    .catch((error) => {
      console.error('Example failed:', error);
    });
}