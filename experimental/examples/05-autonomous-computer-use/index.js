import { AetherKernel } from '@aether-flow/core';

async function main() {
  console.log('🖥️ [Showcase 5]: Autonomous Computer Use & Browser Agent Automation\n');

  const kernel = new AetherKernel({ provider: 'mock' });

  console.log('1. Navigating to simulated web application: https://news.ycombinator.com ...');
  const session = await kernel.browser.navigate('https://news.ycombinator.com');

  console.log(`\nPage Title: ${session.pageTitle}`);
  console.log(`Current URL: ${session.currentUrl}`);
  console.log(`Indexed Interactive Elements: ${session.elements.length}`);
  
  if (session.elements.length > 0) {
    console.log('\nTop 3 Discovered Interactive DOM Elements:');
    session.elements.slice(0, 3).forEach((el, i) => {
      console.log(`  [${i + 1}] <${el.tag}> selector="${el.selector}" text="${el.text}"`);
    });
  }

  console.log('\n2. Executing simulated interaction: Click navigation link...');
  const action = await kernel.browser.act({
    type: 'click',
    target: session.elements[0]?.selector || 'a:nth-of-type(1)'
  });

  console.log('Action Output:', action);
  console.log(`Updated Action History Count: ${kernel.browser.getState().actionHistory.length}`);
}

main().catch(console.error);
