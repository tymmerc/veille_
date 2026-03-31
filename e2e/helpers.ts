import { Page } from "@playwright/test";

export const TEST_USER = {
  username: "e2e_testuser",
  email: "e2e_testuser@test.local",
  password: "testpass123",
};

/** Register test user via direct DB insert (bypasses rate limiting) */
export async function registerTestUserDirect() {
  const { execSync } = await import("child_process");
  try {
    execSync(
      `node -e "
const{PrismaClient}=require('@prisma/client');
const crypto=require('crypto');
const p=new PrismaClient();
function hashPw(pw){return new Promise((res,rej)=>{const salt=crypto.randomBytes(32).toString('hex');crypto.scrypt(pw,salt,64,(err,key)=>{if(err)rej(err);res(salt+':'+key.toString('hex'));});})}
(async()=>{
  await p.user.deleteMany({where:{email:'${TEST_USER.email}'}});
  const hash=await hashPw('${TEST_USER.password}');
  await p.user.create({data:{username:'${TEST_USER.username}',email:'${TEST_USER.email}',passwordHash:hash}});
  console.log('created');
  await p.\\$disconnect();
})();"`,
      { cwd: "/opt/veille-app", timeout: 10000 },
    );
  } catch (e) {
    // User may already exist, that's fine
  }
}

export async function registerUser(page: Page) {
  await registerTestUserDirect();
}

export async function loginUser(page: Page) {
  await page.goto("/veille/login");
  await page.waitForTimeout(500);
  // Make sure we're on the login tab (not register)
  const connexionTab = page.getByText("connexion", { exact: false }).first();
  if (await connexionTab.isVisible()) await connexionTab.click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder(/email/i).first().fill(TEST_USER.email);
  await page.locator('input[type="password"]').first().fill(TEST_USER.password);
  await page.getByText("se connecter", { exact: false }).click();
  // Wait for navigation away from login page
  await page.waitForFunction(() => !window.location.pathname.includes("/login"), { timeout: 30000 });
}

export async function ensureLoggedIn(page: Page) {
  // Make sure user exists
  await registerTestUserDirect();
  await loginUser(page);
}

export async function deleteTestUser() {
  const { execSync } = await import("child_process");
  try {
    execSync(
      `node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.deleteMany({where:{email:{startsWith:'e2e_'}}}).then(r=>{console.log('deleted',r.count);p.\\$disconnect();})"`,
      { cwd: "/opt/veille-app", timeout: 10000 },
    );
  } catch {
    // ignore
  }
}
