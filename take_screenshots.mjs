import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const dir = './docs/screenshots';
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
  }
  
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log("Waiting for app to be ready...");
  await new Promise(r => setTimeout(r, 5000));

  // 1. Login Page
  console.log("Taking Login screenshot...");
  await page.goto('http://localhost:5173/login');
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: `${dir}/login-page.png` });

  // Do Login
  console.log("Logging in...");
  await page.type('input[type="email"]', 'admin@xeno.com');
  await page.type('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // 2. Dashboard
  console.log("Taking Dashboard screenshot...");
  await new Promise(r => setTimeout(r, 5000)); // wait for animations and data
  await page.screenshot({ path: `${dir}/dashboard-page.png` });

  // 3. Customers
  console.log("Taking Customers screenshot...");
  await page.goto('http://localhost:5173/customers');
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: `${dir}/customers-page.png` });

  // 4. Segments
  console.log("Taking Segments screenshot...");
  await page.goto('http://localhost:5173/segments');
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: `${dir}/segments-page.png` });

  // 5. Campaigns
  console.log("Taking Campaigns screenshot...");
  await page.goto('http://localhost:5173/campaigns');
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: `${dir}/campaigns-page.png` });

  // 6. Analytics
  console.log("Taking Analytics screenshot...");
  await page.goto('http://localhost:5173/analytics');
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: `${dir}/analytics-page.png` });

  // 7. AI Copilot
  console.log("Taking AI Copilot screenshot...");
  await page.goto('http://localhost:5173/copilot');
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: `${dir}/ai-copilot-page.png` });

  await browser.close();
  console.log("Screenshots captured successfully!");
})();
