#!/usr/bin/env node

// Node.js Interview Prep - Exercise Runner
// Run this file to execute exercises for any section

const fs = require('fs');
const path = require('path');

const sections = [
  { id: 1, name: 'Event Loop', dir: '1. Event Loop' },
  { id: 2, name: 'Imports', dir: '2. Imports' },
  { id: 3, name: 'Streams', dir: '3. Streams' },
  { id: 4, name: 'Middleware', dir: '4. Middleware' },
  { id: 5, name: 'Errors', dir: '5. Errors' },
  { id: 6, name: 'Memory Management', dir: '6. Memory Management and Performance' },
  { id: 7, name: 'Security', dir: '7. Security' },
  { id: 8, name: 'Database & ORM', dir: '8. DB and ORM' },
  { id: 9, name: 'Microservices', dir: '9. MicroService Architecture' },
  { id: 10, name: 'WebSocket', dir: '10. WebSocket' }
];

function showMenu() {
  console.log('\n🚀 Node.js Interview Prep - Exercise Runner');
  console.log('=' .repeat(50));
  console.log('\nAvailable Sections:');
  
  sections.forEach(section => {
    const hasExercises = fs.existsSync(path.join(__dirname, section.dir, 'exercises.js'));
    const hasQuiz = fs.existsSync(path.join(__dirname, section.dir, 'quiz.md'));
    const status = hasExercises ? '✅' : '⚠️ ';
    const quiz = hasQuiz ? '📝' : '  ';
    console.log(`${status}${quiz} ${section.id}. ${section.name}`);
  });
  
  console.log('\n📚 Available Commands:');
  console.log('  node run-exercises.js <number>     - Run exercises for section');
  console.log('  node run-exercises.js quiz <number> - View quiz for section');
  console.log('  node run-exercises.js all          - Run all available exercises');
  console.log('  node run-exercises.js list         - Show this menu');
  console.log('\nExample: node run-exercises.js 1');
  console.log('Legend: ✅ Exercises available, 📝 Quiz available, ⚠️  Coming soon');
}

function runExercise(sectionId) {
  const section = sections.find(s => s.id === parseInt(sectionId));
  
  if (!section) {
    console.error(`❌ Section ${sectionId} not found`);
    return;
  }
  
  const exercisePath = path.join(__dirname, section.dir, 'exercises.js');
  
  if (!fs.existsSync(exercisePath)) {
    console.error(`❌ Exercises not available for ${section.name}`);
    console.log(`📝 Try: node run-exercises.js quiz ${sectionId} for quiz questions`);
    return;
  }
  
  console.log(`\n🎯 Running exercises for: ${section.name}`);
  console.log('=' .repeat(50));
  
  try {
    // Clear require cache to ensure fresh execution
    delete require.cache[require.resolve(exercisePath)];
    require(exercisePath);
  } catch (error) {
    console.error('❌ Error running exercises:', error.message);
  }
}

function showQuiz(sectionId) {
  const section = sections.find(s => s.id === parseInt(sectionId));
  
  if (!section) {
    console.error(`❌ Section ${sectionId} not found`);
    return;
  }
  
  const quizPath = path.join(__dirname, section.dir, 'quiz.md');
  
  if (!fs.existsSync(quizPath)) {
    console.error(`❌ Quiz not available for ${section.name}`);
    return;
  }
  
  console.log(`\n📝 Quiz for: ${section.name}`);
  console.log('=' .repeat(50));
  
  try {
    const quizContent = fs.readFileSync(quizPath, 'utf8');
    console.log(quizContent);
  } catch (error) {
    console.error('❌ Error reading quiz:', error.message);
  }
}

function runAllExercises() {
  console.log('\n🚀 Running All Available Exercises');
  console.log('=' .repeat(50));
  
  sections.forEach(section => {
    const exercisePath = path.join(__dirname, section.dir, 'exercises.js');
    
    if (fs.existsSync(exercisePath)) {
      console.log(`\n\n🎯 === ${section.name.toUpperCase()} EXERCISES ===`);
      try {
        delete require.cache[require.resolve(exercisePath)];
        require(exercisePath);
      } catch (error) {
        console.error(`❌ Error in ${section.name}:`, error.message);
      }
      
      // Add delay between sections
      console.log('\n⏳ Waiting before next section...\n');
    }
  });
  
  console.log('\n✅ All exercises completed!');
}

function showProgress() {
  console.log('\n📊 Progress Report');
  console.log('=' .repeat(30));
  
  let exercisesReady = 0;
  let quizzesReady = 0;
  
  sections.forEach(section => {
    const hasExercises = fs.existsSync(path.join(__dirname, section.dir, 'exercises.js'));
    const hasQuiz = fs.existsSync(path.join(__dirname, section.dir, 'quiz.md'));
    
    if (hasExercises) exercisesReady++;
    if (hasQuiz) quizzesReady++;
    
    const status = hasExercises && hasQuiz ? '✅' : 
                  hasExercises ? '🔨' : 
                  hasQuiz ? '📝' : '⚠️ ';
    
    console.log(`${status} ${section.name}`);
  });
  
  console.log(`\n📈 Exercises: ${exercisesReady}/${sections.length} ready`);
  console.log(`📈 Quizzes: ${quizzesReady}/${sections.length} ready`);
  console.log(`📈 Overall: ${Math.round(((exercisesReady + quizzesReady) / (sections.length * 2)) * 100)}% complete`);
  
  if (exercisesReady === sections.length && quizzesReady === sections.length) {
    console.log('\n🎉 All exercises and quizzes are complete!');
    console.log('🚀 Ready for comprehensive Node.js interview preparation!');
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'list') {
  showMenu();
} else if (args[0] === 'progress') {
  showProgress();
} else if (args[0] === 'quiz') {
  if (args[1]) {
    showQuiz(args[1]);
  } else {
    console.error('❌ Please specify section number for quiz');
    console.log('Example: node run-exercises.js quiz 1');
  }
} else if (args[0] === 'all') {
  runAllExercises();
} else if (!isNaN(args[0])) {
  runExercise(args[0]);
} else {
  console.error(`❌ Unknown command: ${args[0]}`);
  showMenu();
}

// Helpful tips
if (args.length === 0) {
  console.log('\n💡 Tips:');
  console.log('  • Start with Event Loop (section 1) if you\'re new to Node.js');
  console.log('  • Each exercise builds practical understanding');
  console.log('  • Quiz questions test theoretical knowledge');
  console.log('  • Try running exercises multiple times to solidify concepts');
}