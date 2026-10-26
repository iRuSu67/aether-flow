import { AetherKernel } from '@aether-flow/core';

async function main() {
  console.log('📚 [Showcase 7]: Voyager-Style Continuous Skill Library Learning\n');

  const kernel = new AetherKernel({ provider: 'mock' });

  console.log('1. Synthesizing new mathematical skill: "black_scholes_option_pricer"...');
  const synth = await kernel.synthesizeTool({
    toolName: 'black_scholes_option_pricer',
    purpose: 'Calculate European call and put option Greeks',
    inputSpecification: [{ name: 'spot', type: 'number', description: 'Underlying asset price' }],
    expectedOutput: 'Option price and Delta/Gamma sensitivities'
  });

  console.log(`✔ Tool Synthesized: ${synth.tool?.name}`);
  console.log(`Stored in Permanent Skill Library: ${kernel.skills.size()} active skill(s)\n`);

  console.log('2. Querying Skill Library using semantic vector similarity for: "financial derivative valuation"...');
  const retrievedSkills = kernel.skills.findSkills('financial derivative valuation', 2);

  console.log(`✔ Found ${retrievedSkills.length} matching learned skill(s):`);
  retrievedSkills.forEach(s => {
    console.log(`  • [Skill: ${s.name}] Description: "${s.description}" (Tags: ${s.tags.join(', ')})`);
  });
}

main().catch(console.error);
