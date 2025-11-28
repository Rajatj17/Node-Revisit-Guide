const axios = require('axios');

async function loadTest() {
  console.log('Starting load test...\n');
  
  // Simulate 100 users registering
  for (let i = 0; i < 100; i++) {
    try {
      await axios.get('http://localhost:3000/register');
      if (i % 10 === 0) console.log(`Registered ${i} users`);
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
  
  console.log('\n✅ Registered 100 users');
  
  // Simulate 50 logins
  for (let i = 0; i < 50; i++) {
    try {
      await axios.get(`http://localhost:3000/login/${i}`);
      if (i % 10 === 0) console.log(`Created ${i} sessions`);
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
  
  console.log('\n✅ Created 50 sessions');
  
  // Simulate 30 subscriptions
  for (let i = 0; i < 30; i++) {
    try {
      await axios.get(`http://localhost:3000/subscribe/user${i}@test.com`);
      if (i % 10 === 0) console.log(`Created ${i} subscriptions`);
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
  
  console.log('\n✅ Created 30 subscriptions\n');
  
  // Check stats
  const stats = await axios.get('http://localhost:3000/stats');
  console.log('Current stats:', stats.data);
}

loadTest();